// Single source of truth for the landing — bump APP_VERSION on each release (download URLs and GitHub API URL derive from it).

export const APP_VERSION = '0.6.0';
// Pinned independently: Linux is only rebuilt when we cut a Linux
// release (needs WSL). Bump in lock-step with APP_VERSION once a
// matching AppImage is uploaded.
const LINUX_VERSION = '0.5.1';

export const GITHUB_OWNER = 'Alex-Lou';
export const GITHUB_REPO = 'Patotube';
export const GITHUB_BASE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_API_RELEASES = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const release = (version: string, asset: string) =>
  `${GITHUB_BASE}/releases/download/v${version}/${asset}`;

export const ASSETS = {
  windowsExe: `Patotube_${APP_VERSION}_x64-setup.exe`,
  android: 'Patotube.apk',
  linuxAppImage: `Patotube_${LINUX_VERSION}_amd64.AppImage`,
} as const;

export const DOWNLOAD_URLS = {
  windows: release(APP_VERSION, ASSETS.windowsExe),
  android: release(APP_VERSION, ASSETS.android),
  linux: release(LINUX_VERSION, ASSETS.linuxAppImage),
} as const;
