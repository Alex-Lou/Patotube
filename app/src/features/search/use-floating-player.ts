// Floating mini-player state. Replaces the Android system PiP (which
// gave us no control over the chrome) with a fully in-app overlay
// that the user can drag, resize between small/expanded, and close.
// Lives at the App.tsx level so it survives the SearchPlayerDialog
// being unmounted.

import { create } from 'zustand';
import type { SearchResult } from '@/lib/tauri/bindings';

interface FloatingPlayerState {
  result: SearchResult | null;
  src: string | null;
  startAt: number;
  open: (result: SearchResult, src: string, startAt: number) => void;
  close: () => void;
}

export const useFloatingPlayer = create<FloatingPlayerState>((set) => ({
  result: null,
  src: null,
  startAt: 0,
  open: (result, src, startAt) => set({ result, src, startAt }),
  close: () => set({ result: null, src: null, startAt: 0 }),
}));
