import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from './i18n-config';

export function LangPicker() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'en') as Locale;
  const meta = LOCALE_META[current];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t('locale.change')}
          className="h-9 gap-1.5 px-2.5"
        >
          <span className="text-sm leading-none">{meta.flag}</span>
          <span className="text-[10px] font-mono font-bold tracking-wider opacity-80">
            {meta.abbr}
          </span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 max-h-[70vh] overflow-y-auto">
        {SUPPORTED_LOCALES.map((code) => {
          const m = LOCALE_META[code];
          const active = code === current;
          return (
            <DropdownMenuItem
              key={code}
              onSelect={() => void i18n.changeLanguage(code)}
              className={cn(
                'cursor-pointer gap-2.5',
                active && 'bg-primary/10 text-primary',
              )}
            >
              <span className="text-base leading-none shrink-0">{m.flag}</span>
              <span
                className={cn(
                  'text-[10px] font-mono font-bold tracking-wider w-7 text-center shrink-0',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {m.abbr}
              </span>
              <span className="flex-1 truncate">{m.native}</span>
              {active && <Check className="size-3.5 shrink-0 opacity-80" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
