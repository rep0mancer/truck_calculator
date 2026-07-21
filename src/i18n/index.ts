import { de, type MessageKey } from './messages/de';
import { en } from './messages/en';
import { fr } from './messages/fr';

export const locales = ['de', 'en', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'de';
export const localeCookie = 'truck-calculator-locale';
export const messages = { de, en, fr } satisfies Record<Locale, Record<MessageKey, string>>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && locales.includes(value as Locale);
}

export function translate(locale: Locale, key: MessageKey, values: Record<string, string | number> = {}) {
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    messages[locale][key] as string
  );
}

export const serializeLocaleCookie = (locale: Locale) =>
  `${localeCookie}=${locale}; path=/; max-age=31536000; samesite=lax`;

export type Translator = (key: MessageKey, values?: Record<string, string | number>) => string;
export type { MessageKey };
