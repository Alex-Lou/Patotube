import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadJob, JobStatus } from '@/lib/core/types';

const cancelDownload = vi.fn(async (_id: string) => {});
const startDownload = vi.fn(async (_input: { jobId: string }) => {});
vi.mock('@/lib/tauri/bindings', () => ({
  getTauri: async () => ({
    cancelDownload,
    startDownload,
    defaultDownloadDir: async () => '/downloads',
  }),
}));

import { useQueueStore } from '@/lib/core/queue';
import {
  MAX_CONCURRENT_DOWNLOADS,
  clearAllJobs,
  enqueueJob,
  pumpQueue,
  removeJob,
  retryJob,
} from './actions';
import type { MediaInfo } from '@/lib/core/types';

const job = (id: string, status: JobStatus): DownloadJob =>
  ({ id, status, progress: 0, createdAt: 0 }) as unknown as DownloadJob;

const ids = () => useQueueStore.getState().jobs.map((j) => j.id);

describe('queue actions', () => {
  beforeEach(() => {
    useQueueStore.setState({
      jobs: [job('running', 'downloading'), job('queued', 'pending'), job('finished', 'done')],
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removing a running job also cancels its download', async () => {
    await removeJob('running');
    expect(ids()).toEqual(['queued', 'finished']);
    expect(cancelDownload).toHaveBeenCalledWith('running');
  });

  it('removing a finished job does not call the backend', async () => {
    await removeJob('finished');
    expect(ids()).toEqual(['running', 'queued']);
    expect(cancelDownload).not.toHaveBeenCalled();
  });

  it('clearing the queue cancels every running download', async () => {
    await clearAllJobs();
    expect(ids()).toEqual([]);
    expect(cancelDownload.mock.calls.map((c) => c[0]).sort()).toEqual(['queued', 'running']);
  });

  it('still removes the job when the backend cancel fails', async () => {
    cancelDownload.mockRejectedValueOnce(new Error('ipc down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(removeJob('running')).resolves.toBeUndefined();
    expect(ids()).toEqual(['queued', 'finished']);
    warn.mockRestore();
  });
});

const info = (title: string): MediaInfo => ({
  url: `https://www.youtube.com/watch?v=${title}`,
  title,
  platform: 'youtube',
});
const audio = { kind: 'audio', bitrate: 192 } as const;
const flush = () => new Promise((r) => setTimeout(r, 0));
const started = () => startDownload.mock.calls.map((c) => c[0].jobId);
const statusOf = (title: string) =>
  useQueueStore.getState().jobs.find((j) => j.info.title === title)?.status;
const idOf = (title: string) => useQueueStore.getState().jobs.find((j) => j.info.title === title)!.id;

describe('download queue', () => {
  beforeEach(() => {
    useQueueStore.setState({ jobs: [] });
    startDownload.mockReset();
    startDownload.mockImplementation(async () => {});
  });

  it(`runs at most ${MAX_CONCURRENT_DOWNLOADS} downloads at once, oldest first`, async () => {
    for (const t of ['ep1', 'ep2', 'ep3', 'ep4']) await enqueueJob(info(t), audio);
    await flush();
    expect(started()).toEqual([idOf('ep1'), idOf('ep2')]);
    expect(statusOf('ep3')).toBe('pending');
  });

  it('starts the next waiting job when a slot frees up', async () => {
    for (const t of ['ep1', 'ep2', 'ep3']) await enqueueJob(info(t), audio);
    await flush();
    const queue = useQueueStore.getState();
    queue.setStatus(idOf('ep1'), 'downloading');
    queue.setStatus(idOf('ep2'), 'downloading');
    pumpQueue();
    await flush();
    expect(started()).toHaveLength(2);

    queue.setStatus(idOf('ep1'), 'done');
    pumpQueue();
    await flush();
    expect(started()).toEqual([idOf('ep1'), idOf('ep2'), idOf('ep3')]);
  });

  it('never starts the same pending job twice', async () => {
    await enqueueJob(info('ep1'), audio);
    pumpQueue();
    pumpQueue();
    await flush();
    expect(started()).toEqual([idOf('ep1')]);
  });

  it('a job that fails to start frees its slot', async () => {
    startDownload.mockImplementationOnce(async () => {
      throw new Error('no output dir');
    });
    for (const t of ['ep1', 'ep2', 'ep3']) await enqueueJob(info(t), audio);
    await flush();
    await flush();
    expect(statusOf('ep1')).toBe('failed');
    expect(started()).toEqual([idOf('ep1'), idOf('ep2'), idOf('ep3')]);
  });

  it('a retried job waits for a free slot like any other', async () => {
    for (const t of ['ep1', 'ep2', 'ep3']) await enqueueJob(info(t), audio);
    await flush();
    const queue = useQueueStore.getState();
    queue.setStatus(idOf('ep1'), 'failed', 'boom');
    queue.setStatus(idOf('ep2'), 'downloading');
    pumpQueue();
    await flush(); // ep3 takes the free slot
    startDownload.mockClear();

    await retryJob(idOf('ep1'));
    await flush();
    expect(statusOf('ep1')).toBe('pending');
    expect(started()).toEqual([]); // ep2 + ep3 already use both slots
  });
});
