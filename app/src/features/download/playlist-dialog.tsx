// YouTube playlist picker: lists the videos (backend caps the count),
// lets the user untick some, picks one format for all, and queues each
// video as a normal download job. The queue runs them a few at a time.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Download, ListVideo, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getTauri, type PlaylistInfo, type SearchResult } from '@/lib/tauri/bindings';
import type { FormatChoice, MediaInfo } from '@/lib/core/types';
import { useSettings } from '@/lib/core/settings';
import { estimateSizeBytes } from '@/lib/core/formats';
import { isAndroid } from '@/lib/android/bridge';
import { formatBytes, formatDuration } from '@/lib/utils';
import { FormatPicker } from './format-picker';
import { enqueueJob } from './actions';
import { usePlaylistDialog } from './use-playlist-dialog';

/** Max videos the backend lists (youtube_kernel::playlist::MAX_PLAYLIST_ITEMS). */
const MAX_PLAYLIST_ITEMS = 25;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; playlist: PlaylistInfo };

function toMediaInfo(entry: SearchResult): MediaInfo {
  return {
    url: `https://www.youtube.com/watch?v=${entry.videoId}`,
    title: entry.title,
    uploader: entry.channel || undefined,
    durationSec: entry.durationSeconds ?? undefined,
    thumbnail: entry.thumbnailUrl,
    platform: 'youtube',
  };
}

export function PlaylistDialog() {
  const { t } = useTranslation();
  const url = usePlaylistDialog((s) => s.url);
  const close = usePlaylistDialog((s) => s.close);
  const defaultFormat = useSettings((s) => s.defaultFormat);
  const [format, setFormat] = useState<FormatChoice>(defaultFormat);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    setFormat(defaultFormat);
    (async () => {
      try {
        const api = await getTauri();
        const playlist = await api.fetchYoutubePlaylist(url);
        if (cancelled) return;
        setSelected(new Set(playlist.entries.map((e) => e.videoId)));
        setState({ kind: 'ready', playlist });
      } catch (err) {
        if (!cancelled) {
          setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // defaultFormat is only the starting value for a newly opened playlist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const entries = state.kind === 'ready' ? state.playlist.entries : [];
  const chosen = entries.filter((e) => selected.has(e.videoId));
  const allSelected = entries.length > 0 && chosen.length === entries.length;
  const totalSize = chosen.reduce(
    (sum, e) => sum + (estimateSizeBytes(e.durationSeconds ?? undefined, format, isAndroid()) ?? 0),
    0,
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onDownload = () => {
    // In playlist order; the queue starts them oldest first.
    for (const entry of chosen) void enqueueJob(toMediaInfo(entry), format);
    toast.success(t('playlist.added', { count: chosen.length }));
    close();
  };

  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6 text-base leading-snug">
            <ListVideo className="size-4 shrink-0 text-duck" />
            <span className="line-clamp-2">
              {state.kind === 'ready' ? state.playlist.title : t('playlist.loading')}
            </span>
          </DialogTitle>
        </DialogHeader>

        {state.kind === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('playlist.loading')}
          </div>
        )}

        {state.kind === 'error' && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm">
            <AlertTriangle className="size-6 text-amber-400" />
            <p className="font-medium">{t('playlist.failed')}</p>
            <p className="text-xs text-muted-foreground">{state.message}</p>
          </div>
        )}

        {state.kind === 'ready' && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t('playlist.selected', { selected: chosen.length, total: entries.length })}
              </span>
              <button
                type="button"
                className="font-medium text-duck hover:underline"
                onClick={() =>
                  setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.videoId)))
                }
              >
                {allSelected ? t('playlist.selectNone') : t('playlist.selectAll')}
              </button>
            </div>

            <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {entries.map((e, i) => (
                <li key={e.videoId}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-duck"
                      checked={selected.has(e.videoId)}
                      onChange={() => toggle(e.videoId)}
                    />
                    <span className="w-5 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                      {i + 1}
                    </span>
                    <img
                      src={e.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="h-9 w-16 shrink-0 rounded object-cover"
                      draggable={false}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                    {e.durationSeconds !== null && (
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                        {formatDuration(e.durationSeconds)}
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>

            {state.playlist.truncated && (
              <p className="text-xs text-muted-foreground">
                {t('playlist.truncated', { max: MAX_PLAYLIST_ITEMS })}
              </p>
            )}

            <div className="space-y-3 border-t border-border/50 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('format.label')}
              </h4>
              <FormatPicker value={format} onChange={setFormat} platform="youtube" />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <span className="text-xs text-muted-foreground">
                {totalSize > 0 && t('playlist.totalSize', { size: formatBytes(totalSize) })}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={close}>
                  {t('preview.cancel')}
                </Button>
                <Button
                  variant="duck"
                  onClick={onDownload}
                  disabled={chosen.length === 0}
                  className="min-w-32"
                >
                  <Download className="size-4" />
                  {t('playlist.download', { count: chosen.length })}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
