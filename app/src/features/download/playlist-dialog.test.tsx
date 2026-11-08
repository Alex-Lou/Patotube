// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormatChoice, MediaInfo } from '@/lib/core/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, p?: Record<string, unknown>) => (p ? `${key} ${JSON.stringify(p)}` : key),
  }),
}));
const toastSuccess = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));

const fetchYoutubePlaylist = vi.fn();
vi.mock('@/lib/tauri/bindings', () => ({
  getTauri: async () => ({ fetchYoutubePlaylist }),
}));
const enqueueJob = vi.fn(async (_info: MediaInfo, _format: FormatChoice) => {});
vi.mock('./actions', () => ({
  enqueueJob: (info: MediaInfo, format: FormatChoice) => enqueueJob(info, format),
}));
// The format picker is covered elsewhere; keep this test about the list.
vi.mock('./format-picker', () => ({ FormatPicker: () => null }));

import { PlaylistDialog } from './playlist-dialog';
import { usePlaylistDialog } from './use-playlist-dialog';

const entry = (n: number) => ({
  videoId: `video${String(n).padStart(6, '0')}`,
  title: `Episode ${n}`,
  channel: 'Show',
  durationSeconds: 1500,
  thumbnailUrl: `https://i.ytimg.com/${n}.jpg`,
  viewCount: null,
  published: null,
});

const flush = () => act(async () => {});

beforeEach(() => {
  fetchYoutubePlaylist.mockResolvedValue({
    id: 'PLshow',
    title: 'My show, season 1',
    entries: [entry(1), entry(2), entry(3)],
    truncated: false,
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  usePlaylistDialog.getState().close();
});

describe('PlaylistDialog', () => {
  it('lists the playlist with every video ticked', async () => {
    render(<PlaylistDialog />);
    act(() => usePlaylistDialog.getState().open('https://www.youtube.com/playlist?list=PLshow'));
    await flush();

    expect(fetchYoutubePlaylist).toHaveBeenCalledWith('https://www.youtube.com/playlist?list=PLshow');
    expect(screen.getByText('My show, season 1')).toBeTruthy();
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(3);
    expect(boxes.every((b) => b.checked)).toBe(true);
  });

  it('queues only the ticked videos, in playlist order, then closes', async () => {
    render(<PlaylistDialog />);
    act(() => usePlaylistDialog.getState().open('https://www.youtube.com/playlist?list=PLshow'));
    await flush();

    fireEvent.click(screen.getAllByRole('checkbox')[1]!); // untick episode 2
    fireEvent.click(screen.getByRole('button', { name: /playlist.download/ }));

    expect(enqueueJob.mock.calls.map((c) => c[0].url)).toEqual([
      'https://www.youtube.com/watch?v=video000001',
      'https://www.youtube.com/watch?v=video000003',
    ]);
    expect(enqueueJob.mock.calls[0]![0].platform).toBe('youtube');
    expect(toastSuccess).toHaveBeenCalledWith('playlist.added {"count":2}');
    expect(usePlaylistDialog.getState().url).toBeNull();
  });

  it('can untick everything, which disables the download button', async () => {
    render(<PlaylistDialog />);
    act(() => usePlaylistDialog.getState().open('https://www.youtube.com/playlist?list=PLshow'));
    await flush();

    fireEvent.click(screen.getByRole('button', { name: 'playlist.selectNone' }));
    const download = screen.getByRole('button', { name: /playlist.download/ }) as HTMLButtonElement;
    expect(download.disabled).toBe(true);
  });

  it('shows the backend error instead of a list', async () => {
    fetchYoutubePlaylist.mockRejectedValueOnce(new Error("YouTube mixes can't be downloaded as a playlist"));
    render(<PlaylistDialog />);
    act(() => usePlaylistDialog.getState().open('https://www.youtube.com/playlist?list=RDx'));
    await flush();

    expect(screen.getByText('playlist.failed')).toBeTruthy();
    expect(screen.getByText("YouTube mixes can't be downloaded as a playlist")).toBeTruthy();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('says when the playlist was cut to the first videos', async () => {
    fetchYoutubePlaylist.mockResolvedValueOnce({
      id: 'PLbig', title: 'Big', entries: [entry(1)], truncated: true,
    });
    render(<PlaylistDialog />);
    act(() => usePlaylistDialog.getState().open('https://www.youtube.com/playlist?list=PLbig'));
    await flush();
    expect(screen.getByText('playlist.truncated {"max":25}')).toBeTruthy();
  });
});
