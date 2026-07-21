'use client';

import { useLocale } from '@/i18n/LocaleProvider';
import { locales, type Locale } from '@/i18n';

const flags: Record<Locale, string> = { de: '🇩🇪', en: '🇬🇧', fr: '🇫🇷' };

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();
  return (
    <fieldset className="flex min-w-0 items-center gap-1" aria-label={t('language.selector')}>
      <legend className="sr-only">{t('language.selector')}</legend>
      {locales.map(option => {
        const name = t(`language.${option}`);
        return (
          <button key={option} type="button" onClick={() => setLocale(option)} aria-label={name}
            aria-pressed={locale === option} lang={option}
            className={`flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${locale === option ? 'bg-white text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            <span aria-hidden="true" className="text-lg">{flags[option]}</span>
            <span className="hidden sm:inline">{name}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
