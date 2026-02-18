# -*- coding: utf-8 -*-

"""IR (infrared) remote control via gpio-ir-tx overlay + ir-ctl.

Uses DFR0095 IR transmitter on GPIO18 (or similar) as a fallback for
CEC power-on when the TV doesn't initialise the HDMI-CEC bus after a
cold start / power loss.

Requires:
  - gpio-ir-tx overlay enabled (creates /dev/lircN TX device)
  - v4l-utils package installed (provides ir-ctl)
"""

import glob
import logging
import shutil
import subprocess


class IrController:
    """Detect TX-capable LIRC device and send IR scancodes."""

    def __init__(self):
        self._device = None
        self._available = False
        self._ir_ctl = shutil.which('ir-ctl')
        if not self._ir_ctl:
            logging.info('IR: ir-ctl not found (v4l-utils not installed)')
            return
        self._detect_device()

    def _detect_device(self):
        """Find the first TX-capable /dev/lirc* device."""
        for dev in sorted(glob.glob('/dev/lirc*')):
            try:
                result = subprocess.run(
                    [self._ir_ctl, '-d', dev, '--features'],
                    capture_output=True, text=True, timeout=5,
                )
                if result.returncode == 0 and 'send' in result.stdout.lower():
                    self._device = dev
                    self._available = True
                    logging.info('IR: TX device found at %s', dev)
                    return
            except subprocess.TimeoutExpired:
                logging.debug('IR: timeout probing %s', dev)
            except Exception as e:
                logging.debug('IR: error probing %s: %s', dev, e)

        logging.info('IR: no TX-capable device found')

    def get_status(self):
        """Return IR hardware availability."""
        return {
            'ir_available': self._available,
            'ir_device': self._device,
        }

    def send_power(self, protocol, scancode):
        """Send an IR power scancode.

        Args:
            protocol: IR protocol name (e.g. 'samsung36', 'nec', 'sony15').
            scancode: Hex scancode string (e.g. '0x0707E01F').

        Returns:
            True if sent successfully, False otherwise.
        """
        if not self._available:
            logging.debug('IR: no TX device, skipping send')
            return False
        if not protocol or not scancode:
            logging.debug('IR: missing protocol or scancode')
            return False

        cmd = [
            self._ir_ctl, '-d', self._device,
            '-S', f'{protocol}:{scancode}',
        ]
        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=5,
            )
            if result.returncode == 0:
                logging.info('IR: sent %s:%s via %s', protocol, scancode, self._device)
                return True
            else:
                logging.warning(
                    'IR: ir-ctl failed (rc=%d): %s',
                    result.returncode, result.stderr.strip(),
                )
                return False
        except subprocess.TimeoutExpired:
            logging.warning('IR: ir-ctl timed out')
            return False
        except Exception as e:
            logging.warning('IR: send failed: %s', e)
            return False
