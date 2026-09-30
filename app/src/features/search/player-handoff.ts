// Hand the current track from the WebView <video> to the native
// Android background player. Shared by the explicit "Listen in
// background" buttons and the automatic hand-off when the app is
// backgrounded.

import { getTauri, type SearchResult } from '@/lib/tauri/bindings';
import { hasBackgroundAudio, startBackgroundAudioNative } from '@/lib/android/bridge';

/**
 * Resolves the native stream, then starts the native player at the
 * position read *after* the (slow) resolve, so no audio is skipped.
 *
 * `stillWanted` is re-checked once the resolve returns: when it says
 * no (the user came back to the app meanwhile), nothing is started
 * and the function resolves to `false`.
 *
 * Throws when background audio is unavailable or the resolve fails.
 */
export async function handoffToBackground(
  track: SearchResult,
  readPositionSec: () => number,
  stillWanted: () => boolean = () => true,
): Promise<boolean> {
  if (!hasBackgroundAudio()) throw new Error('background audio is not available');
  const api = await getTauri();
  const stream = await api.getYoutubeNativeStream(track.videoId);
  if (!stillWanted()) return false;
  startBackgroundAudioNative(stream, track, readPositionSec() * 1000);
  return true;
}
