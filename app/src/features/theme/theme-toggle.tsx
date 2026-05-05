import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './theme-provider';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  const { t } = useTranslation();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      title={t(isDark ? 'theme.toLight' : 'theme.toDark')}
      className="relative overflow-hidden"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ y: -16, opacity: 0, rotate: -90 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 16, opacity: 0, rotate: 90 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="absolute inset-0 grid place-items-center"
        >
          {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
