import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getTauri } from '@/lib/tauri/bindings';
import { useQueueStore } from '@/lib/core/queue';
import { clamp } from '@/lib/utils';
import {
  isAndroid,
  hasAudioRemuxBridge,
  scanFileNative,
} from '@/lib/android/bridge';
import { runAudioPostProcess } from './post-process';
import { showFailToast, showSuccessToast, type TFunc } from './toasts';
import { enqueueJob, retryJob } from './actions';

/** Mount in ONE place (App root). Wires Tauri progress/status events to the queue store. */
export function useDownloadEvents() {
  const { t } = useTranslation();

  useEffect(() => {
    let unsubProgress: (() => void) | undefined;
    let unsubStatus: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const api = await getTauri();
      if (cancelled) return;

      const onProgress = await api.onProgress((e) => {
        const total = e.bytesTotal ?? 0;
        const pct = total > 0 ? clamp((e.bytesDone / total) * 100, 0, 100) : 0;
        useQueueStore.getState().update(e.jobId, {
          progress: pct,
          ...(e.speedBps !== null ? { speedBps: e.speedBps } : {}),
          ...(e.etaSec !== null ? { etaSec: e.etaSec } : {}),
        });
      });

      const onStatus = await api.onStatus((e) => {
        // eslint-disable-next-line no-console
        console.debug('[patotube] status event', e);
        const queue = useQueueStore.getState();
        queue.setStatus(e.jobId, e.status, e.error);
        if (e.filePath) queue.update(e.jobId, { filePath: e.filePath });

        if (e.status === 'done') {
          void handleDoneEvent(e.jobId, t);
        } else if (e.status === 'failed') {
          handleFailedEvent(e.jobId, e.error, t);
        }
      });

      // Torn down between await and install: unsubscribe and bail.
      if (cancelled) {
        onProgress();
        onStatus();
        return;
      }

      unsubProgress = onProgress;
      unsubStatus = onStatus;
    })();

    return () => {
      cancelled = true;
      unsubProgress?.();
      unsubStatus?.();
    };
  }, [t]);
}

/** `done` is final everywhere except Android audio (needs remux). */
async function handleDoneEvent(jobId: string, t: TFunc): Promise<void> {
  const job = useQueueStore.getState().jobs.find((j) => j.id === jobId);
  if (!job) return;

  // MediaExtractor remux gated to YouTube: strips video from combined-MP4 fallback.
  // SoundCloud/etc already deliver audio-only, and MediaMuxer rejects MP3 in mp4.
  if (
    job.format.kind === 'audio' &&
    job.filePath &&
    job.info.platform === 'youtube' &&
    isAndroid() &&
    hasAudioRemuxBridge()
  ) {
    await runAudioPostProcess(jobId, job, t);
    return;
  }

  if (job.filePath && isAndroid()) {
    scanFileNative(job.filePath);
  }
  showSuccessToast(jobId, job, t);
}

function handleFailedEvent(
  jobId: string,
  rawError: string | null | undefined,
  t: TFunc,
): void {
  const job = useQueueStore.getState().jobs.find((j) => j.id === jobId);
  showFailToast(jobId, job?.info.title ?? '', rawError, t);
}

/** No listeners — just side-effecting actions, safe anywhere. */
export function useDownloadActions() {
  const enqueue = useCallback(enqueueJob, []);
  const retry = useCallback(retryJob, []);

  const showInFolder = useCallback(async (path: string) => {
    const api = await getTauri();
    await api.showInFolder(path);
  }, []);

  const openFile = useCallback(async (path: string) => {
    const api = await getTauri();
    await api.openPath(path);
  }, []);

  return { enqueue, retry, showInFolder, openFile };
}

export const useDownloads = useDownloadActions;
