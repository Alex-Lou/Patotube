import { useEffect, type ReactNode } from 'react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isRTL } from './i18n-config';

import en from '@/locales/en.json';
import fr from '@/locales/fr.json';
import es from '@/locales/es.json';
import pt from '@/locales/pt.json';
import it from '@/locales/it.json';
import de from '@/locales/de.json';
import nl from '@/locales/nl.json';
import pl from '@/locales/pl.json';
import ru from '@/locales/ru.json';
import tr from '@/locales/tr.json';
import ar from '@/locales/ar.json';
import hi from '@/locales/hi.json';
import ja from '@/locales/ja.json';
import ko from '@/locales/ko.json';
import zh from '@/locales/zh.json';
import is from '@/locales/is.json';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      es: { translation: es },
      pt: { translation: pt },
      it: { translation: it },
      de: { translation: de },
      nl: { translation: nl },
      pl: { translation: pl },
      ru: { translation: ru },
      tr: { translation: tr },
      ar: { translation: ar },
      hi: { translation: hi },
      ja: { translation: ja },
      ko: { translation: ko },
      zh: { translation: zh },
      is: { translation: is },
    },
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'patotube-locale',
    },
  });

function applyDirAndLang(lng: string) {
  const html = document.documentElement;
  html.lang = lng;
  html.dir = isRTL(lng) ? 'rtl' : 'ltr';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyDirAndLang(i18n.resolvedLanguage ?? DEFAULT_LOCALE);
    const handler = (lng: string) => applyDirAndLang(lng);
    i18n.on('languageChanged', handler);
    return () => {
      i18n.off('languageChanged', handler);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
