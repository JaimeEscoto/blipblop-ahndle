import { useTranslation } from 'react-i18next';

interface Props {
  value?: 'es' | 'en';
  onChange?: (lang: 'es' | 'en') => void;
}

/** Toggle segmentado ES | EN reutilizable (login y ajustes). */
export default function LanguageToggle({ value, onChange }: Props) {
  const { i18n } = useTranslation();
  const current = value ?? (i18n.language?.startsWith('en') ? 'en' : 'es');

  const select = (lang: 'es' | 'en') => {
    if (lang === current) return;
    if (onChange) onChange(lang);
    else i18n.changeLanguage(lang);
  };

  const langs: { code: 'es' | 'en'; label: string }[] = [
    { code: 'es', label: 'ES' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label="Language">
      {langs.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => select(code)}
          aria-pressed={current === code}
          className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
            current === code ? 'bg-blue-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
