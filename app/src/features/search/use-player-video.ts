// Everything the dialog and the floating player share about their
// <video>: stream resolution, resume position, remount after a screen
// lock, native keep-alive, mode switches and the hand-off to the
// native background player. The components only own their markup.

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getTauri, isTauri, type SearchResult } from '@/lib/tauri/bindings';
import { bindMediaPlaybackNative, hasBackgroundAudio, isAndroid } from '@/lib/android/bridge';
import { handoffToBackground } from './player-handoff';
import { SWITCH_DELAY_MS, usePlayback, type VisibleMode } from './use-playback';

export type StreamState =
  | { kind: 'loading' }
  | { kind: 'ready'; src: string }
  | { kind: 'error'; message: string };

/** Positions at or below this are treated as "from the start". */
const MIN_RESUME_SEC = 0.25;
const SLOW_LOADING_MS = 5000;

const MEDIA_ERRORS: Record<number, string> = {
  1: 'MEDIA_ERR_ABORTED',
  2: 'MEDIA_ERR_NETWORK',
  3: 'MEDIA_ERR_DECODE',
  4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
};

// In Tauri the <video> goes through the patostream:// scheme so Rust
// can replay the client User-Agent the CDN signed the URL for. In the
// browser preview the mock URL is already playable.
async function buildVideoSrc(videoId: string, mockUrl: string): Promise<string> {
  if (!isTauri()) return mockUrl;
  const { convertFileSrc } = await import('@tauri-apps/api/core');
  return convertFileSrc(videoId, 'patostream');
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function usePlayerVideo(track: SearchResult, startAt: number, mode: VisibleMode) {
  const { t } = useTranslation();
  const [stream, setStream] = useState<StreamState>({ kind: 'loading' });
  const videoRef = useRef<HTMLVideoElement>(null);
  // Last position reported by `timeupdate`. Survives the window right
  // after a remount where `currentTime` still reads 0.
  const lastTimeRef = useRef(startAt);
  // Pending seek/play applied once the (re)mounted <video> has metadata.
  const resumeRef = useRef<{ time: number; playing: boolean } | null>(
    startAt > MIN_RESUME_SEC ? { time: startAt, playing: true } : null,
  );
  // Bumped to force a fresh <video> after a screen lock: Chromium's
  // pipeline gets stuck when the WebView is suspended mid-stream
  // ("MEDIA_ERR_NETWORK pipeline error read" on the next play).
  const [epoch, setEpoch] = useState(0);

  const readPosition = (): number =>
    Math.max(videoRef.current?.currentTime ?? 0, lastTimeRef.current);

  // Never removeAttribute('src') + load(): that leaves the pipeline in
  // a zombie state that breaks the next <video> on the same URL.
  const pauseVideo = () => {
    try {
      videoRef.current?.pause();
    } catch {
      /* element already detached */
    }
  };

  // Resolve first so the Rust proxy cache is warm and a clean error
  // (age-gated, unavailable…) shows before the <video> mounts.
  useEffect(() => {
    let cancelled = false;
    setStream({ kind: 'loading' });
    (async () => {
      try {
        const api = await getTauri();
        const mockUrl = await api.getYoutubeStreamUrl(track.videoId);
        const src = await buildVideoSrc(track.videoId, mockUrl);
        if (!cancelled) setStream({ kind: 'ready', src });
      } catch (err) {
        if (!cancelled) setStream({ kind: 'error', message: errorMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track.videoId]);

  useEffect(() => {
    if (stream.kind !== 'loading') return;
    const id = setTimeout(() => toast.message(t('search.slowLoading')), SLOW_LOADING_MS);
    return () => clearTimeout(id);
  }, [stream.kind, t]);

  // Keeps the WebView alive while playing (foreground service + wake lock).
  useEffect(() => bindMediaPlaybackNative(videoRef.current), [stream.kind, epoch]);

  // Android: fresh <video> when the app comes back (screen-lock cure).
  useEffect(() => {
    if (!isAndroid()) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const v = videoRef.current;
      if (v && v.readyState > 0) {
        resumeRef.current = { time: v.currentTime, playing: !v.paused };
      }
      setEpoch((e) => e + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Android: app backgrounded while playing → native player takes over,
  // and PlayerHost brings this mode back when the app returns. The
  // WebView keeps playing (MainActivity keep-alive) until the native
  // stream is resolved; coming back before that abandons the hand-off.
  useEffect(() => {
    if (!hasBackgroundAudio()) return;
    let attempt = 0;
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') {
        attempt++;
        return;
      }
      const v = videoRef.current;
      if (!v || v.paused) return;
      const mine = ++attempt;
      const stillWanted = () => mine === attempt && document.visibilityState === 'hidden';
      handoffToBackground(track, readPosition, stillWanted)
        .then((started) => {
          if (!started) return;
          pauseVideo();
          usePlayback.getState().toBackground(mode);
        })
        .catch((err) => {
          // The WebView keeps playing on its own (keep-alive); log only.
          // eslint-disable-next-line no-console
          console.warn('[patotube] automatic background hand-off failed:', err);
        });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      attempt++;
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // track / mode are fixed for the life of this player (PlayerHost keys it).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Explicit "Listen in background" button. */
  const goBackground = async () => {
    try {
      const started = await handoffToBackground(track, readPosition);
      if (!started) return;
      pauseVideo();
      usePlayback.getState().toBackground(null);
    } catch (err) {
      toast.error(t('search.backgroundAudioFailed'), { description: errorMessage(err) });
    }
  };

  /** Move the track to the other visible player at the same position. */
  const switchTo = (target: VisibleMode) => {
    const at = readPosition();
    const tid = toast.loading(t('search.switchingPlayer'), { duration: 2000 });
    pauseVideo();
    usePlayback.getState().switchTo(target, at);
    setTimeout(() => toast.dismiss(tid), SWITCH_DELAY_MS + 250);
  };

  const applyResume = (v: HTMLVideoElement, final: boolean) => {
    const r = resumeRef.current;
    if (!r) return;
    try {
      if (r.time > MIN_RESUME_SEC && Math.abs(v.currentTime - r.time) > 0.5) {
        v.currentTime = r.time;
      }
      if (r.playing) void v.play().catch(() => { /* autoplay refused: controls stay usable */ });
    } catch {
      /* seek can race a half-attached element */
    } finally {
      // Some patostream:// responses only become seekable after they
      // buffer past the metadata box, so `canplay` retries the seek.
      if (final) resumeRef.current = null;
    }
  };

  const videoProps = {
    ref: videoRef,
    src: stream.kind === 'ready' ? stream.src : undefined,
    controls: true,
    playsInline: true,
    preload: 'metadata' as const,
    poster: track.thumbnailUrl,
    // With a pending resume, play() is issued after the seek instead,
    // otherwise playback races the seek and restarts at 0.
    autoPlay: resumeRef.current === null,
    onLoadedMetadata: (e: SyntheticEvent<HTMLVideoElement>) => applyResume(e.currentTarget, false),
    onCanPlay: (e: SyntheticEvent<HTMLVideoElement>) => applyResume(e.currentTarget, true),
    onTimeUpdate: (e: SyntheticEvent<HTMLVideoElement>) => {
      lastTimeRef.current = e.currentTarget.currentTime;
    },
    onError: (e: SyntheticEvent<HTMLVideoElement>) => {
      const err = e.currentTarget.error;
      const label = err ? (MEDIA_ERRORS[err.code] ?? `code ${err.code}`) : 'unknown';
      setStream({ kind: 'error', message: err?.message ? `${label}: ${err.message}` : label });
    },
  };

  return {
    stream,
    videoProps,
    /** Key for the <video>: a new epoch forces a fresh element. */
    videoKey: stream.kind === 'ready' ? `${stream.src}#${epoch}` : 'none',
    goBackground,
    switchTo,
  };
}
