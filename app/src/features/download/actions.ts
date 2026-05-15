import { getTauri } from '@/lib/tauri/bindings';
import { useQueueStore } from '@/lib/core/queue';
import { useSettings } from '@/lib/core/settings';
import type { FormatChoice, MediaInfo } from '@/lib/core/types';

async function resolveOutputDir(): Promise<string> {
  const custom = useSettings.getState().downloadFolder;
  if (custom) return custom;
  const api = await getTauri();
  return api.defaultDownloadDir();
}

function failureMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Add a fresh job to the queue and ask Rust to start it. */
export async function enqueueJob(
  info: MediaInfo,
  format: FormatChoice,
): Promise<void> {
  const job = useQueueStore.getState().add(info, format);
  // try-wrapped: resolveOutputDir can reject (Linux without
  // ~/.config/user-dirs.dirs), otherwise the job would stick on `pending`.
  try {
    const api = await getTauri();
    const outputDir = await resolveOutputDir();
    await api.startDownload({
      jobId: job.id,
      url: info.url,
      format,
      outputDir,
    });
  } catch (err) {
    useQueueStore.getState().setStatus(job.id, 'failed', failureMessage(err));
  }
}

/** Re-arm an existing job (typically after a failure) and start it again. */
export async function retryJob(jobId: string): Promise<void> {
  const queue = useQueueStore.getState();
  const job = queue.jobs.find((j) => j.id === jobId);
  if (!job) return;
  queue.setStatus(jobId, 'pending');
  queue.update(jobId, { progress: 0, error: undefined });
  try {
    const api = await getTauri();
    const outputDir = await resolveOutputDir();
    await api.startDownload({
      jobId,
      url: job.info.url,
      format: job.format,
      outputDir,
    });
  } catch (err) {
    queue.setStatus(jobId, 'failed', failureMessage(err));
  }
}
