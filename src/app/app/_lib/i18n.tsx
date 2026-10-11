"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { AppDictionary, AppKey } from "@/i18n/app";
import { createFormatters, type Formatters } from "@/i18n/format";
import { interpolate, localeInfo, type Locale } from "@/i18n/locales";
import { ApiError } from "./api";

type Vars = Record<string, string | number>;

export interface AppI18n {
  locale: Locale;
  /** Translate a key, substituting `{placeholders}`. */
  t: (key: AppKey, vars?: Vars) => string;
  /** Locale-aware currency/date formatters with Latin digits (shared with the legacy workspace). */
  fmt: Formatters & {
    /** Date and time on the club calendar, e.g. "10 Oct 2026, 1:30 pm". */
    dateTime: (iso: string | null | undefined) => string;
    /** Weekday, day, month and year, for the overview heading. */
    longDate: (iso: string | null | undefined) => string;
    /** Relative phrase such as "in 3 days" or "2 hours ago". */
    relative: (iso: string | null | undefined) => string;
  };
  /**
   * Readable message for a failed request: a translated family message for a
   * known stable code, otherwise the server's own explanation, otherwise the fallback key.
   */
  apiError: (error: unknown, fallback?: AppKey) => string;
}

const Context = createContext<AppI18n | null>(null);

export function AppI18nProvider({ locale, dict, children }: { locale: Locale; dict: AppDictionary; children: ReactNode }) {
  const t = useCallback<AppI18n["t"]>((key, vars) => interpolate(dict[key] ?? key, vars), [dict]);

  const fmt = useMemo<AppI18n["fmt"]>(() => {
    const base = createFormatters(locale);
    const tag = `${localeInfo(locale).intl}-u-nu-latn`;
    const dateTime = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
    const longDate = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    const rtf = new Intl.RelativeTimeFormat(localeInfo(locale).intl, { numeric: "auto" });
    const safe = (iso: string | null | undefined, format: (d: Date) => string) => {
      if (!iso) return "—";
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? iso : format(d);
    };
    return {
      ...base,
      date: (iso) => safe(iso, (d) => base.date(d.toISOString())),
      dateTime: (iso) => safe(iso, (d) => dateTime.format(d)),
      longDate: (iso) => safe(iso, (d) => longDate.format(d)),
      relative: (iso) => safe(iso, (d) => {
        const diff = d.getTime() - Date.now();
        const abs = Math.abs(diff);
        const minute = 60_000, hour = 3_600_000, day = 86_400_000;
        if (abs < minute) return dict["time.justNow"];
        if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
        if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
        if (abs < day * 30) return rtf.format(Math.round(diff / day), "day");
        return base.date(d.toISOString());
      }),
    };
  }, [locale, dict]);

  const apiError = useCallback<AppI18n["apiError"]>((error, fallback = "apiError.server") => {
    if (error instanceof ApiError) {
      const key = error.code ? (`apiError.${error.code}` as AppKey) : null;
      if (key && key in dict) return dict[key];
      return error.message || dict[fallback];
    }
    if (error instanceof Error && error.message) return error.message;
    return dict[fallback];
  }, [dict]);

  const value = useMemo<AppI18n>(() => ({ locale, t, fmt, apiError }), [locale, t, fmt, apiError]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useT(): AppI18n {
  const value = useContext(Context);
  if (!value) throw new Error("useT must be used inside <AppI18nProvider>.");
  return value;
}
