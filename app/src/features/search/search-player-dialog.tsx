import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Download,
  ExternalLink,
  Loader2,
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
import {
  bindMediaPlaybackNative,
  bindVideoBoundsNative,
  isAndroid,
} from '@/lib/android/bridge';
import { useFloatingPlayer } from './use-floating-player';

// Build the `<video>` src. In Tauri we go through the custom URI
// scheme so Rust can replay the matching client User-Agent (the
// CDN 403s otherwise). `convertFileSrc` knows the exact format
// expected by the current Tauri version (https on Windows, custom
// scheme on Linux/macOS). In the browser preview (mock) we use
// the URL the mock returned, which is already a playable mp4.
async function buildVideoSrc(videoId: string, mockUrl: string): Promise<string> {
  if (!isTauri()) return mockUrl;
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  return convertFileSrc(videoId, 'patostream');
}

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
  result: SearchResult | null;
  onClose: () => void;
  onDownload: (r: SearchResult) => void;
  /** Seek to this position (seconds) once the video has metadata.
   *  Used when re-entering the dialog from the floating player or
   *  the background-audio notification. */
  startAt?: number;
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ready'; src: string }
  | { kind: 'error'; message: string };

export function SearchPlayerDialog({ result, onClose, onDownload, startAt = 0 }: SearchPlayerDialogProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  // Continuously tracked playback position. Reading
  // `videoRef.current.currentTime` directly at the moment of a click
  // sometimes returns 0 right after a pipeline-epoch remount (before
  // the resume seek has applied); this ref is updated by `timeupdate`
  // and survives those windows.
  const lastTimeRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Bump on visibility=visible to force-remount the <video> after a
  // screen lock. Chromium's media pipeline gets stuck in a broken
  // state when the WebView is suspended mid-stream — the symptom
  // is the dreaded "MEDIA_ERR_NETWORK pipeline error read" on the
  // next play. A fresh element with a fresh patostream:// request
  // is the cleanest cure.
  const [pipelineEpoch, setPipelineEpoch] = useState(0);
  // PiP triggers a hidden→visible visibilitychange when the floating
  // window appears. Remounting then would restart playback from 0,
  // so we skip the epoch bump while in PiP.
  const inPipRef = useRef(false);
  // Stash position+playing state right before a remount so the fresh
  // <video> can resume where the old one left off (loadedmetadata).
  const resumeRef = useRef<{ time: number; playing: boolean } | null>(null);

  useEffect(() => {
    if (!isAndroid()) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (inPipRef.current) return;
      const v = videoRef.current;
      if (v && v.readyState > 0) {
        resumeRef.current = { time: v.currentTime, playing: !v.paused };
      }
      setPipelineEpoch((e) => e + 1);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    const prev = window.__patotubeOnPip;
    window.__patotubeOnPip = (inPip: boolean) => {
      inPipRef.current = inPip;
      try {
        prev?.(inPip);
      } catch {
        /* downstream handler errors — silent */
      }
    };
    return () => {
      window.__patotubeOnPip = prev;
    };
  }, []);

  // Hook native bridge so Android keeps audio alive in background
  // (foreground service + WAKE_LOCK), then tracks media playing
  // state for PiP decisions.
  useEffect(() => bindMediaPlaybackNative(videoRef.current), [state.kind, pipelineEpoch]);
  // Feed real video dimensions + on-screen rect to Kotlin → PiP
  // matches the actual aspect ratio and animates from this spot.
  useEffect(() => bindVideoBoundsNative(videoRef.current), [state.kind, pipelineEpoch]);

  // Opening the dialog while a floating player is up would double the
  // <video> elements (and the patostream:// requests). Close the
  // floating first, atomically.
  useEffect(() => {
    if (!result) return;
    if (useFloatingPlayer.getState().result) {
      useFloatingPlayer.getState().close();
    }
  }, [result]);

  // Apply external `startAt` (re-entry from floating / notif) as a
  // pending resume — the actual seek happens on loadedmetadata/canplay
  // since the freshly mounted <video> isn't seekable yet.
  useEffect(() => {
    if (!result) return;
    if (startAt > 0.25) {
      resumeRef.current = { time: startAt, playing: true };
      lastTimeRef.current = startAt;
    }
  }, [result, startAt]);

  // Slow-load toast: if we stay in "loading" for more than ~5 s, the
  // user is likely thinking the click did nothing. Tell them it's
  // still working. Auto-dismisses when state flips or dialog closes.
  useEffect(() => {
    if (!result || state.kind !== 'loading') return;
    const id = setTimeout(() => {
      toast.message(t('search.slowLoading'));
    }, 5000);
    return () => clearTimeout(id);
  }, [result, state.kind, t]);

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const api = await getTauri();
        // Always pre-resolve so the Rust proxy cache is warm AND so
        // we surface a clean error (unplayable / age-gated / etc.)
        // before mounting the <video> tag. The bypass we tried for
        // bg-audio resumes was unstable when the proxy cache had
        // expired or never seen the video — the <video> would mount
        // on a patostream:// that 500'd → MEDIA_ERR_PIPELINE.
        const mockUrl = await api.getYoutubeStreamUrl(result.videoId);
        if (cancelled) return;
        const src = await buildVideoSrc(result.videoId, mockUrl);
        setState({ kind: 'ready', src });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ kind: 'error', message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [result]);

  /** Best estimate of the current playback position, robust to the
   *  WebView reporting 0 right after a pipelineEpoch remount. */
  const readPlaybackPosition = (): number => {
    const live = videoRef.current?.currentTime ?? 0;
    return Math.max(live, lastTimeRef.current);
  };

  /** Pause the dialog <video> before swapping modes. Crucially we
   *  do NOT removeAttribute('src')+load() — that leaves the WebView's
   *  media pipeline in a zombie state that bleeds MEDIA_ERR_DECODE
   *  into the next <video> mounted on the same patostream:// URL.
   *  React's unmount + GC cleans up properly when given a tick. */
  const detachVideoSafely = () => {
    const v = videoRef.current;
    if (!v) return;
    try { v.pause(); } catch { /* silent */ }
  };

  const onPip = () => {
    if (!result || state.kind !== 'ready') return;
    const at = readPlaybackPosition();
    const src = state.src;
    const snapshot = result;
    const tid = toast.loading(t('search.switchingPlayer'), { duration: 2000 });
    detachVideoSafely();
    onClose();
    // Tick-delay so the dialog <video> is fully gone before the
    // floating <video> mounts on the same patostream:// URL.
    setTimeout(() => {
      try {
        useFloatingPlayer.getState().open(snapshot, src, at);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[patotube] dialog → floating failed', e);
      } finally {
        // dismiss as soon as the new player is mounted (it'll show
        // its own poster / loading state from here).
        setTimeout(() => toast.dismiss(tid), 250);
      }
    }, 80);
  };

  const onBackgroundAudio = async () => {
    if (!result) return;
    const snapshot = result;
    try {
      const api = await getTauri();
      const stream = await api.getYoutubeNativeStream(snapshot.videoId);
      const posMs = Math.floor(readPlaybackPosition() * 1000);
      detachVideoSafely();
      window.PatoMobile?.startBackgroundAudio?.(
        stream.url,
        stream.userAgent,
        snapshot.videoId,
        snapshot.title,
        snapshot.thumbnailUrl,
        posMs,
      );
      // Close the dialog — the native MediaPlayer is now the source
      // of audio truth. Survives screen lock, app close, anything
      // short of a force-stop. User taps the notification to come
      // back to the app.
      onClose();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[patotube] background audio failed:', err);
    }
  };

  return (
    <Dialog open={!!result} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {result && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base leading-snug line-clamp-2 pr-6">
                {result.title}
              </DialogTitle>
            </DialogHeader>

            <div className="relative aspect-video overflow-hidden rounded-md bg-black">
              {state.kind === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
                  <Loader2 className="size-6 animate-spin" />
                  {t('search.playerLoading')}
                </div>
              )}
              {state.kind === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-white/80">
                  <AlertTriangle className="size-6 text-amber-400" />
                  <p className="font-medium">{t('search.playerFailed')}</p>
                  <p className="text-xs text-white/60 line-clamp-2">{state.message}</p>
                </div>
              )}
              {state.kind === 'ready' && (
                <video
                  ref={videoRef}
                  // pipelineEpoch in the key forces a remount after
                  // a screen lock so we don't reuse a stuck pipeline.
                  key={`${state.src}#${pipelineEpoch}`}
                  src={state.src}
                  controls
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture={false}
                  // Only autoPlay when there's no resume position —
                  // otherwise the playback would race the seek and
                  // restart at 0. With a pending seek, we trigger
                  // play() explicitly from onLoadedMetadata.
                  autoPlay={startAt <= 0.25 && !(resumeRef.current && resumeRef.current.time > 0.25)}
                  playsInline
                  preload="metadata"
                  poster={result.thumbnailUrl}
                  className="size-full"
                  onLoadedMetadata={(e) => {
                    const r = resumeRef.current;
                    if (!r) return;
                    const v = e.currentTarget;
                    try {
                      if (r.time > 0.25) v.currentTime = r.time;
                      if (r.playing) void v.play();
                    } catch {
                      /* seek/play can race on a half-attached element — silent */
                    }
                  }}
                  onCanPlay={(e) => {
                    // Some patostream:// responses don't expose ranges
                    // until they've buffered past the metadata box.
                    // Retry the seek here once `seekable` actually has
                    // a valid range — fixes the "restarts at 0 when
                    // jumping to floating" bug.
                    const r = resumeRef.current;
                    if (!r) return;
                    const v = e.currentTarget;
                    try {
                      if (r.time > 0.25 && Math.abs(v.currentTime - r.time) > 0.5) {
                        v.currentTime = r.time;
                      }
                      if (r.playing) void v.play();
                    } catch {
                      /* silent */
                    } finally {
                      resumeRef.current = null;
                    }
                  }}
                  onTimeUpdate={(e) => {
                    lastTimeRef.current = e.currentTarget.currentTime;
                  }}
                  onError={(e) => {
                    const v = e.currentTarget;
                    const err = v.error;
                    const codes: Record<number, string> = {
                      1: 'MEDIA_ERR_ABORTED',
                      2: 'MEDIA_ERR_NETWORK',
                      3: 'MEDIA_ERR_DECODE',
                      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
                    };
                    const label = err ? codes[err.code] ?? `code ${err.code}` : 'unknown';
                    setState({
                      kind: 'error',
                      message: err?.message ? `${label}: ${err.message}` : label,
                    });
                  }}
                />
              )}
            </div>

            {result.channel && (
              <p className="text-xs text-muted-foreground">{result.channel}</p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {isAndroid() && (
                <>
                  <Button
                    variant="ghost"
                    onClick={onPip}
                    title={t('search.toPip')}
                    aria-label={t('search.toPip')}
                  >
                    <PictureInPicture className="size-4" />
                    {t('search.toPip')}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void onBackgroundAudio()}
                    title={t('search.toBackgroundAudio')}
                    aria-label={t('search.toBackgroundAudio')}
                  >
                    <Headphones className="size-4" />
                    {t('search.toBackgroundAudio')}
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  void openExternal(`https://www.youtube.com/watch?v=${result.videoId}`);
                }}
              >
                <ExternalLink className="size-4" />
                {t('search.openOnYoutube')}
              </Button>
              <Button variant="duck" onClick={() => onDownload(result)} className="min-w-32">
                <Download className="size-4" />
                {t('search.downloadThis')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
