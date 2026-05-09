// Toasts that fire when a download lands in a terminal state.
// Sonner dedupes on the `id` field so re-emissions of the same
// status from the Rust side don't multiply the notification.
//
// Layout:
//   * success → title + filename + a single folder-icon button
//                that opens the containing folder.
//   * failure → title + friendly error message (no buttons).

import { Folder, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { getTauri } from '@/lib/tauri/bindings';
import { friendlyError } from '@/lib/core/errors';
import {
  isAndroid,
  hasNativeBridge,
  openDownloadsFolderNative,
  openFileNative,
} from '@/lib/android/bridge';
import type { DownloadJob } from '@/lib/core/types';
import type { useTranslation } from 'react-i18next';
import { retryJob } from './actions';

export type TFunc = ReturnType<typeof useTranslation>['t'];

/** Show / open the file. On desktop this reveals it in Explorer
 *  / Finder via Tauri's opener plugin. On Android there's no
 *  standard "reveal file in some file manager" intent, so we
 *  open the file itself via FileProvider — the user gets their
 *  music / video player with the track loaded, which is what
 *  they want from a download-completion toast anyway. Falls
 *  back to the system Downloads folder if no app on the device
 *  can handle the file. */
function showInFolder(filePath: string): void {
  if (isAndroid() && hasNativeBridge()) {
    if (!openFileNative(filePath)) openDownloadsFolderNative();
    return;
  }
  void getTauri().then((api) => api.showInFolder(filePath));
}

export function showSuccessToast(jobId: string, job: DownloadJob, t: TFunc): void {
  const filename = job.filePath ? basename(job.filePath) : undefined;
  toast.success(t('toast.completed', { title: job.info.title }), {
    id: `dl-done-${jobId}`,
    description: filename,
    duration: 14000,
    // Sonner's `action` slot, but we replace the default button
    // chrome with a ghost icon button via the global Toaster
    // classNames override (see App.tsx → `actionButton`).
    action: job.filePath
      ? {
          label: (
            <Folder
              className="size-4"
              aria-label={t('queue.openFolder')}
            />
          ),
          onClick: () => showInFolder(job.filePath!),
        }
      : undefined,
  });
}

/** Last path segment, regardless of separator (handles both
 *  POSIX `/sdcard/Download/foo.mp3` and Windows
 *  `C:\Users\...\foo.mp3`). */
function basename(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

export function showFailToast(
  jobId: string,
  title: string,
  rawError: string | null | undefined,
  t: TFunc,
): void {
  toast.error(t('toast.failed', { title }), {
    id: `dl-fail-${jobId}`,
    description: friendlyError(rawError, t),
    // Most failures here are transient (flaky network, sleeping
    // server, expired YT cipher). Give the user a one-tap retry
    // straight from the toast so they don't have to scroll the
    // queue to find the failed row.
    duration: 14000,
    action: {
      label: <RotateCw className="size-4" aria-label={t('queue.retry')} />,
      onClick: () => {
        void retryJob(jobId);
      },
    },
  });
}
