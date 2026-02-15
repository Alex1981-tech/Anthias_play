# Anthias Player (Modified)

Custom build of [Anthias](https://github.com/Screenly/Anthias) digital signage player for Raspberry Pi.

> **This is NOT the official Anthias project.**
> Original code and documentation: [github.com/Screenly/Anthias](https://github.com/Screenly/Anthias)

## Playback Modes

The player supports **two playback modes** that work together:

### Classic Mode (original behavior)
The standard Anthias approach — all active assets play in a loop based on their start/end dates and duration. This is the default behavior from the original project and works out of the box with no additional setup.

### Schedule Slots Mode (new)
A flexible scheduling engine with three slot types and priority system:

| Slot Type | Priority | Description |
|-----------|----------|-------------|
| **Default** | Low | Plays when nothing else is scheduled |
| **Time** | Medium | Activates during specific hours on selected days |
| **Event** | High | One-time or recurring events, interrupts other playback |

If no schedule slots are configured, the player automatically falls back to Classic Mode.

## Screenshots

### Time Slots (Schedule Mode)
![Time Slots](screenshots/time_slots.png)

### Schedule Slots Detail
![Schedule](screenshots/schedule.png)

### Settings
![Settings](screenshots/setings.png)

## Other Features

### Multi-language UI
Interface available in 5 languages: English, Ukrainian, French, German, Polish.
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
Per-day on/off schedule for the TV display via HDMI-CEC. Raspberry Pi stays running. Configurable in Settings.

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
