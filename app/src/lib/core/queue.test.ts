import { describe, expect, it } from 'vitest';
import type { DownloadJob, JobStatus } from './types';
import { isInFlight, trim } from './queue';

const job = (id: string, status: JobStatus): DownloadJob =>
  ({ id, status, progress: 0, createdAt: 0 }) as unknown as DownloadJob;

describe('queue history', () => {
  it('classifies running jobs as in flight', () => {
    expect(isInFlight(job('a', 'pending'))).toBe(true);
    expect(isInFlight(job('a', 'downloading'))).toBe(true);
    expect(isInFlight(job('a', 'converting'))).toBe(true);
    expect(isInFlight(job('a', 'done'))).toBe(false);
    expect(isInFlight(job('a', 'failed'))).toBe(false);
  });

  it('caps finished jobs at 20, newest first', () => {
    const jobs = Array.from({ length: 25 }, (_, i) => job(`d${i}`, 'done'));
    const kept = trim(jobs);
    expect(kept).toHaveLength(20);
    expect(kept[0]!.id).toBe('d0');
    expect(kept[19]!.id).toBe('d19');
  });

  it('never drops an in-flight job, even past the cap', () => {
    const finished = Array.from({ length: 20 }, (_, i) => job(`d${i}`, 'done'));
    const running = job('old-running', 'downloading');
    const kept = trim([job('new', 'pending'), ...finished, running]);
    expect(kept.map((j) => j.id)).toContain('old-running');
    expect(kept.map((j) => j.id)).toContain('new');
    expect(kept.filter((j) => !isInFlight(j))).toHaveLength(20);
  });
});
