import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FormatPicker } from '@/features/download/format-picker';
import { useSettings } from '@/lib/core/settings';
import { enqueueJob } from '@/features/download/actions';
import type { FormatChoice, MediaInfo } from '@/lib/core/types';
import type { SearchResult } from '@/lib/tauri/bindings';

interface PlayerDownloadDialogProps {
  result: SearchResult | null;
  onClose: () => void;
  /** Fired after the download has been queued (success or failure). The
   *  parent can use this to also dismiss the player dialog behind. */
  onConfirmed: () => void;
}

/** Cast a SearchResult into the MediaInfo shape the queue expects.
 *  We have everything we need from the search renderer — no extra
 *  fetchMediaInfo round-trip required. */
function toMediaInfo(r: SearchResult): MediaInfo {
  return {
    url: `https://www.youtube.com/watch?v=${r.videoId}`,
    title: r.title,
    uploader: r.channel || undefined,
    durationSec: r.durationSeconds ?? undefined,
    thumbnail: r.thumbnailUrl,
    platform: 'youtube',
  };
}

export function PlayerDownloadDialog({
  result,
  onClose,
  onConfirmed,
}: PlayerDownloadDialogProps) {
  const { t } = useTranslation();
  const defaultFormat = useSettings((s) => s.defaultFormat);
  const [format, setFormat] = useState<FormatChoice>(defaultFormat);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (result) {
      setFormat(defaultFormat);
      setSubmitting(false);
    }
  }, [result, defaultFormat]);

  const handleConfirm = async () => {
    if (!result || submitting) return;
    setSubmitting(true);
    // Fire the enqueue but don't await the start — we want the
    // duck spinner to be visible for a beat regardless of how fast
    // Rust acknowledges the job, then dismiss cleanly.
    void enqueueJob(toMediaInfo(result), format);
    setTimeout(() => {
      onConfirmed();
      onClose();
    }, 700);
  };

  return (
    <Dialog
      open={!!result}
      onOpenChange={(o) => {
        if (!o && !submitting) onClose();
      }}
    >
      <DialogContent className="max-w-sm">
        {result && (
          <>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base leading-snug">
                {t('search.downloadThis')}
              </DialogTitle>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {result.title}
              </p>
            </DialogHeader>

            {submitting ? (
              <DuckSpinner label={t('search.starting')} />
            ) : (
              <>
                <FormatPicker
                  value={format}
                  onChange={setFormat}
                  audioOnly={false}
                  platform="youtube"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={onClose}>
                    {t('preview.cancel')}
                  </Button>
                  <Button variant="duck" onClick={() => void handleConfirm()}>
                    <Download className="size-4" />
                    {t('search.downloadThis')}
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DuckSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6">
      <div className="relative size-20">
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-duck border-r-duck/60 animate-spin"
        />
        <img
          src="/patotube.png"
          alt=""
          className="absolute inset-2 size-16 no-drag drop-shadow-[0_0_12px_hsl(var(--duck-glow)/0.35)]"
          draggable={false}
        />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
