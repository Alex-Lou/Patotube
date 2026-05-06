# Releasing Patotube

How to ship a new version end-to-end. Currently a manual process; the
GitHub Actions matrix for desktop bundles will land in a follow-up.

## TL;DR for v0.1.0

1. Merge `feat/tauri-shell` into `main`.
2. Enable GitHub Pages: repo Settings → Pages → Source: **GitHub Actions**.
3. Build the binaries locally (commands below).
4. Create the release on GitHub with the three asset files.
5. The landing's Download buttons start working as soon as the release exists.

## Versioning

Bump in three places, kept identical:

- `app/package.json` → `version`
- `app/src-tauri/Cargo.toml` → `package.version`
- `app/src-tauri/tauri.conf.json` → `version`
- `landing/src/constants/config.ts` → `APP_VERSION`

The semver tag is `v<APP_VERSION>` (e.g. `v0.1.0`). The Windows installer
file name embeds the version, so the landing's pinned URL keeps working
without any extra rewrite.

## Build the binaries

From the repo root, terminal with `pnpm`, `cargo`, `rustc`, the Android
SDK and JDK 17+ in `PATH` (or set `ANDROID_HOME`, `NDK_HOME`, `JAVA_HOME`).

### Windows (.exe + .msi)

```powershell
pnpm install
pnpm tauri build
```

Outputs:

- `app/src-tauri/target/release/bundle/nsis/Patotube_<VERSION>_x64-setup.exe`
- `app/src-tauri/target/release/bundle/msi/Patotube_<VERSION>_x64_en-US.msi`

The build is unsigned. SmartScreen will warn the first user; "More info →
Run anyway" goes through.

### Android (.apk)

The straight `pnpm tauri android build` path hits a Windows symlink
permission issue mid-pipeline; use the bypass that places the
`.so` manually and lets gradle finish:

```powershell
pnpm tauri android build --debug --apk --target aarch64
# the call above will fail at "symlinking lib ... libpatotube_lib.so"
# — that's fine, we already have the compiled library

cp app\src-tauri\target\aarch64-linux-android\debug\libpatotube_lib.so `
   app\src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libpatotube_lib.so

cd app\src-tauri\gen\android
./gradlew assembleArm64Debug -x :app:rustBuildArm64Debug --console=plain --no-daemon
cd ..\..\..\..
```

Output: `app/src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`.

## Stage the assets

```powershell
mkdir release-assets -Force
copy app\src-tauri\target\release\bundle\nsis\Patotube_*-setup.exe release-assets\
copy app\src-tauri\target\release\bundle\msi\Patotube_*.msi release-assets\
copy app\src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk `
     release-assets\Patotube.apk
```

`release-assets/` is gitignored.

## Create the GitHub release

Web flow:

1. Go to https://github.com/Alex-Lou/Patotube/releases/new
2. Choose tag: type `v0.1.0` (or whatever the version is) → "Create new tag on publish"
3. Target: `main`
4. Title: `Patotube v0.1.0`
5. Description: short changelog (what's new in this release)
6. Drag the three files from `release-assets/` into the upload box:
   - `Patotube_0.1.0_x64-setup.exe`
   - `Patotube_0.1.0_x64_en-US.msi`
   - `Patotube.apk`
7. Publish.

`gh` CLI flow (once authenticated with `gh auth login`):

```powershell
gh release create v0.1.0 `
  release-assets\Patotube_0.1.0_x64-setup.exe `
  release-assets\Patotube_0.1.0_x64_en-US.msi `
  release-assets\Patotube.apk `
  --title "Patotube v0.1.0" `
  --notes "First release. Windows installer + Android APK."
```

## Verify

- The landing's Windows / Android download cards now hit the asset URLs
  directly. Click each one in an incognito window to confirm.
- Pages should be deploying (or already deployed) at
  https://alex-lou.github.io/Patotube/ — the workflow runs on every push
  to `main` that touches `landing/**`.
