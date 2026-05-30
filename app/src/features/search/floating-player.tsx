import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Maximize2, X, GripVertical, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTauri } from '@/lib/tauri/bindings';
import { useFloatingPlayer } from './use-floating-player';
import { usePlayerDialog } from './use-player-dialog';

const WIDTH = 200;
const MARGIN = 12;
const HANDLE_HEIGHT = 28;

export function FloatingPlayer() {
  const { t } = useTranslation();
  const result = useFloatingPlayer((s) => s.result);
  const src = useFloatingPlayer((s) => s.src);
  const startAt = useFloatingPlayer((s) => s.startAt);
  const close = useFloatingPlayer((s) => s.close);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    pointerStartX: number;
    pointerStartY: number;
    posStartX: number;
    posStartY: number;
  } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTimeRef = useRef(startAt);
  const bgHandoffActive = useRef(false);
  const originalMutedRef = useRef(false);

  // Anchor bottom-right on first open of a fresh session.
  useEffect(() => {
    if (!result || pos) return;
    setPos({
      x: window.innerWidth - WIDTH - MARGIN,
      y: Math.max(MARGIN, window.innerHeight - 220),
    });
  }, [result, pos]);

  // Reset transient state when the player closes.
  useEffect(() => {
    if (result) return;
    setPos(null);
    lastTimeRef.current = 0;
  }, [result]);

  // When the app gets backgrounded the WebView's audio decoder is
  // suspended by Android — handoff to the native foreground service
  // so the user can keep listening. Resume on return.
  useEffect(() => {
    if (!result) return;
    const handoffOut = async () => {
      if (bgHandoffActive.current) return;
      const v = videoRef.current;
      if (!v || v.paused) return;
      try {
        const api = await getTauri();
        const stream = await api.getYoutubeNativeStream(result.videoId);
        const posMs = Math.floor((v.currentTime || lastTimeRef.current) * 1000);
        window.PatoMobile?.startBackgroundAudio?.(
          stream.url,
          stream.userAgent,
          result.videoId,
          result.title,
          result.thumbnailUrl,
          posMs,
        );
        bgHandoffActive.current = true;
        originalMutedRef.current = v.muted;
        v.muted = true;
      } catch {
        /* falling back to WebView's best effort */
      }
    };
    const handoffBack = () => {
      if (!bgHandoffActive.current) return;
      window.PatoMobile?.stopBackgroundAudio?.();
      bgHandoffActive.current = false;
      const v = videoRef.current;
      if (v) v.muted = originalMutedRef.current;
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') void handoffOut();
      else handoffBack();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      handoffBack();
    };
  }, [result]);

  if (!result || !src) return null;

  const onDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture can fail on rapid re-mounts — fall through */
    }
    dragRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      posStartX: pos?.x ?? 0,
      posStartY: pos?.y ?? 0,
    };
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    // Keep at least the close button visible inside the viewport so
    // the player is never unreachable.
    const maxX = window.innerWidth - 40;
    const maxY = window.innerHeight - HANDLE_HEIGHT;
    setPos({
      x: Math.min(maxX, Math.max(40 - WIDTH, d.posStartX + (e.clientX - d.pointerStartX))),
      y: Math.min(maxY, Math.max(0, d.posStartY + (e.clientY - d.pointerStartY))),
    });
  };

  const onDragUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const readPos = () => {
    const live = videoRef.current?.currentTime ?? 0;
    return Math.max(live, lastTimeRef.current);
  };

  /** Pause the floating <video> before swapping modes. We do NOT
   *  call removeAttribute('src')+load() — that puts the WebView's
   *  decoder into a zombie state that bleeds into the next <video>
   *  mounted on the same patostream:// URL (MEDIA_ERR_DECODE on
   *  the new player). React's unmount + GC cleans up properly when
   *  given a tick to run. */
  const detachVideoSafely = () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.pause();
    } catch {
      /* element may already be detached */
    }
  };

  const onExpandToDialog = () => {
    const at = readPos();
    const snapshot = result;
    const tid = toast.loading(t('search.switchingPlayer'), { duration: 2000 });
    detachVideoSafely();
    close();
    // Delay the dialog open by a tick so React fully unmounts this
    // <video> before the dialog mounts its own. Two <video>s on the
    // same patostream:// in the same paint frame = WebView crash.
    setTimeout(() => {
      try {
        usePlayerDialog.getState().open(snapshot, at);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[patotube] expand to dialog failed', e);
      } finally {
        setTimeout(() => toast.dismiss(tid), 250);
      }
    }, 80);
  };

  const onListenInBackground = async () => {
    const snapshot = result;
    try {
      const api = await getTauri();
      const stream = await api.getYoutubeNativeStream(snapshot.videoId);
      const posMs = Math.floor(readPos() * 1000);
      detachVideoSafely();
      window.PatoMobile?.startBackgroundAudio?.(
        stream.url,
        stream.userAgent,
        snapshot.videoId,
        snapshot.title,
        snapshot.thumbnailUrl,
        posMs,
      );
      // Same tick-delay rationale as expand: let the <video> finish
      // tearing down so the bg-audio session has the patostream://
      // proxy to itself.
      setTimeout(() => {
        try {
          close();
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[patotube] floating close after bg failed', e);
        }
      }, 80);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[patotube] floating → background audio failed', err);
    }
  };

  return (
    <div
      className="fixed z-[100] bg-black rounded-lg overflow-hidden shadow-2xl border border-border/60 flex flex-col"
      style={{ left: pos?.x ?? 0, top: pos?.y ?? 0, width: WIDTH }}
    >
      <div
        className="flex items-center gap-1 px-1 bg-black/90 text-white/90 select-none touch-none cursor-grab active:cursor-grabbing"
        style={{ height: HANDLE_HEIGHT }}
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      >
        <GripVertical className="size-3.5 opacity-60 shrink-0" />
        <span className="flex-1 truncate text-[11px] leading-none px-1">{result.title}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void onListenInBackground()}
          aria-label="Listen in background"
          title="Écouter en fond"
          className="grid place-items-center size-6 rounded hover:bg-white/15"
        >
          <Headphones className="size-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onExpandToDialog}
          aria-label="Open full player"
          title="Plein écran"
          className="grid place-items-center size-6 rounded hover:bg-white/15"
        >
          <Maximize2 className="size-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={close}
          aria-label="Close"
          className="grid place-items-center size-6 rounded hover:bg-white/15"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <video
        ref={videoRef}
        src={src}
        controls
        // Only autoPlay when there's no resume — otherwise it races
        // with the onLoadedMetadata seek and we restart at 0.
        autoPlay={startAt <= 0.25}
        playsInline
        preload="metadata"
        poster={result.thumbnailUrl}
        className="block w-full bg-black"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (startAt > 0.25) {
            try { v.currentTime = startAt; } catch { /* silent */ }
            void v.play().catch(() => { /* WebView may block; user has the play button */ });
          }
        }}
        onCanPlay={(e) => {
          const v = e.currentTarget;
          if (startAt > 0.25 && Math.abs(v.currentTime - startAt) > 0.5) {
            try { v.currentTime = startAt; } catch { /* silent */ }
            void v.play().catch(() => { /* silent */ });
          }
        }}
        onTimeUpdate={(e) => {
          lastTimeRef.current = e.currentTarget.currentTime;
        }}
      />
    </div>
  );
}
