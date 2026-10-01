import { getTauri } from '@/lib/tauri/bindings';
import { isInFlight, useQueueStore } from '@/lib/core/queue';
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

/** Transfers running at once. A playlist enqueues many jobs; starting
 *  them all together gets the client throttled by the CDN and makes every
 *  one of them slow. The rest wait as `pending`. */
export const MAX_CONCURRENT_DOWNLOADS = 2;

// Pending jobs already handed to Rust (it has not reported "downloading"
// yet). Without this a pending job would be started twice.
const handedToBackend = new Set<string>();

async function startInBackend(jobId: string): Promise<void> {
  const job = useQueueStore.getState().jobs.find((j) => j.id === jobId);
  if (!job) return;
  // try-wrapped: resolveOutputDir can reject (Linux without
  // ~/.config/user-dirs.dirs), otherwise the job would stick on `pending`.
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
    handedToBackend.delete(jobId);
    useQueueStore.getState().setStatus(jobId, 'failed', failureMessage(err));
    pumpQueue();
  }
}

/** Start waiting jobs, oldest first, until MAX_CONCURRENT_DOWNLOADS run.
 *  Call it whenever a job is added, retried, removed, or finishes. */
export function pumpQueue(): void {
  const jobs = useQueueStore.getState().jobs;
  for (const id of handedToBackend) {
    if (!jobs.some((j) => j.id === id && j.status === 'pending')) handedToBackend.delete(id);
  }
  let running = jobs.filter(
    (j) => j.status === 'downloading' || (j.status === 'pending' && handedToBackend.has(j.id)),
  ).length;
  // `jobs` is newest first: walk it backwards to start the oldest.
  for (let i = jobs.length - 1; i >= 0 && running < MAX_CONCURRENT_DOWNLOADS; i--) {
    const job = jobs[i]!;
    if (job.status !== 'pending' || handedToBackend.has(job.id)) continue;
    handedToBackend.add(job.id);
    running++;
    void startInBackend(job.id);
  }
}

/** Add a fresh job to the queue; it starts as soon as a slot is free. */
export async function enqueueJob(info: MediaInfo, format: FormatChoice): Promise<void> {
  useQueueStore.getState().add(info, format);
  pumpQueue();
}

/** Re-arm an existing job (typically after a failure) and queue it again. */
export async function retryJob(jobId: string): Promise<void> {
  const queue = useQueueStore.getState();
  const job = queue.jobs.find((j) => j.id === jobId);
  if (!job) return;
  handedToBackend.delete(jobId);
  queue.setStatus(jobId, 'pending');
  queue.update(jobId, { progress: 0, error: undefined });
  pumpQueue();
}

/** Ask Rust to stop the given jobs. Best effort: the queue entries are
 *  already gone, a failure only means the transfer runs to its end. */
async function cancelInBackend(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;
  try {
    const api = await getTauri();
    await Promise.all(jobIds.map((id) => api.cancelDownload(id)));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[patotube] cancelDownload failed:', err);
  }
}

/** Remove a job from the queue, stopping its download if still running. */
export async function removeJob(jobId: string): Promise<void> {
  const queue = useQueueStore.getState();
  const job = queue.jobs.find((j) => j.id === jobId);
  queue.remove(jobId);
  pumpQueue();
  if (job && isInFlight(job)) await cancelInBackend([jobId]);
}

/** Clear the queue, stopping every download still running. */
export async function clearAllJobs(): Promise<void> {
  const queue = useQueueStore.getState();
  const running = queue.jobs.filter(isInFlight).map((j) => j.id);
  queue.clearAll();
  await cancelInBackend(running);
}
