#!/bin/bash
# Version-agnostic Linux build via WSL. Called by release-app.ps1.
# Reads version from app/package.json.
set -eu
export PATH=/root/.cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd /mnt/c/Users/34643/Desktop/Brol/Patotube

echo "[1/4] pnpm install (Linux arch)..."
yes | pnpm install --config.supported-architectures.os=linux --config.supported-architectures.cpu=x64 --config.supported-architectures.libc=glibc 2>&1 | tail -3 || true

cd app
chmod +x src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu src-tauri/binaries/yt-dlp-x86_64-unknown-linux-gnu

export TAURI_SIGNING_PRIVATE_KEY="$(cat .keys/patotube.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='Kerobero.2020'

echo "[2/4] tauri build (Linux)..."
pnpm tauri build --config src-tauri/tauri.linux.conf.json

echo "[3/4] release:manifest..."
pnpm release:manifest

echo "[4/4] WSL Linux build done."
