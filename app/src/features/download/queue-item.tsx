import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Folder,
  X,
  RotateCw,
  Film,
  Music,
  Clock,
  Play,
  Link2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn, formatBytes, formatDuration } from '@/lib/utils';
import type { DownloadJob, JobStatus } from '@/lib/core/types';
import { PlatformBadge } from './platform-badge';
import {
  isAndroid as isAndroidPlatform,
  openFileNative,
  openDownloadsFolderNative,
  hasNativeBridge,
} from '@/lib/android/bridge';
import { friendlyError } from '@/lib/core/errors';

const IS_ANDROID = isAndroidPlatform();

interface QueueItemProps {
  job: DownloadJob;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onShowInFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
}

const STATUS_TONE: Record<JobStatus, string> = {
  pending: 'text-muted-foreground',
  downloading: 'text-primary',
  converting: 'text-primary',
  done: 'text-success',
  failed: 'text-destructive',
};

export function QueueItem({
  job,
  onRemove,
  onRetry,
  onShowInFolder,
  onOpenFile,
}: QueueItemProps) {
  const { t } = useTranslation();
  const { info, format, status, progress, speedBps, etaSec, error, filePath } = job;

  // Format label honestly reflects what the user actually gets.
  // Per-platform overrides for audio because each kernel ships
  // its own native format:
  //   - SoundCloud → MP3 (server-side libmp3lame)
  //   - Bandcamp → MP3-128 (free-tier preview)
  //   - Audiomack → MP3 (their API serves it directly)
  //   - Internet Archive → varies (might be ogg/flac/mp4) — we
  //     just label it generically; the file extension on disk
  //     tells the user the truth.
  //   - YouTube on Android → M4A AAC (no transcoder)
  //   - YouTube on desktop → MP3 + bitrate (yt-dlp+ffmpeg)
  const formatLabel = (() => {
    if (format.kind === 'video') {
      return `MP4 · ${t(`format.${format.quality}`)}`;
    }
    switch (info.platform) {
      case 'soundcloud':
        return 'MP3 · SoundCloud';
      case 'bandcamp':
        return 'MP3 · 128k';
      case 'audiomack':
        return 'MP3 · Audiomack';
      case 'archive':
        return 'Audio · Archive';
      default:
        return IS_ANDROID ? 'M4A · AAC' : `MP3 · ${format.bitrate}k`;
    }
  })();
  const FormatIcon = format.kind === 'video' ? Film : Music;

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
          {/* Smaller thumbnail on mobile so the action buttons +
              title don't fight over a ~360 px viewport. We were
              eating ~250 px in fixed chrome (w-28 thumb + 4×size-8
              buttons), leaving the title with ~100 px and a
              "Se fa..." truncation. */}
          <div className="aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-muted sm:w-28 md:w-32">
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
            {/* The title doubles as a "play" hotspot once the
                download is done — clicking it opens the file in
                the user's default player. While the job is in
                flight, it stays a plain non-interactive label
                so we don't mislead the user with a hand cursor
                on something they can't yet act on. */}
            {status === 'done' && filePath ? (
              <button
                type="button"
                onClick={async () => {
                  if (IS_ANDROID && hasNativeBridge()) {
                    if (!openFileNative(filePath)) {
                      openDownloadsFolderNative();
                    }
                    return;
                  }
                  try {
                    await onOpenFile(filePath);
                  } catch (err) {
                    toast.error(t('errors.couldNotOpenFile'), {
                      description:
                        err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
                className="block w-full truncate text-left text-sm font-medium hover:text-primary cursor-pointer transition-colors"
                title={t('queue.openFile')}
              >
                {info.title}
              </button>
            ) : (
              <p className="truncate text-sm font-medium" title={info.title}>
                {info.title}
              </p>
            )}

            {/* Metadata row: platform · format · quality · duration */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <PlatformBadge platform={info.platform} />
              <span className="inline-flex items-center gap-1">
                <FormatIcon className="size-3" />
                {formatLabel}
              </span>
              {typeof info.durationSec === 'number' && info.durationSec > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatDuration(info.durationSec)}
                </span>
              )}
            </div>

            {/* Status + action row. On mobile we drop the status
                label onto the same line as the actions to save a
                full row of vertical space, and we only show the
                terminal-state actions (open file, retry) — the
                "copy URL" link icon moves below to avoid a cramped
                4-icon row competing with the title above. */}
            <div className="flex items-center justify-between gap-2">
              <StatusLabel status={status} />

              <div className="flex shrink-0 items-center gap-0.5">
                {/* Copy source URL — useful at any status. */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(info.url);
                      toast.success(t('queue.urlCopied'));
                    } catch {
                      // Fallback via Tauri clipboard plugin (the
                      // browser API can be blocked in WebView).
                      try {
                        const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
                        await writeText(info.url);
                        toast.success(t('queue.urlCopied'));
                      } catch {
                        toast.error(t('errors.couldNotOpenFile'));
                      }
                    }
                  }}
                  aria-label={t('queue.copyUrl')}
                  title={t('queue.copyUrl')}
                >
                  <Link2 className="size-4" />
                </Button>
                {status === 'done' && filePath && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={async () => {
                        // Android: native FileProvider + ACTION_VIEW.
                        if (IS_ANDROID && hasNativeBridge()) {
                          if (openFileNative(filePath)) return;
                          toast.error(t('errors.couldNotOpenFile'));
                          return;
                        }
                        try {
                          await onOpenFile(filePath);
                        } catch (err) {
                          toast.error(t('errors.couldNotOpenFile'), {
                            description:
                              err instanceof Error ? err.message : String(err),
                          });
                        }
                      }}
                      aria-label={t('queue.openFile')}
                      title={t('queue.openFile')}
                    >
                      <Play className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={async () => {
                        // Android: open the system Downloads folder.
                        if (IS_ANDROID && hasNativeBridge()) {
                          if (openDownloadsFolderNative()) return;
                          toast.error(t('errors.couldNotOpenFolder'));
                          return;
                        }
                        try {
                          await onShowInFolder(filePath);
                        } catch (err) {
                          toast.error(t('errors.couldNotOpenFolder'), {
                            description:
                              err instanceof Error ? err.message : String(err),
                          });
                        }
                      }}
                      aria-label={t('queue.openFolder')}
                      title={t('queue.openFolder')}
                    >
                      <Folder className="size-4" />
                    </Button>
                  </>
                )}
                {status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onRetry(job.id)}
                    aria-label={t('queue.retry')}
                  >
                    <RotateCw className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
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
                <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                  <span>{progress.toFixed(0)}%</span>
                  <div className="flex items-center gap-3">
                    {typeof speedBps === 'number' && speedBps > 0 && (
                      <span>{formatBytes(speedBps)}/s</span>
                    )}
                    {typeof etaSec === 'number' && etaSec > 0 && (
                      <span>ETA {formatDuration(etaSec)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {status === 'failed' && error && (
              <p className="line-clamp-2 text-xs text-destructive/90">
                {friendlyError(error, t) ?? error}
              </p>
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
