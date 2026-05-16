# Version-agnostic Patotube release script.
# Reads the current version from app\package.json so you just bump
# that file + run this script — no need to edit anything else.
#
# Prereqs:
#   - VSCode/Cursor closed (else node_modules locks)
#   - Malwarebytes paused or Patotube folder in its allowlist
#   - app\.keys\patotube.key present (passphrase 'Kerobero.2020')
#   - WSL2 Ubuntu with Rust + Tauri Linux deps
#   - ANDROID_HOME / NDK_HOME / JAVA_HOME set

$ErrorActionPreference = 'Stop'
$REPO  = "C:\Users\34643\Desktop\Brol\Patotube"
$APP   = "$REPO\app"
$STAGE = "$REPO\release-final"
$KEY   = "$APP\.keys\patotube.key"

$pkg     = Get-Content "$APP\package.json" -Raw | ConvertFrom-Json
$VERSION = $pkg.version
Write-Host "=== Releasing Patotube v$VERSION ===" -ForegroundColor Yellow

Write-Host "`n=== 1/6 Clean install (close VSCode if it errors) ===" -ForegroundColor Cyan
Set-Location $REPO
if (Test-Path node_modules) {
  Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
}
pnpm install

Write-Host "`n=== 2/6 Set signing env ===" -ForegroundColor Cyan
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $KEY -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = 'Kerobero.2020'

Write-Host "`n=== 3/6 Build Windows (5-7 min) ===" -ForegroundColor Cyan
Set-Location $APP
pnpm tauri build
$nsis = "$APP\src-tauri\target\release\bundle\nsis\Patotube_${VERSION}_x64-setup.exe"
if (-not (Test-Path $nsis)) { throw "Windows bundle missing at $nsis" }

Write-Host "`n=== 4/6 Build Android (~4 min) ===" -ForegroundColor Cyan
# Sync the Kotlin overlay first so the manifest + bridge are fresh.
pnpm android:sync
pnpm tauri android build --apk --target aarch64
# Workaround: if Tauri only writes the .so, manually copy + gradle.
# If it produced a universal APK directly, the second copy is a no-op.
$so = "$APP\src-tauri\target\aarch64-linux-android\release\libpatotube_lib.so"
$jniDest = "$APP\src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libpatotube_lib.so"
if ((Test-Path $so) -and (-not (Test-Path $jniDest))) {
  Copy-Item $so $jniDest -Force
  Set-Location "$APP\src-tauri\gen\android"
  .\gradlew assembleArm64Release -x rustBuildArm64Release
  Set-Location $APP
}

Write-Host "`n=== 5/6 Build Linux via WSL (~9 min) ===" -ForegroundColor Cyan
wsl bash /mnt/c/Users/34643/Desktop/Brol/Patotube/wsl-linux-build.sh
if ($LASTEXITCODE -ne 0) { throw "WSL Linux build failed ($LASTEXITCODE)" }

Set-Location $REPO
Write-Host "`n   Restoring Windows node_modules…" -ForegroundColor Gray
pnpm install --config.supported-architectures.os=win32 --config.supported-architectures.cpu=x64

Write-Host "`n=== 6/6 Stage release-final\ ===" -ForegroundColor Cyan
if (Test-Path $STAGE) { Remove-Item -Recurse -Force $STAGE }
New-Item -ItemType Directory -Path $STAGE | Out-Null

Copy-Item "$APP\src-tauri\target\release\bundle\nsis\Patotube_${VERSION}_x64-setup.exe"     $STAGE
Copy-Item "$APP\src-tauri\target\release\bundle\nsis\Patotube_${VERSION}_x64-setup.exe.sig" $STAGE

# APK: prefer arm64/release, fall back to universal/release.
$apkArm64     = "$APP\src-tauri\gen\android\app\build\outputs\apk\arm64\release\app-arm64-release.apk"
$apkUniversal = "$APP\src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk"
$apkPatotube  = "$APP\src-tauri\gen\android\app\build\outputs\apk\arm64\release\Patotube.apk"
if     (Test-Path $apkPatotube)  { Copy-Item $apkPatotube  "$STAGE\Patotube.apk" }
elseif (Test-Path $apkArm64)     { Copy-Item $apkArm64     "$STAGE\Patotube.apk" }
elseif (Test-Path $apkUniversal) { Copy-Item $apkUniversal "$STAGE\Patotube.apk" }
else                             { throw "No release APK found" }

Copy-Item "$APP\src-tauri\target\release\bundle\appimage\Patotube_${VERSION}_amd64.AppImage"     $STAGE
Copy-Item "$APP\src-tauri\target\release\bundle\appimage\Patotube_${VERSION}_amd64.AppImage.sig" $STAGE
Copy-Item "$APP\src-tauri\target\release\bundle\deb\Patotube_${VERSION}_amd64.deb"               $STAGE
Copy-Item "$APP\src-tauri\target\release\bundle\deb\Patotube_${VERSION}_amd64.deb.sig"           $STAGE
Copy-Item "$APP\src-tauri\target\release\bundle\rpm\Patotube-${VERSION}-1.x86_64.rpm"            $STAGE
Copy-Item "$APP\src-tauri\target\release\bundle\rpm\Patotube-${VERSION}-1.x86_64.rpm.sig"        $STAGE
Copy-Item "$REPO\release-assets\latest.json"                                                     $STAGE

Write-Host "`n*** DONE — v$VERSION ready ***" -ForegroundColor Green
Get-ChildItem $STAGE | Format-Table Name, @{Name='Size';Expression={'{0:N1} MB' -f ($_.Length/1MB)}}
Write-Host "Drag-and-drop the 10 files into a new GitHub release:"
Write-Host "  https://github.com/Alex-Lou/Patotube/releases/new?tag=v$VERSION" -ForegroundColor Yellow
