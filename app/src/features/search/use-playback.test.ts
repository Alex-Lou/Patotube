import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '@/lib/tauri/bindings';
import { SWITCH_DELAY_MS, usePlayback } from './use-playback';

const track: SearchResult = {
  videoId: 'dQw4w9WgXcQ',
  title: 'Song',
  channel: 'Artist',
  durationSeconds: 200,
  thumbnailUrl: 'https://i.ytimg.com/x.jpg',
  viewCount: null,
  published: null,
};

const state = () => usePlayback.getState();

describe('usePlayback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state().close();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens in the full dialog from the start by default', () => {
    state().open(track);
    expect(state()).toMatchObject({ mode: 'dialog', track, startAt: 0, returnTo: null });
  });

  it('opens in the requested mode and position (notification resume)', () => {
    state().open(track, { mode: 'floating', startAt: 42 });
    expect(state()).toMatchObject({ mode: 'floating', startAt: 42 });
  });

  it('switches players through idle so two <video> never coexist', () => {
    const onDownload = vi.fn();
    state().open(track, { onDownload });
    state().switchTo('floating', 12.5);

    expect(state().mode).toBe('idle');
    expect(state().track).toBe(track);

    vi.advanceTimersByTime(SWITCH_DELAY_MS);
    expect(state()).toMatchObject({ mode: 'floating', startAt: 12.5, track });
    // The caller's Download action survives the switch.
    expect(state().onDownload).toBe(onDownload);
  });

  it('cancels a pending switch when the player is closed meanwhile', () => {
    state().open(track);
    state().switchTo('floating', 5);
    state().close();
    vi.advanceTimersByTime(SWITCH_DELAY_MS * 2);
    expect(state()).toMatchObject({ mode: 'idle', track: null });
  });

  it('lets a newer open() win over a pending switch', () => {
    state().open(track);
    state().switchTo('floating', 5);
    state().open(track, { mode: 'dialog', startAt: 99 });
    vi.advanceTimersByTime(SWITCH_DELAY_MS * 2);
    expect(state()).toMatchObject({ mode: 'dialog', startAt: 99 });
  });

  it('remembers where to come back after an automatic hand-off', () => {
    state().open(track, { mode: 'floating' });
    state().toBackground('floating');
    expect(state()).toMatchObject({ mode: 'background', returnTo: 'floating', track });
  });

  it('stays in background after an explicit hand-off', () => {
    state().open(track);
    state().toBackground(null);
    expect(state()).toMatchObject({ mode: 'background', returnTo: null });
  });

  it('ignores switch / background requests with no track', () => {
    state().switchTo('dialog', 3);
    state().toBackground('dialog');
    vi.advanceTimersByTime(SWITCH_DELAY_MS);
    expect(state().mode).toBe('idle');
  });
});
