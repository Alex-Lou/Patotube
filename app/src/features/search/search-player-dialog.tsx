import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getTauri, isTauri, type SearchResult } from '@/lib/tauri/bindings';

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
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ready'; src: string }
  | { kind: 'error'; message: string };

export function SearchPlayerDialog({ result, onClose, onDownload }: SearchPlayerDialogProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    (async () => {
      try {
        const api = await getTauri();
        // Pre-resolve so the Rust proxy cache is warm AND so we
        // surface a clean error (unplayable / age-gated / etc.)
        // before mounting the <video> tag.
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
                  key={state.src}
                  src={state.src}
                  controls
                  // Hide the native "download" button — the real download
                  // is the dedicated button below, which picks proper quality.
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture={false}
                  autoPlay
                  playsInline
                  preload="metadata"
                  poster={result.thumbnailUrl}
                  className="size-full"
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
