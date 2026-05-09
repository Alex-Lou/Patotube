#!/usr/bin/env node
// Downloads yt-dlp and ffmpeg into src-tauri/binaries with the
// target-triple suffix Tauri 2 expects for sidecars.
//
// Usage:
//   node scripts/fetch-sidecars.mjs            # auto-detect host triple
//   TARGET=x86_64-pc-windows-msvc node ...     # override

import { execSync } from 'node:child_process';
import { copyFileSync, createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';

// Cross-filesystem-safe rename. fs.renameSync trips EXDEV when src
// and dest live on different mounts (e.g. /tmp ext4 → /mnt/c NTFS
// inside WSL). copyFileSync + unlink works regardless of mount.
function moveAcrossFs(src, dest) {
  copyFileSync(src, dest);
  try {
    // We don't need to await this — the source is in tmpdir, leaving
    // it for `rm` of the parent dir to sweep up is fine.
    void rm(src, { force: true });
  } catch {
    /* ignore */
  }
}
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const binDir = join(root, 'src-tauri', 'binaries');

function hostTriple() {
  if (process.env.TARGET) return process.env.TARGET;
  const out = execSync('rustc -vV', { encoding: 'utf8' });
  const m = out.match(/host:\s*(\S+)/);
  if (!m) throw new Error('could not parse rustc host triple');
  return m[1];
}

function isWindows(t) {
  return t.includes('windows');
}

function isLinux(t) {
  return t.includes('linux');
}

function isMacos(t) {
  return t.includes('apple-darwin');
}

function exeSuffix(t) {
  return isWindows(t) ? '.exe' : '';
}

function followingDownload(url, dest) {
  return new Promise((resolveP, rejectP) => {
    const next = (u) => {
      https
        .get(u, (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return next(res.headers.location);
          }
          if (res.statusCode !== 200) {
            return rejectP(new Error(`HTTP ${res.statusCode} for ${u}`));
          }
          const file = createWriteStream(dest);
          res.pipe(file);
          file.on('finish', () => file.close(() => resolveP()));
        })
        .on('error', rejectP);
    };
    next(url);
  });
}

async function main() {
  const triple = hostTriple();
  const sfx = exeSuffix(triple);
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });

  console.log(`> target triple: ${triple}`);

  const ytdlpDest = join(binDir, `yt-dlp-${triple}${sfx}`);
  if (!existsSync(ytdlpDest)) {
    let asset = 'yt-dlp.exe';
    if (isLinux(triple)) asset = 'yt-dlp_linux';
    else if (isMacos(triple)) asset = 'yt-dlp_macos';
    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`;
    console.log(`> fetching ${url}`);
    await followingDownload(url, ytdlpDest);
    if (!isWindows(triple)) execSync(`chmod +x "${ytdlpDest}"`);
    console.log(`> wrote ${ytdlpDest}`);
  } else {
    console.log(`> yt-dlp already present`);
  }

  const ffmpegDest = join(binDir, `ffmpeg-${triple}${sfx}`);
  if (!existsSync(ffmpegDest)) {
    if (isWindows(triple)) {
      const tmp = join(tmpdir(), `ffmpeg-${Date.now()}.zip`);
      const url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
      console.log(`> fetching ${url}`);
      await followingDownload(url, tmp);
      const zip = new AdmZip(tmp);
      const entry = zip
        .getEntries()
        .find((e) => /bin\/ffmpeg\.exe$/i.test(e.entryName));
      if (!entry) throw new Error('ffmpeg.exe not found in archive');
      const tmpOut = join(tmpdir(), `ffmpeg-out-${Date.now()}.exe`);
      zip.extractEntryTo(entry, dirname(tmpOut), false, true, false, 'ffmpeg.exe');
      moveAcrossFs(join(dirname(tmpOut), 'ffmpeg.exe'), ffmpegDest);
      await rm(tmp, { force: true });
      console.log(`> wrote ${ffmpegDest}`);
    } else if (isLinux(triple) && triple.startsWith('x86_64-')) {
      // John Van Sickle's static GPL build — well-known, no glibc
      // dependency, works across Ubuntu / Fedora / Arch out of the
      // box. The release tarball nests the binary inside a dated
      // directory we have to spelunk through.
      const tmp = join(tmpdir(), `ffmpeg-${Date.now()}.tar.xz`);
      const url = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
      console.log(`> fetching ${url}`);
      await followingDownload(url, tmp);
      const extractDir = join(tmpdir(), `ffmpeg-x-${Date.now()}`);
      mkdirSync(extractDir, { recursive: true });
      execSync(`tar -xJf "${tmp}" -C "${extractDir}" --strip-components=1`);
      moveAcrossFs(join(extractDir, 'ffmpeg'), ffmpegDest);
      execSync(`chmod +x "${ffmpegDest}"`);
      await rm(tmp, { force: true });
      await rm(extractDir, { recursive: true, force: true });
      console.log(`> wrote ${ffmpegDest}`);
    } else {
      console.warn(`[!] ffmpeg auto-fetch not implemented for ${triple}. Install ffmpeg manually.`);
    }
  } else {
    console.log(`> ffmpeg already present`);
  }

  console.log('done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
