import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SettingsMenu } from './settings-menu';
import { LOCALE_META, type Locale } from '@/features/i18n/i18n-config';

export function Header() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = (i18n.resolvedLanguage ?? 'en') as Locale;
  const meta = LOCALE_META[current];

  return (
    <header className="drag-region flex items-center justify-between border-b border-border/40 bg-background/60 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        <img
          src="/patotube.png"
          alt=""
          className="size-9 no-drag animate-duck-bounce"
          draggable={false}
        />
        <div className="leading-tight">
          <p className="font-semibold tracking-tight">{t('app.name')}</p>
          <p className="text-[11px] text-muted-foreground">{t('app.tagline')}</p>
        </div>
      </div>

      <div className="no-drag-region">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('settings.title')}
              className="h-9 gap-2 px-2.5"
            >
              <span className="text-sm leading-none">{meta.flag}</span>
              <span className="text-[10px] font-mono font-bold tracking-wider opacity-80">
                {meta.abbr}
              </span>
              <span className="mx-0.5 h-4 w-px bg-border/80" aria-hidden />
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[340px]">
            <SheetHeader>
              <SheetTitle>{t('settings.title')}</SheetTitle>
            </SheetHeader>
            <SettingsMenu onAfterAction={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
