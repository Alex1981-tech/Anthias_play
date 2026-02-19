from __future__ import unicode_literals

import logging
import os
import subprocess

import vlc

from lib.device_helper import get_device_type
from settings import settings

VIDEO_TIMEOUT = 20  # secs


class MediaPlayer:
    def __init__(self):
        pass

    def set_asset(self, uri, duration):
        raise NotImplementedError

    def play(self):
        raise NotImplementedError

    def stop(self):
        raise NotImplementedError

    def is_playing(self):
        raise NotImplementedError


class FFMPEGMediaPlayer(MediaPlayer):
    def __init__(self):
        MediaPlayer.__init__(self)
        self.process = None

    def set_asset(self, uri, duration):
        self.uri = uri

    def play(self):
        self.process = subprocess.Popen(
            ['ffplay', '-autoexit', self.uri],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    def stop(self):
        try:
            if self.process:
                self.process.terminate()
                self.process = None
        except Exception as e:
            logging.error(f'Exception in stop(): {e}')

    def is_playing(self):
        if self.process:
            return self.process.poll() is None
        return False


def _detect_hdmi_audio_device():
    """Auto-detect connected HDMI audio device on Pi4/Pi5.

    Pi4/Pi5 have two HDMI ports:
      - HDMI-A-1 = card 1 = vc4hdmi0
      - HDMI-A-2 = card 2 = vc4hdmi1
    Uses sysdefault:CARD=vc4hdmiN (not default:CARD=... which is broken).
    """
    for port, card_name in [('card1-HDMI-A-1', 'vc4hdmi0'), ('card1-HDMI-A-2', 'vc4hdmi1')]:
        status_path = f'/sys/class/drm/{port}/status'
        try:
            if os.path.exists(status_path):
                with open(status_path) as f:
                    if f.read().strip() == 'connected':
                        logging.info('Detected connected HDMI: %s -> sysdefault:CARD=%s', port, card_name)
                        return f'sysdefault:CARD={card_name}'
        except OSError:
            pass
    # Fallback
    logging.warning('No connected HDMI detected, falling back to sysdefault:CARD=vc4hdmi0')
    return 'sysdefault:CARD=vc4hdmi0'


class DRMMediaPlayer(MediaPlayer):
    """Video player for Pi5 using ffplay with KMS/DRM output.

    VLC 3.0 on arm64 cannot decode H.264 to framebuffer properly.
    ffplay with SDL2 kmsdrm backend works well on Pi5.
    """

    def __init__(self):
        MediaPlayer.__init__(self)
        self.process = None
        self.uri = None

    def _get_audio_device(self):
        settings.load()
        if settings['audio_output'] == 'local':
            return 'sysdefault:CARD=vc4hdmi0'
        else:
            return _detect_hdmi_audio_device()

    def set_asset(self, uri, duration):
        self.uri = uri

    def play(self):
        audio_dev = self._get_audio_device()
        logging.info('DRMMediaPlayer: playing %s (audio: %s)', self.uri, audio_dev)

        env = os.environ.copy()
        env['SDL_VIDEODRIVER'] = 'kmsdrm'
        env['SDL_AUDIODRIVER'] = 'alsa'
        env['AUDIODEV'] = audio_dev

        self.process = subprocess.Popen(
            [
                'ffplay',
                '-autoexit',
                '-fs',
                '-nostats',
                '-loglevel', 'warning',
                self.uri,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=env,
        )

    def stop(self):
        try:
            if self.process:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=2)
                self.process = None
        except Exception as e:
            logging.error(f'Exception in stop(): {e}')

    def is_playing(self):
        if self.process:
            return self.process.poll() is None
        return False


class VLCMediaPlayer(MediaPlayer):
    def __init__(self):
        MediaPlayer.__init__(self)

        options = self.__get_options()
        self.instance = vlc.Instance(options)
        self.player = self.instance.media_player_new()

        self.player.audio_output_set('alsa')

    def get_alsa_audio_device(self):
        if settings['audio_output'] == 'local':
            return 'plughw:CARD=Headphones'
        else:
            if get_device_type() in ['pi4']:
                return _detect_hdmi_audio_device()
            elif get_device_type() in ['pi1', 'pi2', 'pi3']:
                return 'sysdefault:CARD=vc4hdmi'
            else:
                return 'sysdefault:CARD=HID'

    def __get_options(self):
        opts = [
            f'--alsa-audio-device={self.get_alsa_audio_device()}',
        ]
        if get_device_type() == 'pi4':
            opts.extend(['--vout=fb', '--no-fb-tty'])
        return opts

    def set_asset(self, uri, duration):
        self.player.set_mrl(uri)
        settings.load()
        self.player.audio_output_device_set(
            'alsa', self.get_alsa_audio_device()
        )

    def play(self):
        self.player.play()

    def stop(self):
        self.player.stop()

    def is_playing(self):
        return self.player.get_state() in [
            vlc.State.Playing,
            vlc.State.Buffering,
            vlc.State.Opening,
        ]


class MediaPlayerProxy:
    INSTANCE = None

    @classmethod
    def get_instance(cls):
        if cls.INSTANCE is None:
            if get_device_type() == 'pi5':
                cls.INSTANCE = DRMMediaPlayer()
            elif get_device_type() in ['pi1', 'pi2', 'pi3', 'pi4']:
                cls.INSTANCE = VLCMediaPlayer()
            else:
                cls.INSTANCE = FFMPEGMediaPlayer()

        return cls.INSTANCE
