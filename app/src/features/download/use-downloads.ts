import { useCallback, useEffect } from 'react';
import { getTauri } from '@/lib/tauri/bindings';
import { useQueueStore } from '@/lib/core/queue';
import type { FormatChoice, MediaInfo } from '@/lib/core/types';
import { clamp } from '@/lib/utils';

export function useDownloads() {
  const add = useQueueStore((s) => s.add);
  const update = useQueueStore((s) => s.update);
  const setStatus = useQueueStore((s) => s.setStatus);

  useEffect(() => {
    let unsubProgress: (() => void) | undefined;
    let unsubStatus: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const api = await getTauri();
      if (cancelled) return;

      unsubProgress = await api.onProgress((e) => {
        const total = e.bytesTotal ?? 0;
        const pct = total > 0 ? clamp((e.bytesDone / total) * 100, 0, 100) : 0;
        update(e.jobId, {
          progress: pct,
          ...(e.speedBps !== null ? { speedBps: e.speedBps } : {}),
          ...(e.etaSec !== null ? { etaSec: e.etaSec } : {}),
        });
      });

      unsubStatus = await api.onStatus((e) => {
        setStatus(e.jobId, e.status, e.error);
        if (e.filePath) update(e.jobId, { filePath: e.filePath });
      });
    })();

    return () => {
      cancelled = true;
      unsubProgress?.();
      unsubStatus?.();
    };
  }, [update, setStatus]);

  const enqueue = useCallback(
    async (info: MediaInfo, format: FormatChoice) => {
      const job = add(info, format);
      const api = await getTauri();
      const outputDir = await api.defaultDownloadDir();
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
      const outputDir = await api.defaultDownloadDir();
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

  return { enqueue, retry, showInFolder };
}
