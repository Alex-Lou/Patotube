export type UrlValidation =
  | { ok: true; url: string; hostname: string }
  | { ok: false; reason: 'empty' | 'invalid' };

export function validateUrl(raw: string): UrlValidation {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, url: u.toString(), hostname: u.hostname.toLowerCase() };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
