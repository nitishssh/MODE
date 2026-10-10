"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary, DictionaryKey } from "./dictionaries/en";
import { createFormatters, type Formatters } from "./format";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALES,
  interpolate,
  isLocale,
  localeInfo,
  type Direction,
  type Locale,
  type LocaleInfo,
} from "./locales";

type Vars = Record<string, string | number>;

export interface I18n {
  locale: Locale;
  dir: Direction;
  info: LocaleInfo;
  locales: readonly LocaleInfo[];
  /** Translate a key, substituting `{placeholders}`. */
  t: (key: DictionaryKey, vars?: Vars) => string;
  fmt: Formatters;
  /**
   * Message for a failed API call. Known error codes get a localized message;
   * anything else falls back to the server's text, then to `fallback`.
   */
  apiError: (result: { error?: string; code?: string } | null | undefined, fallback: DictionaryKey) => string;
  /** Persist the choice in the `mode_lang` cookie and re-render the server tree. */
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  const router = useRouter();

  const t = useCallback<I18n["t"]>((key, vars) => interpolate(dict[key] ?? key, vars), [dict]);

  const apiError = useCallback<I18n["apiError"]>(
    (result, fallback) => {
      const code = result?.code;
      if (code) {
        const key = `errors.${code}` as DictionaryKey;
        if (key in dict) return dict[key];
      }
      return result?.error || dict[fallback];
    },
    [dict],
  );

  const setLocale = useCallback<I18n["setLocale"]>(
    (next) => {
      if (!isLocale(next) || next === locale) return;
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
      // Apply direction immediately so the layout does not flash LTR while the server re-renders.
      const info = localeInfo(next);
      document.documentElement.lang = next;
      document.documentElement.dir = info.dir;
      router.refresh();
    },
    [locale, router],
  );

  const value = useMemo<I18n>(() => {
    const info = localeInfo(locale);
    return { locale, dir: info.dir, info, locales: LOCALES, t, fmt: createFormatters(locale), apiError, setLocale };
  }, [locale, t, apiError, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside <I18nProvider>.");
  return value;
}

/** Native-name dropdown; the choice applies to the whole workspace at once. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, locales, setLocale, t } = useI18n();
  return (
    <label className={`language-switcher ${className}`.trim()}>
      <span className="sr-only">{t("app.language")}</span>
      <select
        className="filter-select"
        value={locale}
        aria-label={t("app.language")}
        onChange={(event) => setLocale(isLocale(event.target.value) ? event.target.value : DEFAULT_LOCALE)}
      >
        {locales.map((item) => (
          <option key={item.code} value={item.code} lang={item.code} dir={item.dir}>
            {item.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
