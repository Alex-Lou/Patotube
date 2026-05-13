// Single source of truth for the landing.
// Bump APP_VERSION on each release; the download URLs and the GitHub
// API URL the download counter pings are all derived from it.

export const APP_VERSION = '0.5.1';

export const GITHUB_OWNER = 'Alex-Lou';
export const GITHUB_REPO = 'Patotube';
export const GITHUB_BASE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_API_RELEASES = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const release = (asset: string) =>
  `${GITHUB_BASE}/releases/download/v${APP_VERSION}/${asset}`;

export const ASSETS = {
  windowsExe: `Patotube_${APP_VERSION}_x64-setup.exe`,
  android: 'Patotube.apk',
  linuxAppImage: `Patotube_${APP_VERSION}_amd64.AppImage`,
} as const;

export const DOWNLOAD_URLS = {
  windows: release(ASSETS.windowsExe),
  android: release(ASSETS.android),
  linux: release(ASSETS.linuxAppImage),
} as const;
