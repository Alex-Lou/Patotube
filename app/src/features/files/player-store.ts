import { create } from 'zustand';
import type { DownloadEntry } from '@/lib/tauri/bindings';

interface PlayerState {
  active: DownloadEntry | null;
  play: (entry: DownloadEntry) => void;
  /** Used by patotube://open-file deep-link; synthesizes a minimal DownloadEntry. */
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
