import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DownloadJob, JobStatus, MediaInfo, FormatChoice } from './types';

const MAX_HISTORY = 20;

const uid = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Still running on the Rust / Kotlin side. */
export const isInFlight = (job: DownloadJob): boolean =>
  job.status === 'pending' || job.status === 'downloading' || job.status === 'converting';

/** Caps the history at MAX_HISTORY finished jobs. In-flight jobs are
 *  never dropped: their events would then land on a missing job. */
export const trim = (jobs: DownloadJob[]): DownloadJob[] => {
  let finished = 0;
  return jobs.filter((j) => isInFlight(j) || ++finished <= MAX_HISTORY);
};

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
      clearAll: () => {
        // Wipe the persist cache too. set({jobs:[]}) alone leaves the
        // {"state":{"jobs":[…]},"version":1} blob in localStorage —
        // and on Android WebView, that blob has been spotted resurrecting
        // stale entries through the device's app backup. Belt + suspenders.
        try {
          localStorage.removeItem('patotube-history');
        } catch {
          /* private mode / unsupported — set() still works */
        }
        set({ jobs: [] });
      },
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
            isInFlight(j) ? { ...j, status: 'failed' as JobStatus, error: 'Interrupted' } : j,
          ),
        );
      },
    },
  ),
);

export { MAX_HISTORY };
