// Android audio post-process: strip video track from combined MP4 via Kotlin
// MediaExtractor+MediaMuxer to produce true audio-only m4a. This module
// orchestrates queue status transitions (converting → done).
// See docs/youtube-kernel.md "Phase 1" for the design rationale.

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

/** Bit-perfect AAC copy. Remux to sibling .audio.m4a, then rename over original. */
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

  // If rename fails, fall back to the sibling path and scrub the source.
  let finalPath = src;
  if (!renameFileNative(tmp, src)) {
    finalPath = tmp;
  }
  if (finalPath !== src) {
    deleteFileNative(src);
  }

  queue.update(jobId, { filePath: finalPath });
  queue.setStatus(jobId, 'done');
  scanFileNative(finalPath);

  showSuccessToast(jobId, { ...job, filePath: finalPath }, t);
}
