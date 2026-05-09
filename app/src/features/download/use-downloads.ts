// Public download hooks for the React side.
//
//   `useDownloadEvents`   — mounts the Tauri progress/status listeners
//                            exactly once per process. Use in ONE place
//                            at the App root.
//   `useDownloadActions`  — exposes `enqueue`, `retry`, `showInFolder`,
//                            `openFile`. Safe to call from any component.
//
// Heavy logic lives in sibling modules:
//   * `toasts.ts`        — sonner show/hide for done/fail
//   * `post-process.ts`  — Android audio remux orchestration
//   * `path-utils.ts`    — extension swap helpers (used by post-process)

import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getTauri } from '@/lib/tauri/bindings';
import { useQueueStore } from '@/lib/core/queue';
import { useSettings } from '@/lib/core/settings';
import type { FormatChoice, MediaInfo } from '@/lib/core/types';
import { clamp } from '@/lib/utils';
import {
  isAndroid,
  hasAudioRemuxBridge,
  scanFileNative,
} from '@/lib/android/bridge';
import { runAudioPostProcess } from './post-process';
import { showFailToast, showSuccessToast, type TFunc } from './toasts';

async function resolveOutputDir(): Promise<string> {
  const custom = useSettings.getState().downloadFolder;
  if (custom) return custom;
  const api = await getTauri();
  return api.defaultDownloadDir();
}

// Module-level guard: the Tauri event listeners must be registered
// exactly once per process, no matter how many components mount/
// unmount the hook. Without this we double-fire toasts.
let listenersInstalled = false;
let unsubProgress: (() => void) | undefined;
let unsubStatus: (() => void) | undefined;

/**
 * Mount-once hook that wires the Tauri progress/status events to the
 * queue store and surfaces toasts on completion / failure. Use it in
 * exactly ONE place (the App root). Other components should use
 * `useDownloadActions`.
 */
export function useDownloadEvents() {
  const { t } = useTranslation();

  useEffect(() => {
    if (listenersInstalled) return;
    listenersInstalled = true;
    let cancelled = false;

    void (async () => {
      const api = await getTauri();
      if (cancelled) return;

      unsubProgress = await api.onProgress((e) => {
        const total = e.bytesTotal ?? 0;
        const pct = total > 0 ? clamp((e.bytesDone / total) * 100, 0, 100) : 0;
        useQueueStore.getState().update(e.jobId, {
          progress: pct,
          ...(e.speedBps !== null ? { speedBps: e.speedBps } : {}),
          ...(e.etaSec !== null ? { etaSec: e.etaSec } : {}),
        });
      });

      unsubStatus = await api.onStatus((e) => {
        const queue = useQueueStore.getState();
        queue.setStatus(e.jobId, e.status, e.error);
        if (e.filePath) queue.update(e.jobId, { filePath: e.filePath });

        if (e.status === 'done') {
          void handleDoneEvent(e.jobId, t);
        } else if (e.status === 'failed') {
          handleFailedEvent(e.jobId, e.error, t);
        }
      });
    })();

    return () => {
      cancelled = true;
      // We DON'T null out unsubProgress/Status here —
      // listenersInstalled stays true so React StrictMode's
      // double-invoke doesn't re-register. The listeners live for
      // the app's lifetime, which is fine.
    };
  }, [t]);
}

/**
 * Fan-out point for `done` status. On Android with audio format we
 * still have one more step (remux → real audio-only m4a) before the
 * job is truly finished. Everywhere else, `done` from Rust is final.
 */
async function handleDoneEvent(jobId: string, t: TFunc): Promise<void> {
  const job = useQueueStore.getState().jobs.find((j) => j.id === jobId);
  if (!job) return;

  // The MediaExtractor remux exists to strip the video track from
  // a YouTube combined-MP4 fallback. Other extractors (SoundCloud
  // and any future ones) hand out audio-only files directly —
  // running them through the remux is wasted work at best and
  // outright broken at worst (MediaMuxer rejects MP3 codec for the
  // mp4 container). Gate the post-process to YouTube.
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

  // Default path: download is truly done. Trigger MediaScanner on
  // Android so the file appears in Files / Music / Gallery apps
  // right away, then show the success toast.
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

/**
 * Action-only hook. Safe to call from any component (queue list,
 * etc.) — it doesn't register Tauri listeners, just exposes
 * side-effecting functions that callers trigger from UI.
 */
export function useDownloadActions() {
  const setStatus = useQueueStore((s) => s.setStatus);
  const update = useQueueStore((s) => s.update);
  const add = useQueueStore((s) => s.add);

  const enqueue = useCallback(
    async (info: MediaInfo, format: FormatChoice) => {
      const job = add(info, format);
      const api = await getTauri();
      const outputDir = await resolveOutputDir();
      try {
        await api.startDownload({
          jobId: job.id,
          url: info.url,
          format,
          outputDir,
        });
      } catch (err) {
        setStatus(job.id, 'failed', err instanceof Error ? err.message : String(err));
      }
    },
    [add, setStatus],
  );

  const retry = useCallback(
    async (jobId: string) => {
      const job = useQueueStore.getState().jobs.find((j) => j.id === jobId);
      if (!job) return;
      setStatus(jobId, 'pending');
      update(jobId, { progress: 0, error: undefined });
      const api = await getTauri();
      const outputDir = await resolveOutputDir();
      try {
        await api.startDownload({ jobId, url: job.info.url, format: job.format, outputDir });
      } catch (err) {
        setStatus(jobId, 'failed', err instanceof Error ? err.message : String(err));
      }
    },
    [setStatus, update],
  );

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

// Backwards-compatible alias for callers that still expect the
// combined API. Internally just calls the actions hook; the events
// hook must be mounted separately at the root.
export const useDownloads = useDownloadActions;
