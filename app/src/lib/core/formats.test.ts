import { describe, expect, it } from 'vitest';
import { estimateSizeBytes, LONG_MEDIA_SECONDS } from './formats';

describe('estimateSizeBytes', () => {
  it('is unknown without a usable duration', () => {
    const f = { kind: 'audio', bitrate: 320 } as const;
    expect(estimateSizeBytes(undefined, f, false)).toBeNull();
    expect(estimateSizeBytes(0, f, false)).toBeNull();
    expect(estimateSizeBytes(Number.NaN, f, false)).toBeNull();
  });

  it('uses the picked MP3 bitrate on desktop', () => {
    // 320 kbps for 10 min = 24 MB
    expect(estimateSizeBytes(600, { kind: 'audio', bitrate: 320 }, false)).toBe(24_000_000);
  });

  it('uses the ~128 kbps AAC stream on Android, whatever bitrate is picked', () => {
    expect(estimateSizeBytes(600, { kind: 'audio', bitrate: 320 }, true)).toBe(9_600_000);
  });

  it('grows with the video quality', () => {
    const size = (q: 'best' | 'high' | 'medium' | 'low') =>
      estimateSizeBytes(LONG_MEDIA_SECONDS, { kind: 'video', quality: q }, false)!;
    expect(size('best')).toBeGreaterThan(size('high'));
    expect(size('high')).toBeGreaterThan(size('medium'));
    expect(size('medium')).toBeGreaterThan(size('low'));
    // 1 h at 1080p ≈ 1.35 GB
    expect(size('high')).toBe(1_350_000_000);
  });
});
