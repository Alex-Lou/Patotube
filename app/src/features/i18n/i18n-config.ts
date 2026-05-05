export const SUPPORTED_LOCALES = ['en', 'fr', 'es', 'ar', 'ja', 'zh', 'is'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES = new Set<Locale>(['ar']);

export const LOCALE_META: Record<Locale, { label: string; native: string; flag: string }> = {
  en: { label: 'English', native: 'English', flag: '🇬🇧' },
  fr: { label: 'French', native: 'Français', flag: '🇫🇷' },
  es: { label: 'Spanish', native: 'Español', flag: '🇪🇸' },
  ar: { label: 'Arabic', native: 'العربية', flag: '🇸🇦' },
  ja: { label: 'Japanese', native: '日本語', flag: '🇯🇵' },
  zh: { label: 'Chinese', native: '中文', flag: '🇨🇳' },
  is: { label: 'Icelandic', native: 'Íslenska', flag: '🇮🇸' },
};

export const DEFAULT_LOCALE: Locale = 'en';

export const isRTL = (locale: string): boolean => RTL_LOCALES.has(locale as Locale);
