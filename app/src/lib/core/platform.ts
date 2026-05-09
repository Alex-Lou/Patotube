import type { PlatformId, PlatformInfo } from './types';

export const PLATFORMS: Record<PlatformId, PlatformInfo> = {
  youtube: {
    id: 'youtube',
    status: 'active',
    hostnames: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com'],
  },
  soundcloud: {
    id: 'soundcloud',
    status: 'active',
    hostnames: ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com'],
  },
  bandcamp: {
    id: 'bandcamp',
    status: 'active',
    // Bandcamp uses subdomains per artist (artist.bandcamp.com).
    // We can't enumerate them; the host check below treats any
    // *.bandcamp.com host as a match.
    hostnames: ['bandcamp.com'],
  },
  audiomack: {
    id: 'audiomack',
    // Marked comingSoon while Audiomack's public API is broken
    // upstream — yt-dlp itself returns 404 on every track since
    // late 2025 (see yt-dlp/yt-dlp#14815). Will flip back to
    // 'active' once the upstream extractor is fixed.
    status: 'comingSoon',
    hostnames: ['audiomack.com', 'www.audiomack.com'],
  },
  archive: {
    id: 'archive',
    status: 'active',
    hostnames: ['archive.org', 'www.archive.org'],
  },
  spotify: {
    id: 'spotify',
    status: 'comingSoon',
    hostnames: ['spotify.com', 'open.spotify.com'],
  },
  deezer: {
    id: 'deezer',
    status: 'comingSoon',
    hostnames: ['deezer.com', 'www.deezer.com'],
  },
  generic: {
    id: 'generic',
    status: 'active',
    hostnames: [],
  },
};

const HOST_INDEX: ReadonlyMap<string, PlatformId> = (() => {
  const m = new Map<string, PlatformId>();
  for (const p of Object.values(PLATFORMS)) {
    for (const h of p.hostnames) m.set(h.toLowerCase(), p.id);
  }
  return m;
})();

export function detectPlatform(rawUrl: string): PlatformInfo {
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.toLowerCase();
    const id = HOST_INDEX.get(host);
    if (id) return PLATFORMS[id];
    // Bandcamp gives every artist their own subdomain
    // (artist.bandcamp.com); HOST_INDEX can't enumerate those, so
    // we recognise any `*.bandcamp.com` host explicitly here.
    if (host.endsWith('.bandcamp.com')) return PLATFORMS.bandcamp;
    return PLATFORMS.generic;
  } catch {
    return PLATFORMS.generic;
  }
}

export const isActive = (p: PlatformInfo): boolean => p.status === 'active';
