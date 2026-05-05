# 🦆 Patotube

Modern, lightweight media downloader. Drop a URL, get an MP3 or MP4. Desktop and Android.

> Status: under active rebuild. Not yet released.

## Supported sources

**Active**

- YouTube
- SoundCloud
- 1800+ other sites supported by `yt-dlp` (Bandcamp, Vimeo, Twitch, Twitter, etc.)

**Coming soon** (UI placeholders)

- Spotify (via YouTube match)
- Deezer (via YouTube match)

## Stack

- **UI**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui
- **Shell**: Tauri 2 (Rust) — desktop (Win/Mac/Linux) and Android, single codebase
- **Engine**: `yt-dlp` + `ffmpeg` bundled as sidecars
- **i18n**: 7 languages with RTL support (en, fr, es, ar, ja, zh, is)
- **Theme**: dark by default + light, smooth transitions
- **Distribution**: GitHub Releases (`.exe`, `.msi`, `.apk`) + GitHub Pages landing

## Repo layout

```
Patotube/
├── app/              # Tauri 2 app — React frontend + Rust backend
│   ├── src/          # frontend
│   └── src-tauri/    # Rust + sidecars
├── landing/          # Astro static landing page
├── .github/workflows # CI: build + release
└── .tools/           # local installers (gitignored)
```

## Development

Prerequisites: Node 20+, pnpm 9+, Rust (rustup), Android Studio (only for APK).

```sh
pnpm install
pnpm dev          # desktop dev with HMR
pnpm tauri build  # produce binaries
```

## License

MIT
