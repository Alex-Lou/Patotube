import { create } from 'zustand';
import type { DownloadJob, JobStatus, MediaInfo, FormatChoice } from './types';

const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface QueueState {
  jobs: DownloadJob[];
  add: (info: MediaInfo, format: FormatChoice) => DownloadJob;
  update: (id: string, patch: Partial<DownloadJob>) => void;
  setStatus: (id: string, status: JobStatus, error?: string) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  jobs: [],
  add: (info, format) => {
    const job: DownloadJob = {
      id: uid(),
      info,
      format,
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
    };
    set((s) => ({ jobs: [job, ...s.jobs] }));
    return job;
  },
  update: (id, patch) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    })),
  setStatus: (id, status, error) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === id ? { ...j, status, ...(error !== undefined ? { error } : {}) } : j,
      ),
    })),
  remove: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
  clearCompleted: () =>
    set((s) => ({ jobs: s.jobs.filter((j) => j.status !== 'done') })),
}));
