<p align="center">
  <img src="docs/screenshot.png" alt="Work Timer Widget" width="340" />
</p>

<h1 align="center">Work Timer Widget</h1>

<p align="center">
  An always-on-top, frameless desktop timer that keeps your focus/break cycles on track throughout the workday — with a live colour-coded day timeline, alert chimes, and a resizable window.
</p>

<p align="center">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
  <img alt="Electron" src="https://img.shields.io/badge/electron-29-47848F?logo=electron&logoColor=white" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" />
</p>

---

## Features

| Feature | Description |
|---------|-------------|
| ??? **Always-on-top** | Stays above every window, including fullscreen apps |
| ?? **52 / 7 cycle timer** | 52 min 30 s focus ? 7 min 30 s break, exactly 4 cycles per session |
| ?? **Lunch break** | Detects 12:30–13:30 and switches to a green lunch countdown |
| ?? **Alert chimes** | Web Audio 3-tone chime at every focus?break boundary (no external files) |
| ?? **Day timeline bar** | Full 08:30–17:30 (9 h) bar showing every segment, coloured by type |
| ?? **Live pointer** | White needle tracks your exact position in the day |
| ?? **Resizable window** | Drag the `?` corner handle to stretch or squeeze the widget |
| ??? **Drag to reposition** | Grab the title bar and move it anywhere on screen |
| ? **Urgent blink** | Digits blink in the last 10 seconds of any segment |
| ??? **System tray** | Show / Hide / Quit from the tray icon |

---

## Timer Schedule

```
08:30 ------------------------ 12:30 -- 13:30 ------------------------ 17:30
  ¦ Focus ¦Break¦ Focus ¦Break¦ Focus ¦Break¦ Focus ¦Break¦  Lunch  ¦ ... (same) ¦
  +-----------------------------------------------------------------------------+
  ?-------- 4 × 60-min cycles --------??- 1h -??---- 4 × 60-min cycles -------?
```

| Segment | Duration | Colour |
|---------|----------|--------|
| Focus   | 52 min 30 s | ?? Blue neon |
| Break   | 7 min 30 s  | ?? Red neon  |
| Lunch   | 60 min      | ?? Green neon |
| Off hours | — | Dim |

---

## Getting Started

### Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| Node.js | v18 or newer | https://nodejs.org |
| npm | bundled with Node | — |
| Git | any | https://git-scm.com |

### Clone & run (all platforms)

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/work-timer-widget.git
cd work-timer-widget

# 2. Install dependencies
npm install

# 3. Launch the widget
npm start
```

> **Windows / macOS / Linux** — the three commands above are identical on all platforms.

---

## Build Installers

Builds are produced in the `dist/` folder.

### Windows — NSIS installer (`.exe`)
```bash
npm run build:win
# ? dist/Work Timer Setup 1.1.0.exe  (x64 + ia32)
```

### macOS — DMG (`.dmg`)
```bash
npm run build:mac
# ? dist/Work Timer-1.1.0.dmg  (x64 + Apple Silicon arm64)
```

### Linux — AppImage + Debian package
```bash
npm run build:linux
# ? dist/Work Timer-1.1.0.AppImage
# ? dist/work-timer_1.1.0_amd64.deb
```

### All platforms at once
```bash
npm run build:all
```

> **Cross-platform builds**
> Building for a different OS than the host requires either a matching runner or a CI pipeline.
> The GitHub Actions workflow in [`.github/workflows/release.yml`](.github/workflows/release.yml) builds all three automatically on every pushed tag.

---

## GitHub Actions — automated release

Push a version tag to trigger a build for all three platforms:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The workflow will:
1. Build on `ubuntu-latest`, `macos-latest`, and `windows-latest` in parallel
2. Attach the installers as downloadable assets to a GitHub Release automatically

---

## Project Structure

```
work-timer-widget/
+-- src/
¦   +-- main.js       ? Electron main process (window, tray, IPC)
¦   +-- index.html    ? Widget layout & timeline markup
¦   +-- style.css     ? Neon themes, timeline bar, resize handle
¦   +-- timer.js      ? Timer logic, audio chimes, timeline rendering
+-- .github/
¦   +-- workflows/
¦       +-- release.yml   ? CI: build all platforms on git tag
+-- .gitignore
+-- LICENSE           ? MIT
+-- package.json
+-- README.md
```

---

## Customising the Schedule

All schedule constants are at the top of [`src/timer.js`](src/timer.js):

```js
const WORK_SEGMENT    = 52 * 60 + 30;   // focus duration in seconds
const BREAK_SEGMENT   =  7 * 60 + 30;   // break duration in seconds

const MORNING_START   = H(8,  30);      // 08:30
const MORNING_END     = H(12, 30);      // 12:30
const LUNCH_START     = H(12, 30);
const LUNCH_END       = H(13, 30);
const AFTERNOON_START = H(13, 30);
const AFTERNOON_END   = H(17, 30);
```

Change these values, save, and run `npm start` — the timeline rebuilds automatically.

---

## Adding App Icons

| File | Used for |
|------|----------|
| `src/icon.ico` | Windows installer & taskbar |
| `src/icon.icns` | macOS DMG & dock |
| `src/icon.png` | Linux (256×256 recommended) |

The app runs fine without icons (tray uses an empty image as fallback).

---

## Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to your fork: `git push origin feat/my-feature`
5. Open a Pull Request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

[MIT](LICENSE) © Work Timer Widget Contributors
