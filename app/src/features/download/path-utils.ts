// Filesystem path string helpers used by the download flow. Pure
// functions — see path-utils.test.ts.

/** Replace the last extension on a path with `newExt` (must include
 *  the leading dot). Treats paths with no extension by appending.
 *  Matches Node.js `path.extname` semantics: a leading-dot basename
 *  like `.bashrc` is treated as having no extension. */
export function swapExtension(path: string, newExt: string): string {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const lastDot = path.lastIndexOf('.');
  const basenameStart = lastSlash + 1;
  // No dot at all, or only in a parent directory, or only at the
  // very start of the basename (dotfile convention) → append.
  if (lastDot <= lastSlash || lastDot === basenameStart) {
    return path + newExt;
  }
  return path.slice(0, lastDot) + newExt;
}

/** Build a sibling path: drop the last extension, append `infix` and
 *  `newExt`. e.g. `withSuffixedExtension("/d/Title.m4a", ".audio", ".m4a")`
 *  → `/d/Title.audio.m4a`. Used for temp files where we want the
 *  remux output to land next to the source until we rename it back. */
export function withSuffixedExtension(
  path: string,
  infix: string,
  newExt: string,
): string {
  const stem = swapExtension(path, '');
  return stem + infix + newExt;
}
