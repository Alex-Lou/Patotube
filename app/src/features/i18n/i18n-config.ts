export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'ar', 'ja', 'zh', 'is'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES = new Set<Locale>(['ar']);

export const LOCALE_META: Record<
  Locale,
  { label: string; native: string; flag: string; abbr: string }
> = {
  en: { label: 'English', native: 'English', flag: '🇬🇧', abbr: 'EN' },
  fr: { label: 'French', native: 'Français', flag: '🇫🇷', abbr: 'FR' },
  es: { label: 'Spanish', native: 'Español', flag: '🇪🇸', abbr: 'ES' },
  ar: { label: 'Arabic', native: 'العربية', flag: '🇸🇦', abbr: 'AR' },
  ja: { label: 'Japanese', native: '日本語', flag: '🇯🇵', abbr: 'JA' },
  zh: { label: 'Chinese', native: '中文', flag: '🇨🇳', abbr: 'ZH' },
  is: { label: 'Icelandic', native: 'Íslenska', flag: '🇮🇸', abbr: 'IS' },
};

export const DEFAULT_LOCALE: Locale = 'en';

export const isRTL = (locale: string): boolean => RTL_LOCALES.has(locale as Locale);
