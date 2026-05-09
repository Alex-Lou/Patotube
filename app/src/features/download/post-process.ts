// Android audio post-process orchestration: when Rust signals `done`
// for an audio job on Android, we still owe the user one more step —
// stripping the video track from the combined MP4 fallback so the
// final file is true audio-only m4a.
//
// The actual demux happens in Kotlin (`PatoMobileBridge.remuxAudioOnly`)
// using Android's MediaExtractor + MediaMuxer. This module is the
// glue: it sets the queue status to `converting`, awaits the bridge
// promise, then promotes the result back to a final `done`.
//
// See `docs/youtube-kernel.md` ("Phase 1") for the architectural
// rationale (why this lives in TS + Kotlin and not in Rust).

import { useQueueStore } from '@/lib/core/queue';
import {
  deleteFileNative,
  remuxAudioOnlyAsync,
  renameFileNative,
  scanFileNative,
} from '@/lib/android/bridge';
import type { DownloadJob } from '@/lib/core/types';
import { withSuffixedExtension } from './path-utils';
import { showFailToast, showSuccessToast, type TFunc } from './toasts';

/**
 * Strip the video track from the downloaded source via the Kotlin
 * bridge, producing a true audio-only file. Bit-perfect — the AAC
 * samples are copied without re-encoding.
 *
 * Flow: Rust download → `Title.m4a` (combined, ~50 MB).
 *       remux to `Title.audio.m4a` (sibling, audio-only, ~5 MB).
 *       atomically rename `Title.audio.m4a` over `Title.m4a` so the
 *       user-visible filename stays clean.
 */
export async function runAudioPostProcess(
  jobId: string,
  job: DownloadJob,
  t: TFunc,
): Promise<void> {
  if (job.format.kind !== 'audio' || !job.filePath) return;

  const queue = useQueueStore.getState();
  const src = job.filePath;
  const tmp = withSuffixedExtension(src, '.audio', '.m4a');

  queue.setStatus(jobId, 'converting');

  const err = await remuxAudioOnlyAsync(src, tmp);
  if (err) {
    queue.setStatus(jobId, 'failed', err);
    showFailToast(jobId, job.info.title, err, t);
    return;
  }

  // Replace the combined source with the audio-only output. If the
  // rename fails for any reason we keep the temp file at its sibling
  // path and point the queue at it — better than leaving the user
  // with the combined file or a missing one.
  let finalPath = src;
  if (!renameFileNative(tmp, src)) {
    finalPath = tmp;
  }
  // If we fell to the sibling-path branch, scrub the original
  // combined file so we don't ship both. (When the rename succeeds,
  // it already replaced src in-place.)
  if (finalPath !== src) {
    deleteFileNative(src);
  }

  queue.update(jobId, { filePath: finalPath });
  queue.setStatus(jobId, 'done');
  scanFileNative(finalPath);

  showSuccessToast(jobId, { ...job, filePath: finalPath }, t);
}
