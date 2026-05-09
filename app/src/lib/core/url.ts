export type UrlValidation =
  | { ok: true; url: string; hostname: string }
  | { ok: false; reason: 'empty' | 'invalid' };

/**
 * Pull the first http(s) URL out of arbitrary text. Mobile share
 * sheets routinely wrap a URL in marketing copy ("Écoutez Track
 * sur SoundCloud: https://on.soundcloud.com/abc"); without this,
 * the user has to manually delete the prose every time.
 *
 * Returns the trimmed input unchanged when no URL is found —
 * `validateUrl` will then surface the "invalid URL" error.
 */
export function extractFirstUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  // Anchor on `http://` or `https://`, gobble until the first
  // whitespace OR closing punctuation that's almost certainly not
  // part of the URL itself (newlines, surrounding quotes/brackets).
  const match = trimmed.match(/https?:\/\/[^\s<>"`' ]+/i);
  if (!match) return trimmed;
  // Strip trailing punctuation people commonly leave attached
  // ("…sur SoundCloud: https://x.com/y." → drop the trailing dot).
  return match[0].replace(/[.,;:!?)\]}>'"]+$/, '');
}

export function validateUrl(raw: string): UrlValidation {
  // Be tolerant: the user may have pasted a share-sheet message
  // around the actual URL. Pull the URL out before validating.
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
