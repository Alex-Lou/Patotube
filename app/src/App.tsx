import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Splash } from '@/components/splash';
import { Header } from '@/components/header';
import { FilePlayerDialog } from '@/features/files/file-player-dialog';
import { FloatingPlayer } from '@/features/search/floating-player';
import { GlobalPlayerDialog } from '@/features/search/global-player-dialog';
import { useFloatingPlayer } from '@/features/search/use-floating-player';
import { usePlayerDialog } from '@/features/search/use-player-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { SearchResult } from '@/lib/tauri/bindings';
import { usePlayerStore } from '@/features/files/player-store';
import { consumePendingIntent, hasNativeBridge, type PendingIntent } from '@/lib/android/bridge';
import { UrlInput } from '@/features/download/url-input';
import { PreviewDialog } from '@/features/download/preview-dialog';
import { QueueList } from '@/features/download/queue-list';
import { useDownloadActions, useDownloadEvents } from '@/features/download/use-downloads';
import { useTheme } from '@/features/theme/theme-provider';
import { detectPlatform, isActive } from '@/lib/core/platform';
import { validateUrl } from '@/lib/core/url';
import { getTauri } from '@/lib/tauri/bindings';
import type { MediaInfo } from '@/lib/core/types';

// One duck bounce + fade-out tail.
const SPLASH_DURATION_MS = 900;

export function App() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [pendingPreview, setPendingPreview] = useState<MediaInfo | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  useDownloadEvents();
  const { enqueue } = useDownloadActions();

  useEffect(() => {
    const id = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(id);
  }, []);

  // Unified dispatcher for external actions: Tauri deep-link, Android
  // intent bridge, drag-and-drop. Splits on `kind`, not on source.
  const dispatchExternalAction = useCallback(
    (intent: PendingIntent) => {
      setShowSplash(false);
      if (intent.kind === 'download') {
        const v = validateUrl(intent.url);
        if (!v.ok) return;
        const platform = detectPlatform(v.url);
        if (!isActive(platform)) return;
        void (async () => {
          try {
            const api = await getTauri();
            const info = await api.fetchMediaInfo(v.url);
            setPendingPreview(info);
          } catch {
            /* swallowed; the URL input flow surfaces fetch errors */
          }
        })();
      } else if (intent.kind === 'open-file') {
        usePlayerStore.getState().playPath(intent.path);
      } else if (intent.kind === 'resume-player') {
        // Triggered by the Android bg-audio notification's
        // "App" / "Floating" buttons. The native service has already
        // stopped its MediaPlayer; we just re-attach the track to the
        // visible player at the position it was paused at.
        //
        // Loading toast covers the ~1-2 s gap between the bg audio
        // tearing down and the WebView <video> hitting `play()` at
        // the right offset — without it the user sees an empty UI
        // and thinks the action did nothing.
        const tid = toast.loading(t('search.resuming'), { duration: 4000 });
        const result: SearchResult = {
          videoId: intent.videoId,
          title: intent.title,
          channel: '',
          durationSeconds: null,
          thumbnailUrl: intent.thumbnailUrl,
          viewCount: null,
          published: null,
        };
        if (intent.mode === 'dialog') {
          usePlayerDialog.getState().open(result, intent.startAt);
        } else {
          // Floating wants a `src` URL — derive it from the videoId
          // exactly like SearchPlayerDialog does (`patostream://`).
          const src = convertFileSrc(intent.videoId, 'patostream');
          useFloatingPlayer.getState().open(result, src, intent.startAt);
        }
        // Dismiss when the video is actually playing — best effort
        // via short delay; if playback fails the 4 s auto-dismiss
        // catches it.
        setTimeout(() => toast.dismiss(tid), 1500);
      }
    },
    [],
  );

  // Desktop deep-link (patotube://): getCurrent() for cold-start, onOpenUrl() for warm.
  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }

    const handleDeepLink = (raw: string | null | undefined): void => {
      if (!raw) return;
      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return;
      }
      if (parsed.protocol !== 'patotube:') return;
      // Action lands in `host` or `pathname` depending on trailing slashes.
      const action = parsed.host || parsed.pathname.replace(/^\/+/, '');
      if (action === 'download') {
        const target = parsed.searchParams.get('url');
        if (target) dispatchExternalAction({ kind: 'download', url: target });
      } else if (action === 'open-file') {
        const path = parsed.searchParams.get('path');
        if (path) dispatchExternalAction({ kind: 'open-file', path });
      }
    };

    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link');
      const cold = await getCurrent();
      if (cancelled) return;
      cold?.forEach(handleDeepLink);
      unlisten = await onOpenUrl((urls) => {
        urls.forEach(handleDeepLink);
      });
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [dispatchExternalAction]);

  // Native background-audio failures bubble up as a toast. The
  // foreground service calls window.__patotubeOnBgError(message)
  // when ExoPlayer refuses the source or the CDN 403s.
  useEffect(() => {
    if (!hasNativeBridge()) return;
    window.__patotubeOnBgError = (message: string) => {
      toast.error(t('search.backgroundAudioFailed'), {
        description: message,
      });
    };
    return () => {
      delete window.__patotubeOnBgError;
    };
  }, [t]);

  // Catch unhandled JS errors / promise rejections so a single buggy
  // listener can't blank the WebView. Surface as a toast in dev,
  // log to console (adb logcat -s chromium) so we have a trace when
  // a user reports "the app just froze".
  useEffect(() => {
    const onErr = (e: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error('[patotube] window error:', e.message, e.error?.stack);
    };
    const onRej = (e: PromiseRejectionEvent) => {
      // eslint-disable-next-line no-console
      console.error('[patotube] unhandled rejection:', e.reason);
    };
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, []);

  // Android intents (SEND, VIEW, patotube://) come via the PatoMobile bridge
  // since the Tauri deep-link plugin doesn't register schemes on Android.
  // Drained on mount, on visibility change, and via window.__patotubeOnIntent (warm-start push).
  useEffect(() => {
    if (!hasNativeBridge()) return;

    const drain = () => {
      const intent = consumePendingIntent();
      if (intent) dispatchExternalAction(intent);
    };

    drain(); // cold-start
    window.__patotubeOnIntent = drain;
    document.addEventListener('visibilitychange', drain);
    return () => {
      if (window.__patotubeOnIntent === drain) {
        delete window.__patotubeOnIntent;
      }
      document.removeEventListener('visibilitychange', drain);
    };
  }, [dispatchExternalAction]);

  // Global drag & drop: dropping a URL anywhere triggers the fetch flow.
  useEffect(() => {
    let dragDepth = 0;

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      // Only react to drops carrying text-like data, not file lists.
      const types = Array.from(e.dataTransfer.types);
      if (!types.some((t) => t === 'text/plain' || t === 'text/uri-list')) return;
      e.preventDefault();
      dragDepth++;
      setDragOver(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const types = Array.from(e.dataTransfer.types);
      if (!types.some((t) => t === 'text/plain' || t === 'text/uri-list')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) setDragOver(false);
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth = 0;
      setDragOver(false);
      if (!e.dataTransfer) return;
      const url =
        e.dataTransfer.getData('text/uri-list').split('\n')[0]?.trim() ||
        e.dataTransfer.getData('text/plain').trim();
      if (!url) return;
      const v = validateUrl(url);
      if (!v.ok) return;
      const platform = detectPlatform(v.url);
      if (!isActive(platform)) return;
      void (async () => {
        try {
          const api = await getTauri();
          const info = await api.fetchMediaInfo(v.url);
          setPendingPreview(info);
        } catch {
          /* swallowed; URL input flow already shows errors when typed */
        }
      })();
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex h-full flex-col bg-background text-foreground">
        <Header />

        <main className="mx-auto flex w-full max-w-3xl lg:max-w-5xl xl:max-w-6xl flex-1 flex-col gap-6 px-4 sm:px-6 lg:px-10 py-6 overflow-hidden">
          <section className="mx-auto w-full max-w-2xl animate-fade-in">
            <UrlInput onResolved={setPendingPreview} />
          </section>

          <section className="flex-1 overflow-hidden animate-fade-in">
            <QueueList />
          </section>
        </main>

        <PreviewDialog
          info={pendingPreview}
          onClose={() => setPendingPreview(null)}
          onConfirm={(info, format) => {
            void enqueue(info, format);
            setPendingPreview(null);
          }}
        />

        <Toaster
          theme={resolvedTheme}
          // bottom-center: only position with symmetric mobile rule;
          // bottom-right over-constrains the wrapper on 360px viewports.
          position="bottom-center"
          richColors
          closeButton
          style={
            {
              '--width': 'min(420px, calc(100vw - 16px))',
            } as React.CSSProperties
          }
          offset={{ right: 8, bottom: 12, left: 8, top: 12 }}
          // env() resolves > 0 because index.html has viewport-fit=cover.
          mobileOffset={{
            right: 8,
            left: 8,
            bottom: 'calc(12px + env(safe-area-inset-bottom))',
            top: 'calc(12px + env(safe-area-inset-top))',
          }}
          toastOptions={{
            classNames: {
              toast: 'border border-border/60 shadow-lg',
              // [data-content] is a flex item; min-w-0 lets it shrink below intrinsic width of long unbreakable strings.
              content: 'min-w-0',
              // Wrap long titles instead of truncating; sonner sets overflow-wrap:anywhere.
              title: 'break-words',
              description: 'break-words text-xs opacity-70',
              // Strip sonner's default action-button chrome (!important beats inline styles).
              actionButton:
                '!bg-transparent !text-current !p-1.5 !min-w-0 !h-auto rounded-md hover:!bg-foreground/10 transition-colors',
            },
          }}
        />

        <AnimatePresence>
          {dragOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary/60 bg-card/80 px-12 py-10 shadow-2xl"
              >
                <Download className="size-12 text-primary animate-bounce" />
                <p className="text-lg font-semibold text-foreground">
                  {t('drop.hint')}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{showSplash && <Splash />}</AnimatePresence>

        {/* Embedded player: FilesSheet fallback when no system app handles MIME, or via patotube://open-file. */}
        <FilePlayerDialog />

        {/* In-app floating mini-player. Opened from the "Floating window"
            button in SearchPlayerDialog; lives at App level so it survives
            the dialog being unmounted. */}
        <FloatingPlayer />

        {/* Global re-entry point for SearchPlayerDialog — driven by
            usePlayerDialog. Used by FloatingPlayer's expand button and
            by the Android notification's "App" action. */}
        <GlobalPlayerDialog />
      </div>
    </TooltipProvider>
  );
}
