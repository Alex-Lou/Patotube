import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Header } from '@/components/header';
import { UrlInput } from '@/features/download/url-input';
import { PreviewDialog } from '@/features/download/preview-dialog';
import { QueueList } from '@/features/download/queue-list';
import { useDownloads } from '@/features/download/use-downloads';
import type { MediaInfo } from '@/lib/core/types';

export function App() {
  const [pendingPreview, setPendingPreview] = useState<MediaInfo | null>(null);
  const { enqueue } = useDownloads();

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
      </div>
    </TooltipProvider>
  );
}
