import { cookies, headers } from "next/headers";
import { getDictionary, type Dictionary } from "./dictionaries";
import { LOCALE_COOKIE, localeInfo, resolveLocale, type Locale, type LocaleInfo } from "./locales";

export interface RequestI18n {
  locale: Locale;
  info: LocaleInfo;
  dict: Dictionary;
}

/**
 * Language for the current request: the `mode_lang` cookie if valid, otherwise
 * the browser's `Accept-Language`, otherwise English. Server components only.
 */
export async function requestI18n(): Promise<RequestI18n> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
  });
  return { locale, info: localeInfo(locale), dict: await getDictionary(locale) };
}
