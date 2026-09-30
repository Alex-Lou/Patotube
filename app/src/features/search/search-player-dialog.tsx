import { useTranslation } from 'react-i18next';
import {
  Download,
  ExternalLink,
  AlertTriangle,
  PictureInPicture,
  Headphones,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getTauri, isTauri, type SearchResult } from '@/lib/tauri/bindings';
import { hasBackgroundAudio, isAndroid } from '@/lib/android/bridge';
import { usePlayback } from './use-playback';
import { usePlayerVideo } from './use-player-video';

/** Open a URL in the OS default handler (YouTube app on Android if
 *  installed, system browser otherwise). `<a target="_blank">` inside
 *  a Tauri WebView is a no-op — we have to hop through Rust. */
async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const api = await getTauri();
      await api.openPath(url);
      return;
    } catch {
      /* fall through to window.open below */
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface SearchPlayerDialogProps {
  track: SearchResult;
  /** Seek to this position (seconds) once the video has metadata. */
  startAt: number;
}

/** Full player. Mounted by PlayerHost while the playback mode is
 *  `dialog`; closing it ends playback. */
export function SearchPlayerDialog({ track, startAt }: SearchPlayerDialogProps) {
  const { t } = useTranslation();
  const onDownload = usePlayback((s) => s.onDownload);
  const close = usePlayback((s) => s.close);
  const { stream, videoProps, videoKey, goBackground, switchTo } = usePlayerVideo(
    track,
    startAt,
    'dialog',
  );

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base leading-snug line-clamp-2 pr-6">
            {track.title}
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-video overflow-hidden rounded-md bg-black">
          {stream.kind === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center text-sm text-white/80">
              {/* Branded loader: the duck inside a spinning ring so a
                  slow YouTube resolve reads as "working", not stuck. */}
              <span className="relative inline-block size-16">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-duck border-r-duck/50 animate-spin"
                />
                <img
                  src="/patotube.png"
                  alt=""
                  className="absolute inset-2 object-contain"
                  draggable={false}
                />
              </span>
              <p className="font-medium">{t('search.playerLoading')}</p>
              <p className="text-xs text-white/50">{t('search.fetchingFromYoutube')}</p>
            </div>
          )}
          {stream.kind === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/80">
              <AlertTriangle className="size-6 text-amber-400" />
              <p className="font-medium">{t('search.playerFailed')}</p>
              <p className="text-xs text-white/60 line-clamp-2">{stream.message}</p>
            </div>
          )}
          {stream.kind === 'ready' && (
            <video
              key={videoKey}
              {...videoProps}
              controlsList="nodownload noplaybackrate"
              className="size-full"
            />
          )}
        </div>

        {track.channel && <p className="text-xs text-muted-foreground">{track.channel}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {isAndroid() && (
            <Button
              variant="ghost"
              onClick={() => switchTo('floating')}
              disabled={stream.kind !== 'ready'}
              title={t('search.toPip')}
              aria-label={t('search.toPip')}
            >
              <PictureInPicture className="size-4" />
              {t('search.toPip')}
            </Button>
          )}
          {hasBackgroundAudio() && (
            <Button
              variant="ghost"
              onClick={() => void goBackground()}
              title={t('search.toBackgroundAudio')}
              aria-label={t('search.toBackgroundAudio')}
            >
              <Headphones className="size-4" />
              {t('search.toBackgroundAudio')}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              void openExternal(`https://www.youtube.com/watch?v=${track.videoId}`);
            }}
          >
            <ExternalLink className="size-4" />
            {t('search.openOnYoutube')}
          </Button>
          <Button
            variant="duck"
            onClick={() => (onDownload ? onDownload(track) : close())}
            className="min-w-32"
          >
            <Download className="size-4" />
            {t('search.downloadThis')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
