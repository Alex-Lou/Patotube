import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Loader2,
  MoreVertical,
  Download,
  Link as LinkIcon,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { isAndroid } from '@/lib/android/bridge';
import { getTauri, isTauri, type SearchResult } from '@/lib/tauri/bindings';

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  /** Direct download — opens the small format-picker modal. */
  onPick: (r: SearchResult) => void;
  /** Open the in-app preview player. */
  onPlay: (r: SearchResult) => void;
}

export function SearchResults({ results, loading, error, onPick, onPlay }: SearchResultsProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t('search.searching')}
      </div>
    );
  }

  if (error) {
    return <div className="py-3 text-sm text-destructive">{error}</div>;
  }

  if (results.length === 0) return null;

  const copyUrl = async (r: SearchResult) => {
    const url = `https://www.youtube.com/watch?v=${r.videoId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('queue.urlCopied'));
      return;
    } catch {
      /* fall through to Tauri clipboard plugin */
    }
    try {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(url);
      toast.success(t('queue.urlCopied'));
    } catch {
      toast.error(t('errors.fetchFailed'));
    }
  };

  const openYoutube = async (r: SearchResult) => {
    const url = `https://www.youtube.com/watch?v=${r.videoId}`;
    // Discreet duck-spinner toast while the OS warms up the YouTube
    // app / browser. Auto-dismisses; we also dismiss explicitly on
    // success so quick launches don't leave it lingering.
    const toastId = toast.loading(t('search.openingYoutube'), {
      icon: (
        <span className="relative inline-block size-5">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-duck border-r-duck/60 animate-spin"
          />
          <img
            src="/patotube.png"
            alt=""
            className="absolute inset-0.5 size-4 object-contain"
            draggable={false}
          />
        </span>
      ),
      duration: 4000,
    });
    try {
      if (isTauri()) {
        const api = await getTauri();
        await api.openPath(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      // Tiny grace period so the user clearly sees the toast appear,
      // even when the OS handler launches instantly.
      setTimeout(() => toast.dismiss(toastId), 800);
    }
  };

  return (
    <AnimatePresence initial={false}>
      <motion.ul
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="space-y-1.5"
        aria-label={t('search.resultsLabel')}
      >
        {results.map((r) => (
          <li
            key={r.videoId}
            className="flex items-stretch gap-2 sm:gap-3 rounded-lg border border-border/40 bg-card/40 p-2 transition hover:border-border hover:bg-muted/60"
          >
            <button
              type="button"
              onClick={() => onPlay(r)}
              aria-label={t('search.play')}
              title={t('search.play')}
              className="group/play relative aspect-video w-28 sm:w-32 shrink-0 overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={r.thumbnailUrl}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
              {r.durationSeconds != null && (
                <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-[10px] font-medium tabular-nums text-white">
                  {formatDuration(r.durationSeconds)}
                </span>
              )}
              {/* Always-visible play hint — tells the user the thumbnail
                  is the preview affordance (rest of the row = download).
                  Brightens on hover for desktop feedback. */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover/play:bg-black/40">
                <span className="flex size-9 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition group-hover/play:bg-black/70 group-hover/play:scale-110">
                  <Play className="size-4 text-white drop-shadow translate-x-px" fill="currentColor" />
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onPick(r)}
              aria-label={t('search.downloadThis')}
              title={t('search.downloadThis')}
              className="flex min-w-0 flex-1 flex-col justify-between py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            >
              <div className="line-clamp-2 text-sm font-medium leading-snug">{r.title}</div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {r.channel && <span className="truncate">{r.channel}</span>}
                {(r.viewCount != null || r.published) && <span aria-hidden>·</span>}
                {r.viewCount != null && (
                  <span className="tabular-nums">
                    {t('search.viewCount', { count: r.viewCount, formatted: formatCount(r.viewCount) })}
                  </span>
                )}
                {r.published && (
                  <>
                    {r.viewCount != null && <span aria-hidden>·</span>}
                    <span>{r.published}</span>
                  </>
                )}
              </div>
            </button>

            <ResultActions
              result={r}
              onDownload={() => onPick(r)}
              onWatch={() => onPlay(r)}
              onCopyUrl={() => void copyUrl(r)}
              onOpenYoutube={() => void openYoutube(r)}
            />
          </li>
        ))}
      </motion.ul>
    </AnimatePresence>
  );
}

interface ResultActionsProps {
  result: SearchResult;
  onDownload: () => void;
  onWatch: () => void;
  onCopyUrl: () => void;
  onOpenYoutube: () => void;
}

/** Touch vs desktop: bottom Sheet on Android (idiomatic action sheet,
 *  no ghost-tap on first item), DropdownMenu on desktop (compact). */
function ResultActions({
  result,
  onDownload,
  onWatch,
  onCopyUrl,
  onOpenYoutube,
}: ResultActionsProps) {
  const { t } = useTranslation();
  const onMobile = isAndroid();

  if (onMobile) {
    return (
      <MobileActions
        title={result.title}
        onDownload={onDownload}
        onWatch={onWatch}
        onCopyUrl={onCopyUrl}
        onOpenYoutube={onOpenYoutube}
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 self-center"
          aria-label={t('files.more')}
          title={t('files.more')}
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={8}
        className="w-44"
      >
        <DropdownMenuItem onSelect={onDownload}>
          <Download className="size-4" />
          {t('search.downloadThis')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onWatch}>
          <Eye className="size-4" />
          {t('search.play')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopyUrl}>
          <LinkIcon className="size-4" />
          {t('queue.copyUrl')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenYoutube}>
          <ExternalLink className="size-4" />
          {t('search.openOnYoutube')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileActions({
  title,
  onDownload,
  onWatch,
  onCopyUrl,
  onOpenYoutube,
}: {
  title: string;
  onDownload: () => void;
  onWatch: () => void;
  onCopyUrl: () => void;
  onOpenYoutube: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const fire = (action: () => void) => () => {
    setOpen(false);
    // Run after the close animation kicks in so the action's modal
    // (if any) doesn't fight the sheet closing.
    setTimeout(action, 120);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 self-center"
          aria-label={t('files.more')}
          title={t('files.more')}
        >
          <MoreVertical className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <SheetTitle className="line-clamp-1 pr-8 text-sm font-medium text-muted-foreground">
          {title}
        </SheetTitle>
        <div className="mt-3 flex flex-col gap-1">
          <ActionRow icon={<Download className="size-5" />} label={t('search.downloadThis')} onClick={fire(onDownload)} />
          <ActionRow icon={<Eye className="size-5" />} label={t('search.play')} onClick={fire(onWatch)} />
          <ActionRow icon={<LinkIcon className="size-5" />} label={t('queue.copyUrl')} onClick={fire(onCopyUrl)} />
          <ActionRow icon={<ExternalLink className="size-5" />} label={t('search.openOnYoutube')} onClick={fire(onOpenYoutube)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors hover:bg-muted active:bg-muted"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
