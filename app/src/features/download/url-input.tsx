import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ClipboardPaste, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { detectPlatform } from '@/lib/core/platform';
import { validateUrl } from '@/lib/core/url';
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

  const platform = value.trim() ? detectPlatform(value) : null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue(text);
    } catch {
      /* clipboard denied — silent */
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
      setError(err instanceof Error ? err.message : t('errors.fetchFailed'));
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
