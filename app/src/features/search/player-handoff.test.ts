import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '@/lib/tauri/bindings';

const getYoutubeNativeStream = vi.fn();
vi.mock('@/lib/tauri/bindings', () => ({
  getTauri: async () => ({ getYoutubeNativeStream }),
}));

import { handoffToBackground } from './player-handoff';

const track: SearchResult = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Song',
  channel: '',
  durationSeconds: null,
  thumbnailUrl: 'https://i.ytimg.com/x.jpg',
  viewCount: null,
  published: null,
};

const startBackgroundAudio = vi.fn();

describe('handoffToBackground', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { PatoMobile: { startBackgroundAudio } });
    getYoutubeNativeStream.mockResolvedValue({ url: 'https://cdn/audio', userAgent: 'UA/1' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('starts the native player with the stream, its UA and the position read after the resolve', async () => {
    let position = 10;
    getYoutubeNativeStream.mockImplementation(async () => {
      position = 12.3456; // playback kept going during the resolve
      return { url: 'https://cdn/audio', userAgent: 'UA/1' };
    });

    const started = await handoffToBackground(track, () => position);

    expect(started).toBe(true);
    expect(getYoutubeNativeStream).toHaveBeenCalledWith('dQw4w9WgXcQ');
    expect(startBackgroundAudio).toHaveBeenCalledWith(
      'https://cdn/audio',
      'UA/1',
      'dQw4w9WgXcQ',
      'Song',
      'https://i.ytimg.com/x.jpg',
      12345,
    );
  });

  it('starts nothing when the hand-off is no longer wanted after the resolve', async () => {
    const started = await handoffToBackground(track, () => 5, () => false);
    expect(started).toBe(false);
    expect(startBackgroundAudio).not.toHaveBeenCalled();
  });

  it('fails loudly when the native bridge is missing', async () => {
    vi.stubGlobal('window', {});
    await expect(handoffToBackground(track, () => 0)).rejects.toThrow(/not available/);
    expect(getYoutubeNativeStream).not.toHaveBeenCalled();
  });

  it('propagates resolve errors', async () => {
    getYoutubeNativeStream.mockRejectedValue(new Error('age-gated'));
    await expect(handoffToBackground(track, () => 0)).rejects.toThrow('age-gated');
    expect(startBackgroundAudio).not.toHaveBeenCalled();
  });
});
