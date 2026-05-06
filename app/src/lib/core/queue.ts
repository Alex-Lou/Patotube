import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DownloadJob, JobStatus, MediaInfo, FormatChoice } from './types';

const MAX_HISTORY = 20;

const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const trim = (jobs: DownloadJob[]): DownloadJob[] => jobs.slice(0, MAX_HISTORY);

interface QueueState {
  jobs: DownloadJob[];
  add: (info: MediaInfo, format: FormatChoice) => DownloadJob;
  update: (id: string, patch: Partial<DownloadJob>) => void;
  setStatus: (id: string, status: JobStatus, error?: string) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
  clearAll: () => void;
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set) => ({
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
        set((s) => ({ jobs: trim([job, ...s.jobs]) }));
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
      clearAll: () => set({ jobs: [] }),
    }),
    {
      name: 'patotube-history',
      version: 1,
      // After rehydrate, mark any in-flight jobs as failed (the app was
      // closed mid-download, the underlying child process is gone).
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.jobs = trim(
          state.jobs.map((j) =>
            j.status === 'pending' || j.status === 'downloading' || j.status === 'converting'
              ? { ...j, status: 'failed' as JobStatus, error: 'Interrupted' }
              : j,
          ),
        );
      },
    },
  ),
);

export { MAX_HISTORY };
