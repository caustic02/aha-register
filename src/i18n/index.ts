import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en.json';
import de from './locales/de.json';

const SUPPORTED_LANGUAGES = ['en', 'de'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function detectLanguage(): SupportedLanguage {
  const locales = getLocales();
  const code = locales[0]?.languageCode ?? 'en';
  const lang = code.split('-')[0] as SupportedLanguage;
  return SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';
}

i18n.use(initReactI18next).init({
  lng: detectLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  interpolation: {
    // React already escapes values
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
