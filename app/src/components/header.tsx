import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SettingsMenu } from './settings-menu';
import { LangPicker } from '@/features/i18n/lang-picker';

export function Header() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

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

      <div className="no-drag-region flex items-center gap-2">
        <LangPicker />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('settings.title')}
              className="size-9"
            >
              <SettingsIcon className="size-4" />
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
