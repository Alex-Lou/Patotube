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
