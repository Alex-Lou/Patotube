import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

/**
 * Cold-start overlay shown above the app shell while React mounts
 * and the i18n / queue stores hydrate. Auto-dismissed by the parent
 * after a short timeout — there's no async readiness signal worth
 * waiting on (i18n is bundled, the queue store rehydrates from
 * localStorage synchronously) so we just give the duck enough time
 * to bounce once before fading out.
 */
export function Splash() {
  const { t } = useTranslation();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="pointer-events-none fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background"
    >
      <img
        src="/patotube.png"
        alt=""
        className="size-24 no-drag animate-duck-bounce drop-shadow-[0_0_24px_hsl(var(--duck-glow)/0.45)]"
        draggable={false}
      />

      <div className="text-center leading-tight">
        <p className="text-2xl font-semibold tracking-tight">{t('app.name')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('app.tagline')}</p>
      </div>

      <SplashBar />
    </motion.div>
  );
}

/**
 * Indeterminate progress bar. Pure CSS so it paints on the very
 * first frame instead of waiting for framer-motion to wire up its
 * animation loop.
 */
function SplashBar() {
  return (
    <div className="h-1 w-40 overflow-hidden rounded-full bg-border/60">
      <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-duck to-duck-glow animate-splash-slide" />
    </div>
  );
}
