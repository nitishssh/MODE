/**
 * Supported interface languages: English plus eleven of the most spoken
 * scheduled languages of India (2011 Census order by first-language speakers).
 * Pure module: no Next.js imports, so it is usable from tests, the proxy,
 * server components and the browser alike.
 */

export const LOCALE_COOKIE = "mode_lang";
/** One year; the choice is a preference, not a credential. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Direction = "ltr" | "rtl";

export interface LocaleInfo {
  /** BCP 47 language subtag used in the cookie, `<html lang>` and dictionary file names. */
  code: Locale;
  /** English name, for logs and tests. */
  name: string;
  /** Name in its own script, shown in the language switcher. */
  nativeName: string;
  /** Full tag for Intl formatters (`-IN` region keeps lakh/crore grouping and the rupee symbol). */
  intl: string;
  dir: Direction;
}

export const LOCALES = [
  { code: "en", name: "English", nativeName: "English", intl: "en-IN", dir: "ltr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", intl: "hi-IN", dir: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", intl: "bn-IN", dir: "ltr" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", intl: "mr-IN", dir: "ltr" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", intl: "te-IN", dir: "ltr" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", intl: "ta-IN", dir: "ltr" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", intl: "gu-IN", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", intl: "ur-IN", dir: "rtl" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", intl: "kn-IN", dir: "ltr" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", intl: "ml-IN", dir: "ltr" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", intl: "pa-IN", dir: "ltr" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া", intl: "as-IN", dir: "ltr" },
] as const satisfies readonly { code: string; name: string; nativeName: string; intl: string; dir: Direction }[];

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

const BY_CODE: ReadonlyMap<string, LocaleInfo> = new Map(LOCALES.map((info) => [info.code, info as LocaleInfo]));

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && BY_CODE.has(value);
}

export function localeInfo(locale: Locale): LocaleInfo {
  return BY_CODE.get(locale)!;
}

/**
 * Pick the best supported language from an `Accept-Language` header.
 * Honours q-weights, matches `hi-IN` and `pa-Guru-IN` to their base language,
 * ignores malformed entries and falls back to the default locale.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((param) => param.trim().match(/^q=(\d(?:\.\d{0,3})?)$/i))
        .find(Boolean);
      const weight = q ? Number(q[1]) : 1;
      return { tag: tag.trim().toLowerCase(), weight: Number.isFinite(weight) ? weight : 0, index };
    })
    .filter((entry) => entry.tag && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { tag } of ranked) {
    if (tag === "*") return DEFAULT_LOCALE;
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/**
 * The one rule for which language a request is served in:
 * an explicit, valid cookie wins; otherwise the browser's `Accept-Language`;
 * otherwise English.
 */
export function resolveLocale(input: { cookie?: string | null; acceptLanguage?: string | null }): Locale {
  if (isLocale(input.cookie)) return input.cookie;
  return negotiateLocale(input.acceptLanguage);
}

/** Replace `{name}` placeholders. Unknown placeholders are left visible so missing data is noticed, not hidden. */
export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
