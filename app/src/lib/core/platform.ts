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
    return PLATFORMS.generic;
  } catch {
    return PLATFORMS.generic;
  }
}

export const isActive = (p: PlatformInfo): boolean => p.status === 'active';
