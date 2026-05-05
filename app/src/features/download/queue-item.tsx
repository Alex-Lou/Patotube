import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Folder,
  X,
  RotateCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn, formatBytes } from '@/lib/utils';
import type { DownloadJob, JobStatus } from '@/lib/core/types';
import { PlatformBadge } from './platform-badge';

interface QueueItemProps {
  job: DownloadJob;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onShowInFolder: (path: string) => void;
}

const STATUS_TONE: Record<JobStatus, string> = {
  pending: 'text-muted-foreground',
  downloading: 'text-primary',
  converting: 'text-primary',
  done: 'text-success',
  failed: 'text-destructive',
};

export function QueueItem({ job, onRemove, onRetry, onShowInFolder }: QueueItemProps) {
  const { t } = useTranslation();
  const { info, status, progress, speedBps, error, filePath } = job;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-3">
        <div className="flex items-start gap-3">
          <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted">
            {info.thumbnail && (
              <img
                src={info.thumbnail}
                alt=""
                className="h-full w-full object-cover no-drag"
                draggable={false}
              />
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={info.title}>
                  {info.title}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <PlatformBadge platform={info.platform} />
                  <StatusLabel status={status} />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {status === 'done' && filePath && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onShowInFolder(filePath)}
                    aria-label={t('queue.openFolder')}
                    title={t('queue.openFolder')}
                  >
                    <Folder className="size-4" />
                  </Button>
                )}
                {status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => onRetry(job.id)}
                    aria-label={t('queue.retry')}
                  >
                    <RotateCw className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => onRemove(job.id)}
                  aria-label={t('queue.remove')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {(status === 'downloading' || status === 'converting') && (
              <div className="space-y-1">
                <Progress value={progress} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress.toFixed(0)}%</span>
                  {typeof speedBps === 'number' && speedBps > 0 && (
                    <span>{formatBytes(speedBps)}/s</span>
                  )}
                </div>
              </div>
            )}

            {status === 'failed' && error && (
              <p className="line-clamp-2 text-xs text-destructive/90">{error}</p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function StatusLabel({ status }: { status: JobStatus }) {
  const { t } = useTranslation();
  const Icon =
    status === 'done'
      ? CheckCircle2
      : status === 'failed'
        ? AlertCircle
        : status === 'downloading' || status === 'converting'
          ? Loader2
          : null;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', STATUS_TONE[status])}>
      {Icon && (
        <Icon
          className={cn(
            'size-3',
            (status === 'downloading' || status === 'converting') && 'animate-spin',
          )}
        />
      )}
      {t(`queue.${status}`)}
    </span>
  );
}
