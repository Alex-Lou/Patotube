// Map raw Rust/CDN/YouTube error strings into translatable friendly
// messages for toasts and queue items. The Android extractor surfaces
// playabilityStatus reasons verbatim ("Sign in to confirm your age"
// etc.) — we'd rather show users a clear sentence in their language.

export function friendlyError(
  raw: string | null | undefined,
  t: (key: string) => string,
): string | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (
    /age[-_\s]?(restrict|gated|verif|confirm)/i.test(raw) ||
    /confirm.*your\s+age/i.test(raw)
  ) {
    return t('errors.ageGated');
  }
  if (
    /sign[-\s]?in/i.test(raw) ||
    /login_required/i.test(raw) ||
    /not\s+a\s+bot/i.test(raw) ||
    /requires\s+(a\s+)?youtube/i.test(raw)
  ) {
    return t('errors.requiresSignin');
  }
  if (s.includes('private')) return t('errors.privateVideo');
  if (s.includes('unavailable')) return t('errors.videoUnavailable');
  return raw;
}
