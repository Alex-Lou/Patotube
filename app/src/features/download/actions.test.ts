import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadJob, JobStatus } from '@/lib/core/types';

const cancelDownload = vi.fn(async (_id: string) => {});
vi.mock('@/lib/tauri/bindings', () => ({
  getTauri: async () => ({ cancelDownload }),
}));

import { useQueueStore } from '@/lib/core/queue';
import { clearAllJobs, removeJob } from './actions';

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
