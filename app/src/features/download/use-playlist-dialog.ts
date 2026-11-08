// Which YouTube playlist the picker shows. Opened from the URL field (a
// playlist link), the browser extension / drag & drop, or a video preview.

import { create } from 'zustand';

interface PlaylistDialogState {
  url: string | null;
  open: (url: string) => void;
  close: () => void;
}

export const usePlaylistDialog = create<PlaylistDialogState>((set) => ({
  url: null,
  open: (url) => set({ url }),
  close: () => set({ url: null }),
}));

