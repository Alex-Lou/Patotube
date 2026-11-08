import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, User, ImageOff, Download, Play, HardDrive, AlertTriangle, ListVideo } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { FormatChoice, MediaInfo } from '@/lib/core/types';
import type { SearchResult } from '@/lib/tauri/bindings';
import { useSettings } from '@/lib/core/settings';
import { DEFAULT_AUDIO_BITRATE, estimateSizeBytes, LONG_MEDIA_SECONDS } from '@/lib/core/formats';
import { formatBytes, formatDuration } from '@/lib/utils';
import { isAndroid } from '@/lib/android/bridge';
import { usePlaylistDialog } from './use-playlist-dialog';
import { FormatPicker } from './format-picker';
import { usePlayback } from '@/features/search/use-playback';

/** Pull the videoId from any YouTube URL shape we accept. */
function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.split('/').filter(Boolean)[0] ?? null;
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/^\/(shorts|embed|v|live)\/([^/?]+)/);
      if (m && m[2]) return m[2];
    }
  } catch {
    /* malformed URL — ignore */
  }
  return null;
}

function mediaInfoToSearchResult(info: MediaInfo, videoId: string): SearchResult {
  return {
    videoId,
    title: info.title,
    channel: info.uploader ?? '',
    durationSeconds: typeof info.durationSec === 'number' ? info.durationSec : null,
    thumbnailUrl: info.thumbnail ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    viewCount: null,
    published: null,
  };
}

interface PreviewDialogProps {
  info: MediaInfo | null;
  onClose: () => void;
  onConfirm: (info: MediaInfo, format: FormatChoice) => void;
}

export function PreviewDialog({ info, onClose, onConfirm }: PreviewDialogProps) {
  const { t } = useTranslation();
  const defaultFormat = useSettings((s) => s.defaultFormat);
  const [format, setFormat] = useState<FormatChoice>(defaultFormat);
  const [imgError, setImgError] = useState(false);
  const youtubeId =
    info && info.platform === 'youtube' ? extractYoutubeId(info.url) : null;

  // Audio-only platforms — coerce the format to audio when the
  // resolved track came from SoundCloud, Bandcamp, or Audiomack,
  // regardless of the user's saved default. The picker hides the
  // video radio (see FormatPicker). Internet Archive can be
  // either, so we don't gate it.
  const AUDIO_ONLY_PLATFORMS = new Set(['soundcloud', 'bandcamp', 'audiomack']);
  const audioOnly = !!info && AUDIO_ONLY_PLATFORMS.has(info.platform);
  const estimatedSize = info ? estimateSizeBytes(info.durationSec, format, isAndroid()) : null;
  const isLong = typeof info?.durationSec === 'number' && info.durationSec >= LONG_MEDIA_SECONDS;
  // This video was opened from inside a playlist: offer the whole list.
  const playlistUrl = info?.platform === 'youtube' ? info.playlistUrl : undefined;

  useEffect(() => {
    if (info) {
      const initial: FormatChoice =
        audioOnly && defaultFormat.kind === 'video'
          ? { kind: 'audio', bitrate: DEFAULT_AUDIO_BITRATE }
          : defaultFormat;
      setFormat(initial);
      setImgError(false);
    }
  }, [info, defaultFormat, audioOnly]);

  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        {info && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base leading-snug line-clamp-2 pr-6">
                {info.title}
              </DialogTitle>
            </DialogHeader>

            <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
              {info.thumbnail && !imgError ? (
                youtubeId ? (
                  // Clickable thumbnail → opens the in-app preview
                  // player. Hint to the user that this isn't just a
                  // download dialog — they can watch before commit.
                  <button
                    type="button"
                    onClick={() =>
                      // Player stacks above this dialog; its Download
                      // button just closes it — the real download is
                      // the duck button here.
                      usePlayback.getState().open(mediaInfoToSearchResult(info, youtubeId))
                    }
                    aria-label={t('search.play')}
                    title={t('search.play')}
                    className="group/play absolute inset-0 size-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <img
                      src={info.thumbnail}
                      alt=""
                      className="size-full object-cover no-drag"
                      onError={() => setImgError(true)}
                      draggable={false}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover/play:bg-black/40">
                      <span className="flex size-12 items-center justify-center rounded-full bg-black/55 backdrop-blur-sm transition group-hover/play:bg-black/70 group-hover/play:scale-110">
                        <Play className="size-5 text-white drop-shadow translate-x-px" fill="currentColor" />
                      </span>
                    </div>
                  </button>
                ) : (
                  <img
                    src={info.thumbnail}
                    alt=""
                    className="h-full w-full object-cover no-drag"
                    onError={() => setImgError(true)}
                    draggable={false}
                  />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-8" />
                  <span className="ml-2 text-sm">{t('preview.noThumbnail')}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {info.uploader && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-3.5" />
                  {info.uploader}
                </span>
              )}
              {typeof info.durationSec === 'number' && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  {formatDuration(info.durationSec)}
                </span>
              )}
              {estimatedSize !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <HardDrive className="size-3.5" />
                  {t('preview.estimatedSize', { size: formatBytes(estimatedSize) })}
                </span>
              )}
            </div>

            {isLong && (
              <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {t('preview.longMedia', { duration: formatDuration(info.durationSec!) })}
              </p>
            )}

            <div className="border-t border-border/50 pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('format.label')}
              </h4>
              <FormatPicker
                value={format}
                onChange={setFormat}
                audioOnly={audioOnly}
                platform={info.platform}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {playlistUrl && (
                <Button
                  variant="ghost"
                  className="me-auto"
                  onClick={() => {
                    usePlaylistDialog.getState().open(playlistUrl);
                    onClose();
                  }}
                >
                  <ListVideo className="size-4" />
                  {t('playlist.fromVideo')}
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                {t('preview.cancel')}
              </Button>
              <Button
                variant="duck"
                onClick={() => onConfirm(info, format)}
                className="min-w-32"
              >
                <Download className="size-4" />
                {t('preview.confirm')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
