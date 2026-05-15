import type { TauriApi, Unlisten } from './bindings';
import type { MediaInfo } from '@/lib/core/types';
import { detectPlatform } from '@/lib/core/platform';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function mockTauri(): TauriApi {
  const progressHandlers = new Set<(e: any) => void>();
  const statusHandlers = new Set<(e: any) => void>();

  return {
    async fetchMediaInfo(url: string): Promise<MediaInfo> {
      await sleep(600);
      const p = detectPlatform(url);
      return {
        url,
        title: 'Sample title — running in browser preview',
        uploader: 'Demo channel',
        durationSec: 213,
        thumbnail: 'https://picsum.photos/seed/patotube/640/360',
        platform: p.id,
      };
    },
    async startDownload({ jobId }) {
      statusHandlers.forEach((h) => h({ jobId, status: 'downloading' }));
      for (let i = 0; i <= 100; i += 5) {
        await sleep(120);
        progressHandlers.forEach((h) =>
          h({
            jobId,
            bytesDone: i * 100_000,
            bytesTotal: 10_000_000,
            speedBps: 800_000,
            etaSec: Math.max(0, ((100 - i) * 120) / 1000),
          }),
        );
      }
      statusHandlers.forEach((h) =>
        h({ jobId, status: 'done', filePath: '/mock/downloads/sample.mp4' }),
      );
    },
    async cancelDownload() {},
    async pickFolder() {
      return '/mock/downloads';
    },
    async defaultDownloadDir() {
      return '/mock/downloads';
    },
    async openPath() {},
    async showInFolder() {},
    async listDownloads() {
      return [
        {
          name: 'Demo song.mp3',
          path: '/mock/downloads/Demo song.mp3',
          size: 4_750_941,
          mtime: Math.floor(Date.now() / 1000) - 60,
          mimeKind: 'audio',
        },
        {
          name: 'Demo clip.mp4',
          path: '/mock/downloads/Demo clip.mp4',
          size: 19_978_604,
          mtime: Math.floor(Date.now() / 1000) - 3600,
          mimeKind: 'video',
        },
      ];
    },
    async deleteDownload() {},
    async getYoutubeStreamUrl(videoId: string): Promise<string> {
      await sleep(400);
      // Public Big Buck Bunny mp4 — browser-preview placeholder so the
      // <video> tag has something playable when we're not in Tauri.
      void videoId;
      return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    },
    async searchYoutube(query: string, limit: number) {
      await sleep(350);
      const q = query.trim();
      if (!q) return [];
      return Array.from({ length: Math.min(limit, 8) }, (_, i) => ({
        videoId: `mock${i.toString().padStart(2, '0')}`,
        title: `${q} — mock result #${i + 1}`,
        channel: `Mock channel ${i + 1}`,
        durationSeconds: 60 + i * 47,
        thumbnailUrl: `https://picsum.photos/seed/${q}-${i}/320/180`,
        viewCount: Math.floor(1000 * Math.pow(10, i % 5)),
        published: `${i + 1} day${i === 0 ? '' : 's'} ago`,
      }));
    },
    async onProgress(handler) {
      progressHandlers.add(handler);
      const unlisten: Unlisten = () => progressHandlers.delete(handler) as unknown as void;
      return unlisten;
    },
    async onStatus(handler) {
      statusHandlers.add(handler);
      const unlisten: Unlisten = () => statusHandlers.delete(handler) as unknown as void;
      return unlisten;
    },
  };
}
