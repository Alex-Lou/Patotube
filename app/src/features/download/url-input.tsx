import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ClipboardPaste, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { detectPlatform } from '@/lib/core/platform';
import { extractFirstUrl, validateUrl } from '@/lib/core/url';
import { getTauri } from '@/lib/tauri/bindings';
import type { MediaInfo } from '@/lib/core/types';
import { PlatformBadge } from './platform-badge';

interface UrlInputProps {
  onResolved: (info: MediaInfo) => void;
}

export function UrlInput({ onResolved }: UrlInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Detect platform on the URL embedded in the input — the raw
  // value may be a share-sheet message wrapping the URL.
  const platform = value.trim() ? detectPlatform(extractFirstUrl(value)) : null;

  const handlePaste = async () => {
    // Browser API first (works on desktop dev, sometimes on Android Chrome).
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue(text);
        return;
      }
    } catch {
      /* fall through to Tauri plugin */
    }
    // Tauri clipboard plugin — bypasses WebView restrictions on Android.
    try {
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
      const text = await readText();
      if (text) setValue(text);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[patotube] clipboard read failed:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const v = validateUrl(value);
    if (!v.ok) {
      setError(t(v.reason === 'empty' ? 'errors.empty' : 'errors.invalid'));
      return;
    }

    const p = detectPlatform(v.url);
    if (p.status === 'comingSoon') {
      setError(t('errors.comingSoon', { platform: t(`platform.${p.id}`) }));
      return;
    }

    setBusy(true);
    try {
      const api = await getTauri();
      const info = await api.fetchMediaInfo(v.url);
      onResolved(info);
      setValue('');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // Surface the first line inline (compact), the rest in a toast so
      // the user gets the whole story without it crowding the input.
      const lines = raw.split('\n').filter((l) => l.trim().length > 0);
      const headline = lines[0] ?? t('errors.fetchFailed');
      const detail = lines.slice(1).join('\n');
      setError(headline);
      toast.error(t('errors.fetchFailed'), {
        description: raw.length > 0 ? raw : undefined,
        duration: 8000,
      });
      // eslint-disable-next-line no-console
      console.error('[patotube] fetchMediaInfo failed:', raw);
      // Keep linter happy — `detail` is available if we later want to
      // render it in an expandable inline panel.
      void detail;
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
      <div className="relative">
        <Input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={t('url.placeholder')}
          aria-label={t('url.label')}
          className="h-14 pl-4 pr-32 text-base"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setValue('')}
              aria-label={t('url.clear')}
              className="size-8"
            >
              <X className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handlePaste}
              aria-label={t('url.paste')}
              title={t('url.paste')}
              className="size-8"
            >
              <ClipboardPaste className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            variant="duck"
            size="sm"
            disabled={busy || !value.trim()}
            className="ml-1 h-9 px-4"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                {t('url.fetch')}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex min-h-6 items-center justify-between gap-2 px-1">
        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-xs text-destructive"
            >
              {error}
            </motion.p>
          ) : platform ? (
            <motion.div
              key={`platform-${platform.id}`}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
            >
              <PlatformBadge platform={platform.id} />
            </motion.div>
          ) : (
            <span className="text-xs text-muted-foreground">{t('app.tagline')}</span>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
