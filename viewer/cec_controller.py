# -*- coding: utf-8 -*-

"""CEC TV power control. Silent no-op if CEC is unavailable."""

import logging
import subprocess


class CecController:
    """Controls TV power via HDMI-CEC.

    Auto-detects the first working CEC device (/dev/cec0, /dev/cec1).
    All methods are silent no-ops if CEC is unavailable.
    """

    def __init__(self):
        self._device = None
        self._available = False
        self._tv_is_on = True  # assume TV is on at start
        self._detect_device()

    def _detect_device(self):
        """Probe /dev/cec0 and /dev/cec1 for a working CEC adapter."""
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
                return
            except subprocess.TimeoutExpired:
                logging.debug('CEC: timeout probing %s', dev)
            except Exception as e:
                logging.debug('CEC: error probing %s: %s', dev, e)

        logging.warning('CEC: no working device found, TV control disabled')

    def get_status(self):
        """Return CEC availability and TV power state."""
        return {'cec_available': self._available, 'tv_on': self._tv_is_on}

    def standby(self):
        """Send TV to standby. No-op if CEC unavailable."""
        if not self._available:
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
        if not self._available:
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
