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
