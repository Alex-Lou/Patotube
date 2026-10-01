export type UrlValidation =
  | { ok: true; url: string; hostname: string }
  | { ok: false; reason: 'empty' | 'invalid' };

/** Pull the first http(s) URL out of arbitrary text.
 *  Share sheets wrap URL in marketing copy. */
export function extractFirstUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const match = trimmed.match(/https?:\/\/[^\s<>"`' ]+/i);
  if (!match) return trimmed;
  // Strip trailing punctuation (e.g. period right after the URL).
  return match[0].replace(/[.,;:!?)\]}>'"]+$/, '');
}

export function validateUrl(raw: string): UrlValidation {
  const candidate = extractFirstUrl(raw);
  if (!candidate) return { ok: false, reason: 'empty' };
  try {
    const u = new URL(candidate);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, url: u.toString(), hostname: u.hostname.toLowerCase() };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

/** Playlist id in a YouTube URL (`list=`), ignoring mixes (`RD…`) and the
 *  private liked / watch-later lists, which cannot be listed. */
export function youtubePlaylistId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase();
    if (host !== 'youtube.com' && !host.endsWith('.youtube.com')) return null;
    const list = u.searchParams.get('list');
    if (!list || list.startsWith('RD') || list === 'LL' || list === 'WL') return null;
    return list;
  } catch {
    return null;
  }
}

/** Keep the user's link next to the resolved media when it points inside
 *  a YouTube playlist, so the preview can offer the whole list. */
export function withPlaylistSource<T extends { playlistUrl?: string }>(info: T, sourceUrl: string): T {
  return youtubePlaylistId(sourceUrl) ? { ...info, playlistUrl: sourceUrl } : info;
}

/** A link to the playlist page itself (as opposed to one video of it). */
export function isYoutubePlaylistPage(raw: string): boolean {
  try {
    return new URL(raw.trim()).pathname === '/playlist' && youtubePlaylistId(raw) !== null;
  } catch {
    return false;
  }
}
