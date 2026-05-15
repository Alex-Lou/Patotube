// Built-in mini file manager — Android-only entry from Header.

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Folder,
  RefreshCw,
  Music,
  Film,
  Play,
  Share2,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatBytes } from '@/lib/utils';
import { getTauri } from '@/lib/tauri/bindings';
import type { DownloadEntry } from '@/lib/tauri/bindings';
import {
  isAndroid as isAndroidPlatform,
  hasNativeBridge,
  openFileNative,
  shareFileNative,
} from '@/lib/android/bridge';
import { usePlayerStore } from './player-store';

const IS_ANDROID = isAndroidPlatform();

interface FilesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilesSheet({ open, onOpenChange }: FilesSheetProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<DownloadEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const play = usePlayerStore((s) => s.play);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const api = await getTauri();
      const list = await api.listDownloads();
      setEntries(list);
    } catch (err) {
      toast.error(t('files.loadFailed'), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const open_ = useCallback(
    async (entry: DownloadEntry) => {
      // Android: FileProvider intent, fall back to embedded player.
      if (IS_ANDROID && hasNativeBridge()) {
        if (openFileNative(entry.path)) return;
        play(entry);
        return;
      }
      try {
        const api = await getTauri();
        await api.openPath(entry.path);
      } catch {
        play(entry);
      }
    },
    [play],
  );

  const share = useCallback(
    async (entry: DownloadEntry) => {
      // Android: FileProvider + ACTION_SEND. Web Share API can't share local file URIs in WebView.
      if (IS_ANDROID && hasNativeBridge()) {
        if (shareFileNative(entry.path)) return;
        toast.error(t('files.shareFailed'));
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ title: entry.name, text: entry.name });
        } catch {
          /* user dismissed the share sheet — silent */
        }
        return;
      }
      toast.error(t('files.shareUnavailable'));
    },
    [t],
  );

  const remove = useCallback(
    async (entry: DownloadEntry) => {
      try {
        const api = await getTauri();
        await api.deleteDownload(entry.path);
        setEntries((prev) => prev.filter((e) => e.path !== entry.path));
        toast.success(t('files.deleted'));
      } catch (err) {
        toast.error(t('files.deleteFailed'), {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [t],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[360px] sm:w-[420px]">
          <SheetHeader>
            <SheetTitle className="flex items-center justify-between gap-2 pr-6">
              <span className="inline-flex items-center gap-2">
                <Folder className="size-5" />
                {t('files.title')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => void refresh()}
                aria-label={t('files.refresh')}
                disabled={loading}
              >
                <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
              </Button>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 flex flex-col gap-2 overflow-y-auto pr-1 max-h-[calc(100vh-100px)]">
            {entries.length === 0 && !loading && (
              <p className="mt-8 text-center text-sm text-muted-foreground">
                {t('files.empty')}
              </p>
            )}
            {entries.map((entry) => (
              <FileRow
                key={entry.path}
                entry={entry}
                onOpen={() => void open_(entry)}
                onShare={() => void share(entry)}
                onDelete={() => void remove(entry)}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
  );
}

function FileRow({
  entry,
  onOpen,
  onShare,
  onDelete,
}: {
  entry: DownloadEntry;
  onOpen: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const Icon = entry.mimeKind === 'video' ? Film : Music;
  const dateLabel = entry.mtime > 0 ? formatRelativeDate(entry.mtime) : '';

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3 hover:border-border hover:bg-accent/40 transition-colors">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-medium" title={entry.name}>
          {entry.name}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatBytes(entry.size)} {dateLabel && `· ${dateLabel}`}
        </p>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={onOpen}
        aria-label={t('files.open')}
      >
        <Play className="size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t('files.more')}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem] p-1.5">
          <DropdownMenuItem
            onClick={onShare}
            className="gap-3 px-3 py-2.5 text-sm cursor-pointer"
          >
            <Share2 className="size-4" />
            {t('files.share')}
          </DropdownMenuItem>
          <div className="my-1 h-px bg-border/60" />
          <DropdownMenuItem
            onClick={onDelete}
            className="gap-3 px-3 py-2.5 text-sm cursor-pointer text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4" />
            {t('files.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** One-off formatter; avoids Intl.RelativeTimeFormat for Android bundle saving. */
function formatRelativeDate(unixSeconds: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(unixSeconds * 1000).toLocaleDateString();
}
