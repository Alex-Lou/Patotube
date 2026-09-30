// @vitest-environment jsdom
//
// End-to-end behaviour of the YouTube player on "Android": real
// PlayerHost + dialog + floating player, with the Tauri API and the
// PatoMobile bridge faked at their boundaries.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '@/lib/tauri/bindings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: (...args: unknown[]) => toastError(...args),
    loading: vi.fn(() => 1),
    dismiss: vi.fn(),
    message: vi.fn(),
  }),
}));

const api = {
  getYoutubeStreamUrl: vi.fn(async () => 'https://cdn.test/video.mp4'),
  getYoutubeNativeStream: vi.fn(async () => ({ url: 'https://cdn.test/audio', userAgent: 'UA/1' })),
};
vi.mock('@/lib/tauri/bindings', () => ({
  isTauri: () => false,
  getTauri: async () => api,
}));

import { PlayerHost } from './player-host';
import { SWITCH_DELAY_MS, usePlayback } from './use-playback';

const track: SearchResult = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Never Gonna Give You Up',
  channel: 'Rick Astley',
  durationSeconds: 213,
  thumbnailUrl: 'https://i.ytimg.com/x.jpg',
  viewCount: null,
  published: null,
};

// ---- environment fakes -------------------------------------------------

const bridge = {
  startBackgroundAudio: vi.fn(),
  stopBackgroundAudio: vi.fn(),
  getBackgroundPositionMs: vi.fn(() => -1),
  setMediaPlaying: vi.fn(),
};

let visibility: DocumentVisibilityState = 'visible';
function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event('visibilitychange'));
}

// jsdom has no media pipeline: model just paused/currentTime.
type FakeMedia = HTMLMediaElement & { _paused?: boolean; _time?: number };
Object.defineProperty(HTMLMediaElement.prototype, 'paused', {
  configurable: true,
  get(this: FakeMedia) {
    return this._paused ?? true;
  },
});
Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
  configurable: true,
  get(this: FakeMedia) {
    return this._time ?? 0;
  },
  set(this: FakeMedia, v: number) {
    this._time = v;
  },
});
HTMLMediaElement.prototype.play = function (this: FakeMedia) {
  this._paused = false;
  this.dispatchEvent(new Event('play'));
  return Promise.resolve();
};
HTMLMediaElement.prototype.pause = function (this: FakeMedia) {
  this._paused = true;
  this.dispatchEvent(new Event('pause'));
};

/** Let pending promises (stream resolve, hand-off) settle. */
const flush = () => act(async () => {});

const video = () => document.querySelector('video') as FakeMedia | null;

/** The <video> is mounted and playing at `seconds`. */
async function playingAt(seconds: number) {
  await flush();
  const v = video();
  expect(v).not.toBeNull();
  v!._time = seconds;
  await act(async () => {
    await v!.play();
    fireEvent.timeUpdate(v!);
  });
  return v!;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit',
  });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  visibility = 'visible';
  window.PatoMobile = bridge as unknown as typeof window.PatoMobile;
  usePlayback.getState().close();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  bridge.getBackgroundPositionMs.mockImplementation(() => -1);
  vi.useRealTimers();
  delete window.PatoMobile;
});

// ---- tests ---------------------------------------------------------------

describe('PlayerHost', () => {
  it('renders nothing until a track is opened', () => {
    render(<PlayerHost />);
    expect(screen.queryByText(track.title)).toBeNull();
  });

  it('opens the full player and plays the resolved stream', async () => {
    render(<PlayerHost />);
    act(() => usePlayback.getState().open(track));
    await flush();

    expect(screen.getByText(track.title)).toBeTruthy();
    expect(api.getYoutubeStreamUrl).toHaveBeenCalledWith(track.videoId);
    expect(video()?.getAttribute('src')).toBe('https://cdn.test/video.mp4');
  });

  it('shows the resolve error instead of a dead <video>', async () => {
    api.getYoutubeStreamUrl.mockRejectedValueOnce(new Error('This video is private.'));
    render(<PlayerHost />);
    act(() => usePlayback.getState().open(track));
    await flush();

    expect(screen.getByText('search.playerFailed')).toBeTruthy();
    expect(screen.getByText('This video is private.')).toBeTruthy();
    expect(video()).toBeNull();
  });

  it('"Listen in background" hands the exact position to the native player and hides the UI', async () => {
    render(<PlayerHost />);
    act(() => usePlayback.getState().open(track));
    const v = await playingAt(37.5);

    fireEvent.click(screen.getByRole('button', { name: 'search.toBackgroundAudio' }));
    await flush();

    expect(bridge.startBackgroundAudio).toHaveBeenCalledWith(
      'https://cdn.test/audio',
      'UA/1',
      track.videoId,
      track.title,
      track.thumbnailUrl,
      37500,
    );
    expect(v.paused).toBe(true);
    expect(usePlayback.getState()).toMatchObject({ mode: 'background', returnTo: null });
    expect(video()).toBeNull();
  });

  it('reports a failed background hand-off and keeps the player', async () => {
    api.getYoutubeNativeStream.mockRejectedValueOnce(new Error('403'));
    render(<PlayerHost />);
    act(() => usePlayback.getState().open(track));
    await playingAt(5);

    fireEvent.click(screen.getByRole('button', { name: 'search.toBackgroundAudio' }));
    await flush();

    expect(toastError).toHaveBeenCalledWith('search.backgroundAudioFailed', { description: '403' });
    expect(bridge.startBackgroundAudio).not.toHaveBeenCalled();
    expect(usePlayback.getState().mode).toBe('dialog');
  });

  it('moves from the dialog to the floating player at the same position, never both at once', async () => {
    render(<PlayerHost />);
    act(() => usePlayback.getState().open(track));
    await playingAt(20);

    fireEvent.click(screen.getByRole('button', { name: 'search.toPip' }));
    expect(document.querySelectorAll('video')).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(SWITCH_DELAY_MS);
    });
    await flush();

    expect(usePlayback.getState()).toMatchObject({ mode: 'floating', startAt: 20 });
    expect(screen.getByRole('button', { name: 'search.toFullPlayer' })).toBeTruthy();
    expect(document.querySelectorAll('video')).toHaveLength(1);
  });

  it('expands the floating player back to the full dialog', async () => {
    render(<PlayerHost />);
    act(() => usePlayback.getState().open(track, { mode: 'floating' }));
    await playingAt(64);

    fireEvent.click(screen.getByRole('button', { name: 'search.toFullPlayer' }));
    await act(async () => {
      vi.advanceTimersByTime(SWITCH_DELAY_MS);
    });

    expect(usePlayback.getState()).toMatchObject({ mode: 'dialog', startAt: 64 });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('closing the floating player ends playback', async () => {
    render(<PlayerHost />);
    act(() => usePlayback.getState().open(track, { mode: 'floating' }));
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'a11y.close' }));
    expect(usePlayback.getState()).toMatchObject({ mode: 'idle', track: null });
    expect(video()).toBeNull();
  });

  describe('leaving the app while playing', () => {
    it.each(['dialog', 'floating'] as const)(
      'hands %s playback to the native player, then brings it back at the native position',
      async (mode) => {
        render(<PlayerHost />);
        act(() => usePlayback.getState().open(track, { mode }));
        const v = await playingAt(30);

        setVisibility('hidden');
        await flush();

        expect(bridge.startBackgroundAudio).toHaveBeenCalledTimes(1);
        expect(bridge.startBackgroundAudio.mock.calls[0]![5]).toBe(30000);
        expect(v.paused).toBe(true);
        expect(usePlayback.getState()).toMatchObject({ mode: 'background', returnTo: mode });

        // The native player kept going while the app was away.
        bridge.getBackgroundPositionMs.mockImplementation(() => 95000);
        setVisibility('visible');
        await act(async () => {
          vi.advanceTimersByTime(SWITCH_DELAY_MS);
        });

        expect(bridge.stopBackgroundAudio).toHaveBeenCalledTimes(1);
        expect(usePlayback.getState()).toMatchObject({ mode, startAt: 95 });
      },
    );

    it('abandons the hand-off when the user is back before the stream resolved', async () => {
      let resolveStream!: (s: { url: string; userAgent: string }) => void;
      api.getYoutubeNativeStream.mockImplementationOnce(
        () => new Promise((r) => (resolveStream = r)),
      );
      render(<PlayerHost />);
      act(() => usePlayback.getState().open(track));
      await playingAt(10);

      setVisibility('hidden');
      await flush(); // native stream resolve is now in flight
      expect(api.getYoutubeNativeStream).toHaveBeenCalled();
      setVisibility('visible');
      await act(async () => {
        resolveStream({ url: 'https://cdn.test/audio', userAgent: 'UA/1' });
      });

      expect(bridge.startBackgroundAudio).not.toHaveBeenCalled();
      expect(usePlayback.getState().mode).toBe('dialog');
    });

    it('does not hand off a paused video', async () => {
      render(<PlayerHost />);
      act(() => usePlayback.getState().open(track));
      await flush();

      setVisibility('hidden');
      await flush();

      expect(api.getYoutubeNativeStream).not.toHaveBeenCalled();
      expect(usePlayback.getState().mode).toBe('dialog');
    });

    it('stays in background when the native session already ended', async () => {
      render(<PlayerHost />);
      act(() => usePlayback.getState().open(track));
      await playingAt(10);
      setVisibility('hidden');
      await flush();

      bridge.getBackgroundPositionMs.mockImplementation(() => -1); // Stop tapped in the notification
      setVisibility('visible');
      await flush();

      expect(bridge.stopBackgroundAudio).not.toHaveBeenCalled();
      expect(usePlayback.getState().mode).toBe('background');
    });
  });

  it('keeps an explicit background session in background when the app returns', async () => {
    render(<PlayerHost />);
    act(() => usePlayback.getState().open(track));
    await playingAt(10);
    fireEvent.click(screen.getByRole('button', { name: 'search.toBackgroundAudio' }));
    await flush();

    bridge.getBackgroundPositionMs.mockImplementation(() => 50000);
    setVisibility('visible');
    await flush();

    expect(bridge.stopBackgroundAudio).not.toHaveBeenCalled();
    expect(usePlayback.getState().mode).toBe('background');
  });
});
