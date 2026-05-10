// Embedded HTML5 player — fallback when the OS has no app
// registered for an audio / video MIME type, and the canonical
// way to play a file once the user picks "Open with → Patotube"
// from the system chooser.
//
// On desktop we let Tauri's asset:// protocol stream the file via
// `convertFileSrc`. On Android the same path tends to silently
// fail in the system WebView for arbitrary file locations, so we
// read the bytes through the PatoMobile bridge and hand the
// element a Blob URL — slower for big videos, but reliable.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  isAndroid as isAndroidPlatform,
  hasNativeBridge,
  readAsBlobUrl,
} from '@/lib/android/bridge';
import { usePlayerStore } from './player-store';

const IS_ANDROID = isAndroidPlatform();

const EXT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
};

function mimeForPath(path: string, fallbackKind: 'audio' | 'video'): string {
  const ext = path.toLowerCase().split('.').pop() ?? '';
  return EXT_MIME[ext] ?? `${fallbackKind}/*`;
}

export function FilePlayerDialog() {
  const { t } = useTranslation();
  const entry = usePlayerStore((s) => s.active);
  const close = usePlayerStore((s) => s.close);
  const [src, setSrc] = useState<string>('');
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!entry) {
      setSrc('');
      setErrored(false);
      return;
    }
    let cancelled = false;
    let blobUrl: string | null = null;

    void (async () => {
      const mime = mimeForPath(entry.path, entry.mimeKind);

      // Android: read via PatoMobile bridge, build a Blob URL.
      if (IS_ANDROID && hasNativeBridge()) {
        const url = readAsBlobUrl(entry.path, mime);
        if (cancelled) return;
        if (url) {
          blobUrl = url;
          setSrc(url);
        } else {
          setErrored(true);
          toast.error(t('files.playerLoadFailed'));
        }
        return;
      }

      // Desktop: Tauri's asset:// protocol.
      try {
        const { convertFileSrc } = await import('@tauri-apps/api/core');
        const resolved = convertFileSrc(entry.path);
        if (!cancelled) setSrc(resolved);
      } catch {
        if (!cancelled) {
          setErrored(true);
          toast.error(t('files.playerLoadFailed'));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [entry, t]);

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        {entry && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base leading-snug pr-6">
                {entry.name}
              </DialogTitle>
            </DialogHeader>

            {errored ? (
              <p className="py-6 text-center text-sm text-destructive">
                {t('files.playerLoadFailed')}
              </p>
            ) : src ? (
              entry.mimeKind === 'video' ? (
                <video
                  src={src}
                  controls
                  autoPlay
                  className="w-full rounded-md bg-black"
                  onError={() => {
                    setErrored(true);
                    toast.error(t('files.playerLoadFailed'));
                  }}
                />
              ) : (
                <audio
                  src={src}
                  controls
                  autoPlay
                  className="w-full mt-2"
                  onError={() => {
                    setErrored(true);
                    toast.error(t('files.playerLoadFailed'));
                  }}
                />
              )
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('files.playerLoading')}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
