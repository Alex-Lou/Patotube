import { useTranslation } from 'react-i18next';
import { Download, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { SearchResult } from '@/lib/tauri/bindings';

interface SearchPlayerDialogProps {
  result: SearchResult | null;
  onClose: () => void;
  onDownload: (r: SearchResult) => void;
}

export function SearchPlayerDialog({ result, onClose, onDownload }: SearchPlayerDialogProps) {
  const { t } = useTranslation();
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

            <div className="aspect-video overflow-hidden rounded-md bg-black">
              <iframe
                key={result.videoId}
                src={`https://www.youtube-nocookie.com/embed/${result.videoId}?autoplay=1&rel=0&modestbranding=1`}
                title={result.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="size-full border-0"
              />
            </div>

            {result.channel && (
              <p className="text-xs text-muted-foreground">{result.channel}</p>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="ghost" asChild>
                <a
                  href={`https://www.youtube.com/watch?v=${result.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                  {t('search.openOnYoutube')}
                </a>
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
