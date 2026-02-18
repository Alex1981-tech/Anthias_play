# -*- coding: utf-8 -*-

"""CEC TV power control. Silent no-op if CEC is unavailable.

Handles two scenarios:
1. Normal boot: CEC bus may need a few seconds to negotiate physical
   addresses — retries at startup solve this.
2. Power-loss boot: TV is completely off (not standby), so CEC won't work
   until TV is manually turned on with remote — periodic re-detection
   picks it up later.
"""

import logging
import subprocess
import time

# Startup: try up to 5 times with 3s delay (max ~15s)
_STARTUP_RETRIES = 5
_STARTUP_DELAY = 3

# If CEC not found, re-check every 60s when standby/wake/get_status is called
_REDETECT_INTERVAL = 60


class CecController:
    """Controls TV power via HDMI-CEC.

    Auto-detects the first working CEC device (/dev/cec0, /dev/cec1).
    All methods are silent no-ops if CEC is unavailable.
    Re-checks periodically if CEC was not found at startup (e.g. TV was
    powered off after an outage and turned on later with remote).
    """

    def __init__(self):
        self._device = None
        self._available = False
        self._tv_is_on = True  # assume TV is on at start
        self._last_detect_time = 0
        self._cec_ctl_missing = False  # set True if cec-ctl binary not found
        self._detect_with_retry()

    # -- detection --------------------------------------------------------

    def _detect_with_retry(self):
        """Try to detect CEC device with retries at startup."""
        for attempt in range(_STARTUP_RETRIES):
            self._detect_device()
            if self._available or self._cec_ctl_missing:
                return
            if attempt < _STARTUP_RETRIES - 1:
                logging.info(
                    'CEC: device not ready, retry %d/%d in %ds...',
                    attempt + 1, _STARTUP_RETRIES, _STARTUP_DELAY,
                )
                time.sleep(_STARTUP_DELAY)

        logging.warning(
            'CEC: no device found after %d attempts. '
            'Will re-check every %ds (TV may need manual power-on '
            'after power loss).',
            _STARTUP_RETRIES, _REDETECT_INTERVAL,
        )

    def _detect_device(self):
        """Probe /dev/cec0 and /dev/cec1 for a working CEC adapter."""
        self._last_detect_time = time.monotonic()

        for dev in ('/dev/cec0', '/dev/cec1'):
            try:
                result = subprocess.run(
                    ['cec-ctl', '-d', dev, '--playback'],
                    capture_output=True, text=True, timeout=5,
                )
                if result.returncode == 0 and 'f.f.f.f' not in result.stdout:
                    self._device = dev
                    self._available = True
                    logging.info('CEC: using device %s', dev)
                    return
            except FileNotFoundError:
                logging.warning('CEC: cec-ctl not found (cec-utils not installed)')
                self._cec_ctl_missing = True
                return
            except subprocess.TimeoutExpired:
                logging.debug('CEC: timeout probing %s', dev)
            except Exception as e:
                logging.debug('CEC: error probing %s: %s', dev, e)

        logging.warning('CEC: no working device found, TV control disabled')

    def _ensure_available(self):
        """Re-check CEC if not available and enough time has passed."""
        if self._available or self._cec_ctl_missing:
            return self._available

        elapsed = time.monotonic() - self._last_detect_time
        if elapsed < _REDETECT_INTERVAL:
            return False

        logging.info('CEC: re-checking device availability...')
        self._detect_device()
        if self._available:
            logging.info('CEC: device now available (TV was turned on)')
        return self._available

    # -- volume state -----------------------------------------------------

    # CEC has no reliable "get volume" command for most TVs, so we track
    # assumed volume internally.  None = unknown → requires calibration.
    _assumed_volume = None  # 0–100 or None
    _assumed_mute = False

    # Delay between consecutive volume key presses (seconds).
    # 0.15s works for Samsung/LG; conservative enough for most TVs.
    _STEP_DELAY = 0.15

    # -- public API -------------------------------------------------------

    def get_status(self):
        """Return CEC availability and TV power state."""
        self._ensure_available()
        return {'cec_available': self._available, 'tv_on': self._tv_is_on}

    def standby(self):
        """Send TV to standby. No-op if CEC unavailable."""
        if not self._ensure_available():
            return
        try:
            subprocess.run(
                ['cec-ctl', '-d', self._device, '--to', '0', '--standby'],
                capture_output=True, timeout=5,
            )
            self._tv_is_on = False
            logging.info('CEC: TV standby sent')
        except Exception as e:
            logging.warning('CEC: standby failed: %s', e)

    def wake(self):
        """Wake TV up. No-op if CEC unavailable."""
        if not self._ensure_available():
            return
        try:
            subprocess.run(
                ['cec-ctl', '-d', self._device, '--to', '0', '--image-view-on'],
                capture_output=True, timeout=5,
            )
            self._tv_is_on = True
            logging.info('CEC: TV wake sent')
        except Exception as e:
            logging.warning('CEC: wake failed: %s', e)

    def set_volume(self, level=None, mute=False):
        """Set TV volume via CEC. Silent no-op if CEC unavailable.

        Args:
            level: 0–100 integer or None (don't change volume).
            mute: True to mute TV audio.
        """
        if not self._ensure_available():
            return

        # Handle mute toggle
        if mute and not self._assumed_mute:
            self._send_mute_toggle()
            self._assumed_mute = True
            logging.info('CEC: muted TV')
        elif not mute and self._assumed_mute:
            self._send_mute_toggle()
            self._assumed_mute = False
            logging.info('CEC: unmuted TV')

        if level is None:
            return

        level = max(0, min(100, int(level)))

        # If we don't know current volume, calibrate first
        if self._assumed_volume is None:
            logging.info('CEC: volume unknown, calibrating (reset to 0)...')
            self._reset_volume_to_zero()
            self._assumed_volume = 0

        delta = level - self._assumed_volume
        if delta == 0:
            return

        direction = 'up' if delta > 0 else 'down'
        steps = abs(delta)
        logging.info(
            'CEC: volume %d → %d (%s %d steps)',
            self._assumed_volume, level, direction, steps,
        )
        try:
            self._volume_steps(direction, steps)
            self._assumed_volume = level
        except Exception as e:
            logging.warning('CEC: volume change failed: %s', e)
            # Lost tracking — next call will recalibrate
            self._assumed_volume = None

    # -- volume internals -------------------------------------------------

    def _send_mute_toggle(self):
        """Send a single mute toggle (CEC User Control: Mute)."""
        try:
            subprocess.run(
                [
                    'cec-ctl', '-d', self._device, '--to', '0',
                    '--user-control-pressed', 'mute',
                ],
                capture_output=True, timeout=5,
            )
            subprocess.run(
                [
                    'cec-ctl', '-d', self._device, '--to', '0',
                    '--user-control-released',
                ],
                capture_output=True, timeout=5,
            )
        except Exception as e:
            logging.warning('CEC: mute toggle failed: %s', e)

    def _volume_steps(self, direction, steps):
        """Send N volume-up or volume-down key presses.

        Uses a single shell command with chained cec-ctl calls to minimize
        subprocess overhead.  Each step is press + release with a short delay.
        """
        key = 'volume-up' if direction == 'up' else 'volume-down'

        # Build a single shell command: (press; release; sleep) × steps
        parts = []
        for _ in range(steps):
            parts.append(
                'cec-ctl -d {dev} --to 0 --user-control-pressed {key} && '
                'cec-ctl -d {dev} --to 0 --user-control-released'.format(
                    dev=self._device, key=key,
                )
            )

        cmd = ' && sleep {delay} && '.format(delay=self._STEP_DELAY).join(parts)

        # Generous timeout: steps × 0.3s + 10s buffer
        timeout = steps * 0.3 + 10
        subprocess.run(
            ['sh', '-c', cmd],
            capture_output=True, timeout=timeout,
        )

    def _reset_volume_to_zero(self):
        """Press volume-down 100 times to guarantee volume is at 0.

        This is the calibration step — only happens once (or after CEC error).
        Takes ~15 seconds.
        """
        self._volume_steps('down', 100)
