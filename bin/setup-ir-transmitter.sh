#!/bin/bash
# Setup gpio-ir-tx overlay for DFR0095 IR transmitter on GPIO18.
# Idempotent — safe to run multiple times.
# Requires reboot after first run.

set -euo pipefail

FLAG_FILE="$HOME/.screenly/.ir-transmitter-done"
CONFIG_FILE="/boot/firmware/config.txt"
OVERLAY_LINE="dtoverlay=gpio-ir-tx,gpio_pin=18"

if [ -f "$FLAG_FILE" ]; then
    echo "IR transmitter already configured (flag: $FLAG_FILE). Skipping."
    exit 0
fi

echo "=== Setting up IR transmitter on GPIO18 ==="

# 1. Add device tree overlay if not present
if ! grep -q "^${OVERLAY_LINE}" "$CONFIG_FILE" 2>/dev/null; then
    echo "Adding $OVERLAY_LINE to $CONFIG_FILE"
    echo "$OVERLAY_LINE" | sudo tee -a "$CONFIG_FILE" > /dev/null
else
    echo "Overlay already present in $CONFIG_FILE"
fi

# 2. Install v4l-utils on host (provides ir-ctl)
if ! command -v ir-ctl &> /dev/null; then
    echo "Installing v4l-utils (provides ir-ctl)..."
    sudo apt-get update -qq && sudo apt-get install -y -qq v4l-utils
else
    echo "ir-ctl already installed"
fi

# 3. Mark as done
mkdir -p "$(dirname "$FLAG_FILE")"
touch "$FLAG_FILE"

echo ""
echo "=== IR transmitter setup complete ==="
echo "REBOOT REQUIRED for the overlay to take effect."
echo "After reboot, /dev/lirc0 should appear."
echo ""
echo "Test with: ir-ctl -d /dev/lirc0 --features"
echo "Send test: ir-ctl -d /dev/lirc0 -S samsung36:0x0707E01F"
