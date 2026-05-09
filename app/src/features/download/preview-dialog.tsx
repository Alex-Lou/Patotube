import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, User, ImageOff, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { FormatChoice, MediaInfo } from '@/lib/core/types';
import { useSettings } from '@/lib/core/settings';
import { DEFAULT_AUDIO_BITRATE } from '@/lib/core/formats';
import { formatDuration } from '@/lib/utils';
import { FormatPicker } from './format-picker';

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

  // Audio-only platforms — coerce the format to audio when the
  // resolved track came from SoundCloud, Bandcamp, or Audiomack,
  // regardless of the user's saved default. The picker hides the
  // video radio (see FormatPicker). Internet Archive can be
  // either, so we don't gate it.
  const AUDIO_ONLY_PLATFORMS = new Set(['soundcloud', 'bandcamp', 'audiomack']);
  const audioOnly = !!info && AUDIO_ONLY_PLATFORMS.has(info.platform);

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

            <div className="aspect-video overflow-hidden rounded-md bg-muted">
              {info.thumbnail && !imgError ? (
                <img
                  src={info.thumbnail}
                  alt=""
                  className="h-full w-full object-cover no-drag"
                  onError={() => setImgError(true)}
                  draggable={false}
                />
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
            </div>

            <div className="border-t border-border/50 pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('format.label')}
              </h4>
              <FormatPicker value={format} onChange={setFormat} audioOnly={audioOnly} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
