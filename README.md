# Anthias Player (Modified)

Custom build of [Anthias](https://github.com/Screenly/Anthias) digital signage player for Raspberry Pi.

> **This is NOT the official Anthias project.**
> Original code and documentation: [github.com/Screenly/Anthias](https://github.com/Screenly/Anthias)

## What's different

This fork adds the following features on top of the original Anthias:

### Schedule Slots Engine
Flexible playback scheduling with three slot types:
- **Default** — plays when nothing else is scheduled
- **Time** — activates during specific hours on selected days of the week
- **Event** — one-time or recurring events with highest priority

Priority order: event > time > default. Events interrupt current playback via deadline timer.

### Multi-language UI
Interface available in 5 languages:
- English, Ukrainian, French, German, Polish

Language picker in Settings.

### HDMI Audio Auto-Detection
Automatically detects which HDMI port is connected on Pi4 (dual HDMI) and configures ALSA output accordingly. No more hardcoded audio device.

### Video Frame Screenshots
`GET /api/v2/screenshot` — captures the current video frame via ffmpeg instead of a black framebuffer image. Falls back to framebuffer for images and web pages.

### Playback Viewlog
Tracks what content played and when in `viewlog.db`. Used by Fleet Manager for playback history.

### Silent Boot
`bin/setup-silent-boot.sh` — disables rainbow splash, kernel text, cursor; shows a standby image on boot via `fbi`.

### Display Power Schedule
UI in Settings to configure automatic display on/off times.

## Compatibility

Same as the original Anthias:
- Raspberry Pi 5, 4, 3, 2
- Raspberry Pi OS Bookworm / Bullseye
- x86 (Debian Bookworm)

See [original docs](https://github.com/Screenly/Anthias/blob/master/docs/README.md) for installation and setup.

## Used with

- [Anthias Fleet Manager](https://github.com/Alex1981-tech/Anthias-fleet-manager) — web dashboard for managing multiple Anthias players remotely

## License

[MIT](LICENSE) — same as the original Anthias.
