import type { FormatChoice, MediaInfo } from '@/lib/core/types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface DownloadProgressEvent {
  jobId: string;
  bytesDone: number;
  bytesTotal: number | null;
  speedBps: number | null;
  etaSec: number | null;
}

export interface DownloadStatusEvent {
  jobId: string;
  status: 'pending' | 'downloading' | 'converting' | 'done' | 'failed';
  error?: string;
  filePath?: string;
}

export type Unlisten = () => void;

/** Mirrors files::DownloadEntry on the Rust side — keep field names in sync. */
export interface DownloadEntry {
  name: string;
  path: string;
  size: number;
  mtime: number;
  mimeKind: 'audio' | 'video';
}

/** Mirrors youtube_kernel::search::SearchResult — keep field names in sync. */
export interface SearchResult {
  videoId: string;
  title: string;
  channel: string;
  durationSeconds: number | null;
  thumbnailUrl: string;
  viewCount: number | null;
  published: string | null;
}

export interface TauriApi {
  fetchMediaInfo(url: string): Promise<MediaInfo>;
  startDownload(input: {
    jobId: string;
    url: string;
    format: FormatChoice;
    outputDir: string;
  }): Promise<void>;
  cancelDownload(jobId: string): Promise<void>;
  pickFolder(): Promise<string | null>;
  defaultDownloadDir(): Promise<string>;
  openPath(path: string): Promise<void>;
  showInFolder(path: string): Promise<void>;
  listDownloads(): Promise<DownloadEntry[]>;
  deleteDownload(path: string): Promise<void>;
  searchYoutube(query: string, limit: number): Promise<SearchResult[]>;
  getYoutubeStreamUrl(videoId: string): Promise<string>;
  getYoutubeNativeStream(videoId: string): Promise<{ url: string; userAgent: string }>;
  onProgress(handler: (e: DownloadProgressEvent) => void): Promise<Unlisten>;
  onStatus(handler: (e: DownloadStatusEvent) => void): Promise<Unlisten>;
}

async function realApi(): Promise<TauriApi> {
  const [{ invoke }, { listen }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event'),
  ]);

  const subscribe =
    <T>(name: string) =>
    async (handler: (e: T) => void): Promise<Unlisten> => {
      const unlisten = await listen<T>(name, (evt) => handler(evt.payload));
      return () => unlisten();
    };

  return {
    fetchMediaInfo: (url) => invoke('fetch_media_info', { url }),
    startDownload: (input) => invoke('start_download', input),
    cancelDownload: (jobId) => invoke('cancel_download', { jobId }),
    pickFolder: () => invoke('pick_folder'),
    defaultDownloadDir: () => invoke('default_download_dir'),
    openPath: (path) => invoke('open_path', { path }),
    showInFolder: (path) => invoke('show_in_folder', { path }),
    listDownloads: () => invoke('list_downloads'),
    deleteDownload: (path) => invoke('delete_download', { path }),
    searchYoutube: (query, limit) => invoke('search_youtube', { query, limit }),
    getYoutubeStreamUrl: (videoId) => invoke('get_youtube_stream_url', { videoId }),
    getYoutubeNativeStream: (videoId) => invoke('get_youtube_native_stream', { videoId }),
    onProgress: subscribe<DownloadProgressEvent>('download://progress'),
    onStatus: subscribe<DownloadStatusEvent>('download://status'),
  };
}

async function mockApi(): Promise<TauriApi> {
  const { mockTauri } = await import('./mock');
  return mockTauri();
}

// CRITICAL: don't snapshot `isTauri()` synchronously the first time
// getTauri() is called. On Android cold start the WebView may run
// our scripts before Tauri's `window.__TAURI_INTERNALS__` injection
// lands — `isTauri()` returns false, mockApi gets cached forever,
// every fetch / search / startDownload silently goes through the
// browser-preview mock and the user sees fake results that won't
// react to interaction (was the "search broken on first launch"
// bug). We wait up to 3 s for the bridge to appear before falling
// back to mock, and we only cache the REAL api permanently — mock
// is returned without caching so a late-arriving bridge can take
// over on the next call.
let realCached: Promise<TauriApi> | null = null;

async function waitForTauri(maxMs = 3000): Promise<boolean> {
  if (isTauri()) return true;
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await new Promise((r) => setTimeout(r, 30));
    if (isTauri()) return true;
  }
  return false;
}

export async function getTauri(): Promise<TauriApi> {
  if (realCached) return realCached;
  const ready = await waitForTauri();
  if (ready) {
    realCached = realApi();
    return realCached;
  }
  // Genuine browser-preview mode (Vite dev, no Tauri). Return mock
  // but DON'T cache — if Tauri injects later we'll switch over.
  return mockApi();
}
