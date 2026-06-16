import i18n from './index';

/** Locale para toLocaleDateString/toLocaleString según el idioma activo. */
export function dateLocale(): string {
  return i18n.language?.startsWith('en') ? 'en-US' : 'es-CO';
}
