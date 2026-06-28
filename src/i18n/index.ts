import { ar, type Dictionary } from './locales/ar';

export type LocaleCode = 'ar' | 'en';

const dictionaries: Record<LocaleCode, Dictionary> = {
  ar,
  // English is intentionally aliased to Arabic for now; drop a real en.ts here later.
  en: ar,
};

export const RTL_LOCALES: LocaleCode[] = ['ar'];

let currentLocale: LocaleCode = 'ar';

export function setLocale(locale: LocaleCode) {
  currentLocale = locale;
}
export function getLocale(): LocaleCode {
  return currentLocale;
}
export function isRTL(locale: LocaleCode = currentLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

/** Active dictionary, e.g. `const t = useStrings(); t.tabs.home`. */
export function strings(): Dictionary {
  return dictionaries[currentLocale];
}

export { ar };
export type { Dictionary };
