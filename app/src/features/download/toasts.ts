// Toasts that fire when a download lands in a terminal state. Sonner
// dedupes on the `id` field so re-emissions of the same status from
// the Rust side don't multiply the notification.

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

export function showSuccessToast(jobId: string, job: DownloadJob, t: TFunc): void {
  const onAndroid = isAndroid() && hasNativeBridge();
  toast.success(t('toast.completed', { title: job.info.title }), {
    id: `dl-done-${jobId}`,
    description: job.filePath ?? undefined,
    duration: 12000,
    action: job.filePath
      ? {
          label: t('queue.openFile'),
          onClick: () => {
            const filePath = job.filePath!;
            if (onAndroid) {
              if (!openFileNative(filePath)) {
                openDownloadsFolderNative();
              }
            } else {
              void getTauri().then((api) => api.openPath(filePath));
            }
          },
        }
      : undefined,
  });
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
