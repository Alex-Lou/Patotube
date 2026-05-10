#!/usr/bin/env node
// Idempotent overlay sync — copies the customized Android files
// from `app/src-tauri/android-overlay/` into the Tauri-generated
// `app/src-tauri/gen/android/` tree.
//
// Why this exists: `gen/` is in .gitignore, so a fresh clone +
// `tauri android init` regenerates a vanilla manifest / Activity
// and our share-target intent-filter, the SEND/VIEW intent
// capture in MainActivity, the share + readFileBase64 helpers
// in FileOps, and the bridge `pendingIntent` companion all
// disappear. The canonical versions live in `android-overlay/`
// (committed to git); running this script after init drops them
// back into place.
//
// Run automatically via `pnpm tauri android build / dev` thanks
// to the `beforeBuildCommand` / `beforeDevCommand` hook in
// `tauri.conf.json`. Also safe to call manually.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const overlayRoot = resolve(__dirname, '..', 'src-tauri', 'android-overlay');
const targetRoot = resolve(__dirname, '..', 'src-tauri', 'gen', 'android');

if (!existsSync(targetRoot)) {
  // No `gen/android` yet — Tauri hasn't initialised Android.
  // That's fine; the next `tauri android init` (or `tauri android
  // build`) will generate it, and a follow-up sync run will fill
  // the overlay in.
  console.log('[overlay] gen/android not found — skipping (run `tauri android init` first)');
  process.exit(0);
}

if (!existsSync(overlayRoot)) {
  console.error(`[overlay] missing ${overlayRoot}`);
  process.exit(1);
}

let copied = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const src = join(dir, name);
    const stat = statSync(src);
    if (stat.isDirectory()) {
      walk(src);
      continue;
    }
    const rel = relative(overlayRoot, src);
    const dst = join(targetRoot, rel);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    copied++;
  }
}
walk(overlayRoot);
console.log(`[overlay] synced ${copied} file(s) from android-overlay/ → gen/android/`);
