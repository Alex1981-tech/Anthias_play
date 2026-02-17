#!/bin/bash
# ──────────────────────────────────────────────────────────────
# Anthias Player — Silent Boot Setup
# Runs on the Pi HOST (not inside containers).
# Idempotent: safe to run multiple times, patches only once.
#
# What it does:
#   1. Disables rainbow splash & firmware boot delay
#   2. Silences kernel output (quiet, no logos, no cursor)
#   3. Redirects console from tty1 to tty3 (invisible)
#   4. Disables login prompt on the display (getty@tty1)
#   5. Installs fbi and creates a splash service that shows
#      the player logo immediately on boot
# ──────────────────────────────────────────────────────────────

set -euo pipefail

FLAG="/home/pi/.screenly/.silent-boot-done"
CONFIG="/boot/firmware/config.txt"
CMDLINE="/boot/firmware/cmdline.txt"
SPLASH_IMG="/home/pi/.screenly/splash.png"
SPLASH_SRC="/home/pi/screenly/static/img/standby.png"

# ── 0. HDMI headless boot fix (runs every time, idempotent) ──────
# Pi4 has two HDMI ports. hdmi_force_hotplug=1 only forces port 0
# (HDMI-A-1). Port 1 (HDMI-A-2) needs hdmi_force_hotplug:1=1.
# Without this, /dev/fb0 is not created when no monitor is connected
# and the viewer container cannot render to framebuffer.
# The 'D' flag in video= tells the KMS driver to force-enable the
# connector even when no display is physically detected.
HDMI_CHANGED=false

if [ -f "$CONFIG" ]; then
    # Force HDMI hotplug for both ports (firmware level)
    if ! grep -q "^hdmi_force_hotplug=1" "$CONFIG" 2>/dev/null; then
        echo "" >> "$CONFIG"
        echo "# Anthias: force HDMI output without monitor" >> "$CONFIG"
        echo "hdmi_force_hotplug=1" >> "$CONFIG"
        HDMI_CHANGED=true
    fi
    if ! grep -q "^hdmi_force_hotplug:1=1" "$CONFIG" 2>/dev/null; then
        # Add right after hdmi_force_hotplug=1
        sed -i '/^hdmi_force_hotplug=1$/a hdmi_force_hotplug:1=1' "$CONFIG"
        HDMI_CHANGED=true
    fi
fi

if [ -f "$CMDLINE" ]; then
    # Add 'D' (force-enable) flag to video= parameter if missing.
    # Matches video=HDMI-A-N:RESxRES@FREQ without trailing D and appends it.
    if grep -qE 'video=HDMI-A-[0-9]+:[0-9]+x[0-9]+@[0-9]+$' "$CMDLINE" 2>/dev/null; then
        sed -i -E 's/(video=HDMI-A-[0-9]+:[0-9]+x[0-9]+@[0-9]+)$/\1D/' "$CMDLINE"
        HDMI_CHANGED=true
    fi
    # If no video= parameter at all, add default for HDMI-A-2
    if ! grep -q "video=HDMI-A-" "$CMDLINE" 2>/dev/null; then
        CMDLINE_CONTENT=$(cat "$CMDLINE")
        echo "$CMDLINE_CONTENT video=HDMI-A-2:1920x1080@60D" > "$CMDLINE"
        HDMI_CHANGED=true
    fi
fi

if [ "$HDMI_CHANGED" = true ]; then
    echo "[silent-boot] HDMI headless boot fix applied (reboot required)"
else
    echo "[silent-boot] HDMI headless config already OK"
fi
# ── end HDMI fix ─────────────────────────────────────────────────

if [ -f "$FLAG" ]; then
    echo "[silent-boot] Already configured, skipping."
    exit 0
fi

echo "[silent-boot] Configuring silent boot..."

# ── 1. config.txt — disable rainbow splash and boot delay ──
if ! grep -q "disable_splash=1" "$CONFIG" 2>/dev/null; then
    echo "" >> "$CONFIG"
    echo "# Anthias: silent boot" >> "$CONFIG"
    echo "disable_splash=1" >> "$CONFIG"
    echo "boot_delay=0" >> "$CONFIG"
    echo "[silent-boot] Patched config.txt"
else
    echo "[silent-boot] config.txt already patched"
fi

# ── 2. cmdline.txt — silent kernel boot ──
CMDLINE_CONTENT=$(cat "$CMDLINE")
CHANGED=false

# Replace console=tty1 → console=tty3
if echo "$CMDLINE_CONTENT" | grep -q "console=tty1"; then
    CMDLINE_CONTENT=$(echo "$CMDLINE_CONTENT" | sed 's/console=tty1/console=tty3/')
    CHANGED=true
fi

# Add silent parameters
for param in "quiet" "loglevel=0" "logo.nologo" "vt.global_cursor_default=0" "consoleblank=0"; do
    if ! echo "$CMDLINE_CONTENT" | grep -q "$param"; then
        CMDLINE_CONTENT="$CMDLINE_CONTENT $param"
        CHANGED=true
    fi
done

if [ "$CHANGED" = true ]; then
    echo "$CMDLINE_CONTENT" > "$CMDLINE"
    echo "[silent-boot] Patched cmdline.txt"
else
    echo "[silent-boot] cmdline.txt already patched"
fi

# ── 3. Disable getty on tty1 (login prompt on screen) ──
if systemctl is-enabled getty@tty1.service &>/dev/null; then
    systemctl disable getty@tty1.service 2>/dev/null || true
    echo "[silent-boot] Disabled getty@tty1"
else
    echo "[silent-boot] getty@tty1 already disabled"
fi

# ── 4. Install fbi for framebuffer splash ──
if ! command -v fbi &>/dev/null; then
    echo "[silent-boot] Installing fbi..."
    apt-get update -qq && apt-get install -y -qq fbi
    echo "[silent-boot] fbi installed"
else
    echo "[silent-boot] fbi already installed"
fi

# ── 5. Copy splash image ──
if [ -f "$SPLASH_SRC" ]; then
    cp "$SPLASH_SRC" "$SPLASH_IMG"
    echo "[silent-boot] Splash image copied"
else
    echo "[silent-boot] WARNING: splash source not found at $SPLASH_SRC"
fi

# ── 6. Create splash systemd service ──
cat > /etc/systemd/system/anthias-splash.service << 'UNIT'
[Unit]
Description=Anthias boot splash
DefaultDependencies=no
After=local-fs.target
Before=docker.service

[Service]
Type=simple
ExecStart=/usr/bin/fbi -d /dev/fb0 --noverbose -a -T 1 -1 /home/pi/.screenly/splash.png
ExecStop=/bin/sh -c "dd if=/dev/zero of=/dev/fb0 bs=1M count=8 2>/dev/null"
StandardInput=tty
StandardOutput=tty
TTYPath=/dev/tty1
TTYReset=yes

[Install]
WantedBy=sysinit.target
UNIT

systemctl daemon-reload
systemctl enable anthias-splash.service
echo "[silent-boot] Splash service created and enabled"

# ── 7. Set flag ──
mkdir -p "$(dirname "$FLAG")"
touch "$FLAG"

echo "[silent-boot] Done! Reboot required for changes to take effect."
echo "[silent-boot] Run: sudo reboot"
