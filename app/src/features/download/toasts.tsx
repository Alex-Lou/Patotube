// Terminal-state download toasts. Sonner dedupes by `id` to avoid
// duplicates when Rust re-emits the same status.

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

/** Android has no reveal-in-folder intent, so we open the file via
 *  FileProvider (falls back to the Downloads folder). */
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
    // Ghost icon override applied via global classNames (App.tsx → actionButton).
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

/** Last path segment for both POSIX and Windows separators. */
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
    // One-tap retry: most failures are transient (network, YT cipher, etc.).
    duration: 14000,
    action: {
      label: <RotateCw className="size-4" aria-label={t('queue.retry')} />,
      onClick: () => {
        void retryJob(jobId);
      },
    },
  });
}
