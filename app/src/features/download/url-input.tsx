import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, ClipboardPaste, X, Download, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { detectPlatform } from '@/lib/core/platform';
import { extractFirstUrl, validateUrl } from '@/lib/core/url';
import { getTauri, type SearchResult } from '@/lib/tauri/bindings';
import type { MediaInfo } from '@/lib/core/types';
import { PlatformBadge } from './platform-badge';
import { SearchResults } from '@/features/search/search-results';
import { SearchPlayerDialog } from '@/features/search/search-player-dialog';
import { PlayerDownloadDialog } from '@/features/search/player-download-dialog';

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MIN_LENGTH = 3;
const SEARCH_LIMIT = 8;

interface UrlInputProps {
  onResolved: (info: MediaInfo) => void;
}

export function UrlInput({ onResolved }: UrlInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<SearchResult | null>(null);
  const [downloadFromPlayer, setDownloadFromPlayer] = useState<SearchResult | null>(null);

  // Raw value may be share-sheet text wrapping the URL.
  const looksLikeUrl = validateUrl(value).ok;
  const platform = value.trim() && looksLikeUrl ? detectPlatform(extractFirstUrl(value)) : null;
  const isSearchMode = value.trim().length >= SEARCH_MIN_LENGTH && !looksLikeUrl;

  // Bumped on every keystroke; the in-flight search compares its
  // captured id to the current ref to drop stale responses.
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!isSearchMode) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const q = value.trim();
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError(null);
    const handle = setTimeout(async () => {
      try {
        const api = await getTauri();
        const r = await api.searchYoutube(q, SEARCH_LIMIT);
        if (seq !== searchSeq.current) return;
        setResults(r);
      } catch (err) {
        if (seq !== searchSeq.current) return;
        const raw = err instanceof Error ? err.message : String(err);
        setSearchError(raw || t('search.failed'));
        setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [value, isSearchMode, t]);

  const handlePaste = async () => {
    // Browser API first, fallback to Tauri (WebView restrictions on Android).
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setValue(extractFirstUrl(text));
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
      const text = await readText();
      if (text) setValue(extractFirstUrl(text));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[patotube] clipboard read failed:', err);
    }
  };

  /** Strip share-sheet prose on Ctrl+V / long-press paste. */
  const handleNativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const cleaned = extractFirstUrl(text);
    if (cleaned !== text.trim()) {
      e.preventDefault();
      setValue(cleaned);
      if (error) setError(null);
    }
  };

  const resolveUrl = async (rawUrl: string) => {
    setError(null);
    const v = validateUrl(rawUrl);
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
      setResults([]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const lines = raw.split('\n').filter((l) => l.trim().length > 0);
      const headline = lines[0] ?? t('errors.fetchFailed');
      setError(headline);
      toast.error(t('errors.fetchFailed'), {
        description: raw.length > 0 ? raw : undefined,
        duration: 8000,
      });
      // eslint-disable-next-line no-console
      console.error('[patotube] fetchMediaInfo failed:', raw);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Defensive: always clear stale errors at submit start. Avoids
    // "URL invalide" lingering after a URL DL when the user pivots
    // back to keyword search.
    setError(null);
    setSearchError(null);

    const trimmed = value.trim();
    if (!trimmed) {
      setError(t('errors.empty'));
      return;
    }
    // URL path: hand off to the resolve+preview flow.
    if (validateUrl(value).ok) {
      void resolveUrl(value);
      return;
    }
    // Keyword path: too-short query is a no-op, not an error.
    if (trimmed.length < SEARCH_MIN_LENGTH) return;
    searchSeq.current++;
    void runSearchNow(trimmed);
  };

  const runSearchNow = async (q: string) => {
    if (q.length < SEARCH_MIN_LENGTH) return;
    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchError(null);
    try {
      const api = await getTauri();
      const r = await api.searchYoutube(q, SEARCH_LIMIT);
      if (seq !== searchSeq.current) return;
      setResults(r);
    } catch (err) {
      if (seq !== searchSeq.current) return;
      const raw = err instanceof Error ? err.message : String(err);
      setSearchError(raw || t('search.failed'));
      setResults([]);
    } finally {
      if (seq === searchSeq.current) setSearching(false);
    }
  };

  // Search row → "Télécharger" (click on title or kebab menu). We
  // already have title / channel / duration / thumbnail from the
  // search renderer — no extra fetchMediaInfo round-trip needed.
  // Goes straight to the small format-picker modal.
  const handlePick = (r: SearchResult) => setDownloadFromPlayer(r);
  const handlePlay = (r: SearchResult) => setPlaying(r);
  // Player → "Télécharger" : the player stays open behind a small
  // format-picker modal. Both dismiss together on confirm.
  const handleDownloadFromPlayer = (r: SearchResult) => setDownloadFromPlayer(r);

  const SubmitIcon = busy ? Loader2 : isSearchMode ? Search : Download;
  const submitLabel = isSearchMode ? t('url.search') : t('url.fetch');

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
              if (searchError) setSearchError(null);
            }}
            onPaste={handleNativePaste}
            placeholder={t('url.placeholder')}
            aria-label={t('url.label')}
            className="h-12 pl-4 pr-10 text-base"
            spellCheck={false}
            autoComplete="off"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setValue('')}
              aria-label={t('url.clear')}
              className="absolute inset-y-0 right-1 my-auto size-8"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handlePaste}
          aria-label={t('url.paste')}
          title={t('url.paste')}
          className="size-10 shrink-0"
        >
          <ClipboardPaste className="size-4" />
        </Button>
        <Button
          type="submit"
          variant="duck"
          size="icon"
          disabled={busy || !value.trim()}
          className="size-10 shrink-0"
          aria-label={submitLabel}
          title={submitLabel}
        >
          <SubmitIcon className={busy ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
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
          ) : isSearchMode ? (
            <motion.span
              key="hint-search"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-xs text-muted-foreground"
            >
              {t('search.hint')}
            </motion.span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('app.tagline')}</span>
          )}
        </AnimatePresence>
      </div>

      {isSearchMode && (
        <SearchResults
          results={results}
          loading={searching}
          error={searchError}
          onPick={handlePick}
          onPlay={handlePlay}
        />
      )}

      <SearchPlayerDialog
        result={playing}
        onClose={() => setPlaying(null)}
        onDownload={handleDownloadFromPlayer}
      />

      <PlayerDownloadDialog
        result={downloadFromPlayer}
        onClose={() => setDownloadFromPlayer(null)}
        onConfirmed={() => {
          setDownloadFromPlayer(null);
          setPlaying(null);
          setValue('');
          setResults([]);
        }}
      />
    </form>
  );
}
