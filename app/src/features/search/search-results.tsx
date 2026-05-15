import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SearchResult } from '@/lib/tauri/bindings';

interface SearchResultsProps {
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  onPick: (r: SearchResult) => void;
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
            className="flex items-stretch gap-3 rounded-lg border border-border/40 bg-card/40 p-2 transition hover:border-border hover:bg-muted/60"
          >
            <button
              type="button"
              onClick={() => onPlay(r)}
              aria-label={t('search.play')}
              title={t('search.play')}
              className="group/play relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/play:bg-black/40 group-hover/play:opacity-100">
                <Play className="size-7 text-white drop-shadow" fill="currentColor" />
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
          </li>
        ))}
      </motion.ul>
    </AnimatePresence>
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
