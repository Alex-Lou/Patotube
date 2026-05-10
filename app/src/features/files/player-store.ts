// Tiny zustand store for the embedded file player.
//
// Lives at the App root so the player can be opened from anywhere:
// the FilesSheet row click, the deep-link handler when an
// `Open with → Patotube` intent arrives, or any future entry
// point. We avoid prop-drilling and the sheet doesn't need to be
// open for the player to show.

import { create } from 'zustand';
import type { DownloadEntry } from '@/lib/tauri/bindings';

interface PlayerState {
  active: DownloadEntry | null;
  play: (entry: DownloadEntry) => void;
  /** Open the player from a bare file path. Synthesizes a minimal
   *  DownloadEntry (size/mtime unknown, mime guessed from extension).
   *  Used by the `patotube://open-file?path=…` deep-link path. */
  playPath: (path: string) => void;
  close: () => void;
}

const AUDIO_EXTS = new Set(['mp3', 'm4a', 'ogg', 'opus', 'flac', 'wav', 'aac']);

function basename(path: string): string {
  const m = /[\\/]([^\\/]+)$/.exec(path);
  return m ? m[1]! : path;
}

function guessKind(path: string): 'audio' | 'video' {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  return AUDIO_EXTS.has(ext) ? 'audio' : 'video';
}

export const usePlayerStore = create<PlayerState>((set) => ({
  active: null,
  play: (entry) => set({ active: entry }),
  playPath: (path) =>
    set({
      active: {
        name: basename(path),
        path,
        size: 0,
        mtime: 0,
        mimeKind: guessKind(path),
      },
    }),
  close: () => set({ active: null }),
}));
