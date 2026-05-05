import { useTranslation } from 'react-i18next';
import { Languages, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from './i18n-config';

export function LocaleSwitcher() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'en') as Locale;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('locale.change')}>
          <Languages className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('locale.language')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((code) => {
          const meta = LOCALE_META[code];
          const active = code === current;
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => void i18n.changeLanguage(code)}
              className="cursor-pointer"
            >
              <span className="mr-2 text-base leading-none">{meta.flag}</span>
              <span className="flex-1">{meta.native}</span>
              {active && <Check className="size-4 opacity-70" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
