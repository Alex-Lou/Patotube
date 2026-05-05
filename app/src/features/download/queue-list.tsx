import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Inbox, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueueStore } from '@/lib/core/queue';
import { useDownloads } from './use-downloads';
import { QueueItem } from './queue-item';

export function QueueList() {
  const { t } = useTranslation();
  const jobs = useQueueStore((s) => s.jobs);
  const remove = useQueueStore((s) => s.remove);
  const clearCompleted = useQueueStore((s) => s.clearCompleted);
  const { retry, showInFolder } = useDownloads();

  const hasCompleted = jobs.some((j) => j.status === 'done');

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t('queue.title')}
        </h2>
        {hasCompleted && (
          <Button variant="ghost" size="sm" onClick={clearCompleted}>
            <Trash2 className="size-3.5" />
            {t('queue.clear')}
          </Button>
        )}
      </div>

      {jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {jobs.map((job) => (
              <QueueItem
                key={job.id}
                job={job}
                onRemove={remove}
                onRetry={retry}
                onShowInFolder={showInFolder}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/40 p-12 text-center"
    >
      <Inbox className="size-10 text-muted-foreground/60" />
      <p className="max-w-xs text-sm text-muted-foreground">{t('queue.empty')}</p>
    </motion.div>
  );
}
