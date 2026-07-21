import { describe, expect, it } from 'vitest';
import { translateWarning, translations, type Locale } from './i18n';

const locales = Object.keys(translations) as Locale[];

describe('translations', () => {
  it('provides every UI string for every supported language', () => {
    const germanKeys = Object.keys(translations.de);
    expect(locales).toEqual(['de', 'en', 'it', 'hr', 'sk', 'cs', 'uk']);
    for (const locale of locales) {
      expect(Object.keys(translations[locale])).toEqual(germanKeys);
      for (const value of Object.values(translations[locale])) expect(value.trim()).not.toBe('');
    }
  });

  it('localizes core calculation warnings in every additional language', () => {
    const germanWarning = 'Gewichtslimit erreicht.';
    for (const locale of locales.filter(locale => locale !== 'de')) {
      expect(translateWarning(germanWarning, locale)).not.toBe(germanWarning);
    }
  });
});
