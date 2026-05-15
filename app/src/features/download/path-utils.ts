/** Matches Node.js path.extname: leading-dot basenames (`.bashrc`) have no extension. */
export function swapExtension(path: string, newExt: string): string {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const lastDot = path.lastIndexOf('.');
  const basenameStart = lastSlash + 1;
  // No dot, dot in a parent dir, or dotfile (`.bashrc`) → append.
  if (lastDot <= lastSlash || lastDot === basenameStart) {
    return path + newExt;
  }
  return path.slice(0, lastDot) + newExt;
}

/** `/d/Title.m4a` + `.audio` + `.m4a` → `/d/Title.audio.m4a`. */
export function withSuffixedExtension(
  path: string,
  infix: string,
  newExt: string,
): string {
  const stem = swapExtension(path, '');
  return stem + infix + newExt;
}
