import { useTranslation } from 'react-i18next';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import { LocaleSwitcher } from '@/features/i18n/locale-switcher';

export function Header() {
  const { t } = useTranslation();
  return (
    <header className="drag-region flex items-center justify-between border-b border-border/40 bg-background/60 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <img
          src="/patotube.png"
          alt=""
          className="size-9 no-drag drop-shadow-[0_2px_8px_hsl(var(--duck-glow)/0.35)] animate-duck-bounce"
          draggable={false}
        />
        <div className="leading-tight">
          <p className="font-semibold tracking-tight">{t('app.name')}</p>
          <p className="text-[11px] text-muted-foreground">{t('app.tagline')}</p>
        </div>
      </div>

      <div className="no-drag-region flex items-center gap-1">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
