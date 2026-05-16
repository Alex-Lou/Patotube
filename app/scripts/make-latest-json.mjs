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

const releaseUrl = (asset) =>
  `https://github.com/Alex-Lou/Patotube/releases/download/v${version}/${asset}`;

// Platform → bundle path under target/release/bundle/.
const targets = {
  'windows-x86_64': {
    bundle: resolve(tauriBundleDir, 'nsis', `Patotube_${version}_x64-setup.exe`),
    asset: `Patotube_${version}_x64-setup.exe`,
  },
  'linux-x86_64': {
    bundle: resolve(tauriBundleDir, 'appimage', `Patotube_${version}_amd64.AppImage`),
    asset: `Patotube_${version}_amd64.AppImage`,
  },
};

const platforms = {};
for (const [name, { bundle, asset }] of Object.entries(targets)) {
  const sig = `${bundle}.sig`;
  if (!existsSync(bundle)) {
    console.warn(`> skip ${name}: missing ${bundle}`);
    continue;
  }
  if (!existsSync(sig)) {
    console.warn(`> skip ${name}: missing ${sig} (run with TAURI_SIGNING_PRIVATE_KEY set)`);
    continue;
  }
  platforms[name] = {
    signature: readFileSync(sig, 'utf8').trim(),
    url: releaseUrl(asset),
  };
  console.log(`> ${name}: ${asset}`);
}

if (Object.keys(platforms).length === 0) {
  console.error('No signed bundles found. Run the build with TAURI_SIGNING_PRIVATE_KEY set.');
  process.exit(1);
}

const manifest = {
  version,
  notes: process.env.RELEASE_NOTES ?? `Patotube v${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

const out = resolve(repoRoot, 'release-assets', 'latest.json');
writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`> wrote ${out}`);
console.log(`> version: ${version}`);
