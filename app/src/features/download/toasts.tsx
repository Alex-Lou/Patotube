// Toasts that fire when a download lands in a terminal state. Sonner
// dedupes on the `id` field so re-emissions of the same status from
// the Rust side don't multiply the notification.

import { Folder } from 'lucide-react';
import { toast } from 'sonner';
import { getTauri } from '@/lib/tauri/bindings';
import { friendlyError } from '@/lib/core/errors';
import {
  isAndroid,
  hasNativeBridge,
  openFileNative,
  openDownloadsFolderNative,
} from '@/lib/android/bridge';
import type { DownloadJob } from '@/lib/core/types';
import type { useTranslation } from 'react-i18next';

export type TFunc = ReturnType<typeof useTranslation>['t'];

/**
 * Open the file in the user's default player. On Android we go
 * through the native FileProvider bridge; on desktop we hand the
 * absolute path to Tauri's opener plugin which forwards to the OS
 * (which then shows its picker on first run if no default app is
 * registered for the extension).
 */
function openFile(filePath: string): void {
  if (isAndroid() && hasNativeBridge()) {
    if (!openFileNative(filePath)) openDownloadsFolderNative();
    return;
  }
  void getTauri().then((api) => api.openPath(filePath));
}

/** Reveal the file in the OS file manager (Explorer on Windows,
 *  Finder on macOS, Files on Linux/Android). */
function showInFolder(filePath: string): void {
  if (isAndroid() && hasNativeBridge()) {
    openDownloadsFolderNative();
    return;
  }
  void getTauri().then((api) => api.showInFolder(filePath));
}

export function showSuccessToast(jobId: string, job: DownloadJob, t: TFunc): void {
  // Description shows just the filename, not the full path. The
  // full path was wrapping vertically in the toast, making the
  // whole thing unreadable. Users who want the path can hover the
  // queue item or click the "show in folder" button.
  const filename = job.filePath ? basename(job.filePath) : undefined;
  toast.success(t('toast.completed', { title: job.info.title }), {
    id: `dl-done-${jobId}`,
    description: filename,
    duration: 14000,
    action: job.filePath
      ? {
          label: t('queue.openFile'),
          onClick: () => openFile(job.filePath!),
        }
      : undefined,
    // Sonner's `cancel` slot doubles as the secondary action;
    // we use it for "show in folder". A folder icon (with title
    // attribute for accessibility) keeps the toast compact —
    // a long French label like "Afficher dans le dossier" was
    // overflowing the cancel-button slot.
    cancel: job.filePath
      ? {
          label: (
            <Folder className="size-4" aria-label={t('queue.openFolder')} />
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
  });
}
