// Global controller for the full-screen SearchPlayerDialog. Lets the
// FloatingPlayer (or the Android notification's "App" button, via the
// JS bridge) re-open the dialog without going through every local
// parent state. Parents that own a local previewResult state still
// work — this store just adds a second, app-level entry point.

import { create } from 'zustand';
import type { SearchResult } from '@/lib/tauri/bindings';

interface PlayerDialogState {
  result: SearchResult | null;
  startAt: number;
  open: (result: SearchResult, startAt?: number) => void;
  close: () => void;
}

export const usePlayerDialog = create<PlayerDialogState>((set) => ({
  result: null,
  startAt: 0,
  open: (result, startAt = 0) => set({ result, startAt }),
  close: () => set({ result: null, startAt: 0 }),
}));
