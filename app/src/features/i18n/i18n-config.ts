export const SUPPORTED_LOCALES = [
  'en',
  'fr',
  'es',
  'pt',
  'it',
  'de',
  'nl',
  'pl',
  'ru',
  'tr',
  'ar',
  'hi',
  'ja',
  'ko',
  'zh',
  'is',
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES = new Set<Locale>(['ar']);

export const LOCALE_META: Record<
  Locale,
  { label: string; native: string; flag: string; abbr: string }
> = {
  en: { label: 'English', native: 'English', flag: '🇬🇧', abbr: 'EN' },
  fr: { label: 'French', native: 'Français', flag: '🇫🇷', abbr: 'FR' },
  es: { label: 'Spanish', native: 'Español', flag: '🇪🇸', abbr: 'ES' },
  pt: { label: 'Portuguese', native: 'Português', flag: '🇵🇹', abbr: 'PT' },
  it: { label: 'Italian', native: 'Italiano', flag: '🇮🇹', abbr: 'IT' },
  de: { label: 'German', native: 'Deutsch', flag: '🇩🇪', abbr: 'DE' },
  nl: { label: 'Dutch', native: 'Nederlands', flag: '🇳🇱', abbr: 'NL' },
  pl: { label: 'Polish', native: 'Polski', flag: '🇵🇱', abbr: 'PL' },
  ru: { label: 'Russian', native: 'Русский', flag: '🇷🇺', abbr: 'RU' },
  tr: { label: 'Turkish', native: 'Türkçe', flag: '🇹🇷', abbr: 'TR' },
  ar: { label: 'Arabic', native: 'العربية', flag: '🇸🇦', abbr: 'AR' },
  hi: { label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', abbr: 'HI' },
  ja: { label: 'Japanese', native: '日本語', flag: '🇯🇵', abbr: 'JA' },
  ko: { label: 'Korean', native: '한국어', flag: '🇰🇷', abbr: 'KO' },
  zh: { label: 'Chinese', native: '中文', flag: '🇨🇳', abbr: 'ZH' },
  is: { label: 'Icelandic', native: 'Íslenska', flag: '🇮🇸', abbr: 'IS' },
};

export const DEFAULT_LOCALE: Locale = 'en';

export const isRTL = (locale: string): boolean => RTL_LOCALES.has(locale as Locale);
