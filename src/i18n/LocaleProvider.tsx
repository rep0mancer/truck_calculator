'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { serializeLocaleCookie, type Locale, type Translator, translate } from '.';

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: Translator } | null>(null);

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale);
  const setLocale = useCallback((nextLocale: Locale) => {
    document.cookie = serializeLocaleCookie(nextLocale);
    document.documentElement.lang = nextLocale;
    setLocaleState(nextLocale);
  }, []);
  const t = useCallback<Translator>((key, values) => translate(locale, key, values), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('meta.title');
  }, [locale, t]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider');
  return context;
}
