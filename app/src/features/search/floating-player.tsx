import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Maximize2, X, GripVertical, Headphones, AlertTriangle } from 'lucide-react';
import type { SearchResult } from '@/lib/tauri/bindings';
import { hasBackgroundAudio } from '@/lib/android/bridge';
import { usePlayback } from './use-playback';
import { usePlayerVideo } from './use-player-video';

const WIDTH = 200;
const MARGIN = 12;
const HANDLE_HEIGHT = 28;

interface FloatingPlayerProps {
  track: SearchResult;
  startAt: number;
}

/** In-app draggable mini-player. Mounted by PlayerHost while the
 *  playback mode is `floating`. */
export function FloatingPlayer({ track, startAt }: FloatingPlayerProps) {
  const { t } = useTranslation();
  const close = usePlayback((s) => s.close);
  const { stream, videoProps, videoKey, goBackground, switchTo } = usePlayerVideo(
    track,
    startAt,
    'floating',
  );

  // Anchored bottom-right on mount.
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - WIDTH - MARGIN,
    y: Math.max(MARGIN, window.innerHeight - 220),
  }));
  const dragRef = useRef<{
    pointerStartX: number;
    pointerStartY: number;
    posStartX: number;
    posStartY: number;
  } | null>(null);

  const onDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture can fail on rapid re-mounts — fall through */
    }
    dragRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      posStartX: pos.x,
      posStartY: pos.y,
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

  return (
    <div
      className="fixed z-[100] bg-black rounded-lg overflow-hidden shadow-2xl border border-border/60 flex flex-col"
      style={{ left: pos.x, top: pos.y, width: WIDTH }}
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
        <span className="flex-1 truncate text-[11px] leading-none px-1">{track.title}</span>
        {hasBackgroundAudio() && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => void goBackground()}
            aria-label={t('search.toBackgroundAudio')}
            title={t('search.toBackgroundAudio')}
            className="grid place-items-center size-6 rounded hover:bg-white/15"
          >
            <Headphones className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => switchTo('dialog')}
          aria-label={t('search.toFullPlayer')}
          title={t('search.toFullPlayer')}
          className="grid place-items-center size-6 rounded hover:bg-white/15"
        >
          <Maximize2 className="size-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={close}
          aria-label={t('a11y.close')}
          title={t('a11y.close')}
          className="grid place-items-center size-6 rounded hover:bg-white/15"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {stream.kind === 'ready' ? (
        <video key={videoKey} {...videoProps} className="block w-full bg-black" />
      ) : (
        <div className="flex aspect-video items-center justify-center gap-2 px-2 text-center text-[11px] text-white/70">
          {stream.kind === 'error' ? (
            <>
              <AlertTriangle className="size-3.5 shrink-0 text-amber-400" />
              <span className="line-clamp-2">{t('search.playerFailed')}</span>
            </>
          ) : (
            <span>{t('search.playerLoading')}</span>
          )}
        </div>
      )}
    </div>
  );
}
