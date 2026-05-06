#!/usr/bin/env node
// Generates latest.json — the manifest the desktop updater pings to learn
// about new versions. Reads the .sig file that `pnpm tauri build` writes
// next to each installer when TAURI_SIGNING_PRIVATE_KEY is set.
//
// Output:  release-assets/latest.json
//
// Each release uploaded to GitHub must include latest.json as an asset, so
// the URL `https://github.com/Alex-Lou/Patotube/releases/latest/download/latest.json`
// keeps pointing at the freshest one.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'app', 'package.json'), 'utf8'));
const version = pkg.version;

const tauriBundleDir = resolve(repoRoot, 'app', 'src-tauri', 'target', 'release', 'bundle');
const setupExe = resolve(tauriBundleDir, 'nsis', `Patotube_${version}_x64-setup.exe`);
const setupSig = `${setupExe}.sig`;

if (!existsSync(setupExe)) {
  console.error(`Missing installer: ${setupExe}`);
  console.error('Run `pnpm tauri build` first.');
  process.exit(1);
}
if (!existsSync(setupSig)) {
  console.error(`Missing signature: ${setupSig}`);
  console.error('Make sure TAURI_SIGNING_PRIVATE_KEY was set during the build.');
  process.exit(1);
}

const signature = readFileSync(setupSig, 'utf8').trim();

const releaseUrl = (asset) =>
  `https://github.com/Alex-Lou/Patotube/releases/download/v${version}/${asset}`;

const manifest = {
  version,
  notes: process.env.RELEASE_NOTES ?? `Patotube v${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url: releaseUrl(`Patotube_${version}_x64-setup.exe`),
    },
  },
};

const out = resolve(repoRoot, 'release-assets', 'latest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`> wrote ${out}`);
console.log(`> version: ${version}`);
console.log(`> sig length: ${signature.length} chars`);
