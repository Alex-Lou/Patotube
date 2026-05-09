import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Header } from '@/components/header';
import { UrlInput } from '@/features/download/url-input';
import { PreviewDialog } from '@/features/download/preview-dialog';
import { QueueList } from '@/features/download/queue-list';
import { useDownloadActions, useDownloadEvents } from '@/features/download/use-downloads';
import { useTheme } from '@/features/theme/theme-provider';
import { detectPlatform, isActive } from '@/lib/core/platform';
import { validateUrl } from '@/lib/core/url';
import { getTauri } from '@/lib/tauri/bindings';
import type { MediaInfo } from '@/lib/core/types';

export function App() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const [pendingPreview, setPendingPreview] = useState<MediaInfo | null>(null);
  const [dragOver, setDragOver] = useState(false);
  useDownloadEvents();
  const { enqueue } = useDownloadActions();

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
          // bottom-center is the only position whose mobile rule is
          // symmetric (left + right + transform:none). bottom-right
          // anchors with `right: var(...)` AND `left: var(...)` AND
          // `width: 100%`, which over-constrains the wrapper in LTR
          // and pushes it past the right edge of a 360 px viewport.
          position="bottom-center"
          richColors
          closeButton
          style={
            {
              '--width': 'min(420px, calc(100vw - 16px))',
            } as React.CSSProperties
          }
          offset={{ right: 8, bottom: 12, left: 8, top: 12 }}
          // Push the bottom offset above the Android system nav bar.
          // index.html has viewport-fit=cover so env() resolves > 0
          // when the WebView draws edge-to-edge.
          mobileOffset={{
            right: 8,
            left: 8,
            bottom: 'calc(12px + env(safe-area-inset-bottom))',
            top: 'calc(12px + env(safe-area-inset-top))',
          }}
          toastOptions={{
            classNames: {
              toast: 'border border-border/60 shadow-lg',
              // [data-content] is a flex item; without min-w-0 it
              // refuses to shrink below the intrinsic width of long
              // unbreakable strings, which is what was pushing the
              // title past the right edge on mobile.
              content: 'min-w-0',
              // No `truncate`: let long titles wrap onto multiple
              // lines so the toast grows in height instead of in
              // width. sonner already sets overflow-wrap:anywhere
              // on the toast so even a wordless 80-char string
              // breaks correctly.
              title: 'break-words',
              description: 'break-words text-xs opacity-70',
              // Strip sonner's default action-button chrome so our
              // icon-only Folder button reads as a discreet
              // affordance instead of a white pill grafted onto
              // the toast. `!important` overrides win against
              // sonner's inline styles.
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
      </div>
    </TooltipProvider>
  );
}
