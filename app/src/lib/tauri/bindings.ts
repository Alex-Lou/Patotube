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
    onProgress: subscribe<DownloadProgressEvent>('download://progress'),
    onStatus: subscribe<DownloadStatusEvent>('download://status'),
  };
}

async function mockApi(): Promise<TauriApi> {
  const { mockTauri } = await import('./mock');
  return mockTauri();
}

let cached: Promise<TauriApi> | null = null;

export function getTauri(): Promise<TauriApi> {
  if (!cached) cached = isTauri() ? realApi() : mockApi();
  return cached;
}
