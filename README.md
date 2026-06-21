# 🦆 Patotube

Modern, lightweight media downloader. Drop a URL — or search — and get an MP3 or
MP4. Desktop (Windows / Linux) and Android, from a single codebase. Free, no
account, no ads, no telemetry.

## Features

- **Paste a URL or search** YouTube right inside the app, preview, then download.
- **MP4 video or MP3 audio**, with a quality picker.
- **In-app player** with a draggable floating mini-player and background audio
  (lock-screen controls) on Android.
- **Resumable downloads** that survive the CDN dropping a long transfer.
- **16 languages** with full RTL support; dark by default.
- **Native, tiny, private** — built on Tauri 2, no tracking of any kind.

## Supported sources

- **YouTube** — native extraction on Android, `yt-dlp` on desktop.
- **SoundCloud, Bandcamp, Internet Archive, Audiomack** — native kernels.
- Many other sites via the bundled `yt-dlp` on desktop.

Spotify and Deezer appear as placeholders (resolved via a YouTube match, planned).

## Stack

- **UI** — React 18 + TypeScript + Vite + Tailwind
- **Shell** — Tauri 2 (Rust): desktop and Android from one codebase
- **Engine** — native Rust YouTube kernel on Android; `yt-dlp` + `ffmpeg`
  sidecars on desktop
- **Distribution** — GitHub Releases (`.exe`, `.apk`) + a GitHub Pages landing

## Repo layout

```
Patotube/
├── app/                # Tauri 2 app — React frontend + Rust backend
│   ├── src/            # frontend
│   └── src-tauri/      # Rust backend + Android overlay + sidecars
├── landing/            # Astro static landing page
└── .github/workflows/  # CI: landing deploy
```

## Development

Prerequisites: Node 20+, pnpm 9+, Rust (rustup), Android Studio (only for APK).

```sh
pnpm install
pnpm dev          # desktop dev with HMR
pnpm tauri build  # produce desktop binaries
```

## Disclaimer

Patotube is a general-purpose tool. It does not host or distribute any content
and is not affiliated with YouTube or any other platform. **You are solely
responsible for what you download and for respecting the terms of service of the
platforms you use and all applicable laws, including copyright.** Only download
content you own, that is in the public domain, or that you are otherwise
authorised to keep a copy of. The author accepts no liability for any use or
misuse of the Software (see [LICENSE](LICENSE)).

## License

© 2026 CybWu. All rights reserved. Patotube is free to use but **not** open for
copying, redistribution, resale, or rebranding. See [LICENSE](LICENSE) for the
full terms.
