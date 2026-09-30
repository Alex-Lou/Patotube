// Single source of truth for the YouTube player. Exactly one mode is
// active at a time, so two <video> elements can never play the same
// patostream:// URL together (that crashes the Android WebView):
//
//   idle        nothing playing
//   dialog      full player (SearchPlayerDialog)
//   floating    in-app draggable mini-player (FloatingPlayer)
//   background  native Android MediaPlayer (foreground service), no <video>
//
// PlayerHost (App level) renders the visible player for the mode.

import { create } from 'zustand';
import type { SearchResult } from '@/lib/tauri/bindings';

export type VisibleMode = 'dialog' | 'floating';
export type PlaybackMode = 'idle' | VisibleMode | 'background';

/** Delay between unmounting one <video> and mounting the next on the
 *  same patostream:// URL. Mounting both in the same frame kills the
 *  WebView media pipeline. */
export const SWITCH_DELAY_MS = 80;

interface PlaybackState {
  mode: PlaybackMode;
  track: SearchResult | null;
  /** Position (seconds) the next mounted player seeks to. */
  startAt: number;
  /** Visible mode to restore when the app comes back to the
   *  foreground after an automatic hand-off. `null` when the user
   *  chose background audio explicitly (stays in background). */
  returnTo: VisibleMode | null;
  /** Caller-specific "Download" action, kept across mode switches. */
  onDownload: ((track: SearchResult) => void) | null;

  open: (
    track: SearchResult,
    opts?: {
      mode?: VisibleMode;
      startAt?: number;
      onDownload?: ((track: SearchResult) => void) | null;
    },
  ) => void;
  /** Move the current track to another visible player. */
  switchTo: (mode: VisibleMode, startAt: number) => void;
  /** Native player took over; the visible player unmounts. */
  toBackground: (returnTo: VisibleMode | null) => void;
  close: () => void;
}

// Bumped by every action so a delayed switch can tell it was superseded
// (e.g. the user closed the player during the switch delay).
let generation = 0;

const IDLE = {
  mode: 'idle' as const,
  track: null,
  startAt: 0,
  returnTo: null,
  onDownload: null,
};

export const usePlayback = create<PlaybackState>((set, get) => ({
  ...IDLE,

  open: (track, opts = {}) => {
    generation++;
    set({
      mode: opts.mode ?? 'dialog',
      track,
      startAt: opts.startAt ?? 0,
      returnTo: null,
      onDownload: opts.onDownload ?? null,
    });
  },

  switchTo: (mode, startAt) => {
    if (!get().track) return;
    const gen = ++generation;
    set({ mode: 'idle', returnTo: null });
    setTimeout(() => {
      if (gen !== generation || !get().track) return;
      set({ mode, startAt });
    }, SWITCH_DELAY_MS);
  },

  toBackground: (returnTo) => {
    if (!get().track) return;
    generation++;
    set({ mode: 'background', returnTo });
  },

  close: () => {
    generation++;
    set(IDLE);
  },
}));
