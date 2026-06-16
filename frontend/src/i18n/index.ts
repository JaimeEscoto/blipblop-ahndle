import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './locales/es.json';
import en from './locales/en.json';

export const LANG_KEY = 'clinic_lang';

function detectInitialLang(): 'es' | 'en' {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === 'es' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: detectInitialLang(),
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
});

// Mantiene sincronizado localStorage cuando cambia el idioma
i18n.on('languageChanged', (lng) => {
  if (lng === 'es' || lng === 'en') localStorage.setItem(LANG_KEY, lng);
});

export default i18n;
