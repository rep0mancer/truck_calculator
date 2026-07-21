import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LanguageSelector } from '@/components/LanguageSelector';
import { LocaleProvider } from './LocaleProvider';
import { locales, messages, serializeLocaleCookie, translate } from '.';

describe('locale catalogs', () => {
  it('have exactly the same complete set of stable keys', () => {
    const expected = Object.keys(messages.de).sort();
    for (const locale of locales) expect(Object.keys(messages[locale]).sort()).toEqual(expected);
  });

  it('interpolates complete dynamic messages', () => {
    expect(translate('en', 'metrics.remainingPallets', { count: 2, type: 'EUP', pallet: 'pallets' }))
      .toBe('2 more EUP pallets');
    expect(translate('fr', 'warning.multipleTrucks', { total: 3, full: 2, remaining: 4 }))
      .not.toMatch(/\{\w+\}/);
  });

  it('serializes a persistent, site-wide locale cookie', () => {
    expect(serializeLocaleCookie('fr')).toBe('truck-calculator-locale=fr; path=/; max-age=31536000; samesite=lax');
  });
});

describe('LanguageSelector', () => {
  it('uses keyboard-native buttons with translated labels and selected state', () => {
    const html = renderToStaticMarkup(
      <LocaleProvider initialLocale="fr"><LanguageSelector /></LocaleProvider>
    );
    expect(html).toContain('aria-label="Choisir la langue"');
    expect(html).toContain('aria-label="Français" aria-pressed="true"');
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html).toContain('min-h-11 min-w-11');
  });
});
