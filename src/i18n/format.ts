import { localeInfo, type Locale } from "./locales";

export interface Formatters {
  /** Integer paise → localized rupee amount, e.g. ₹1,250.00. */
  currency: (paise: number) => string;
  /** Full date on the club calendar (Asia/Kolkata), e.g. 10 Oct 2026. */
  date: (iso: string) => string;
  /** Two-digit day of month for date tiles. */
  day: (iso: string) => string;
  /** Short month name for date tiles. */
  month: (iso: string) => string;
  /** Plain integer with locale grouping. */
  number: (value: number) => string;
}

const CLUB_TZ = "Asia/Kolkata";

/**
 * Locale-aware formatters. Digits are pinned to Latin (`-u-nu-latn`) in every
 * language so amounts and dates match the ledger, receipts and CSV export
 * exactly; only month names, grouping and the currency symbol localize.
 */
export function createFormatters(locale: Locale): Formatters {
  const tag = `${localeInfo(locale).intl}-u-nu-latn`;
  const currency = new Intl.NumberFormat(tag, { style: "currency", currency: "INR", maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", year: "numeric", timeZone: CLUB_TZ });
  const day = new Intl.DateTimeFormat(tag, { day: "2-digit", timeZone: CLUB_TZ });
  const month = new Intl.DateTimeFormat(tag, { month: "short", timeZone: CLUB_TZ });
  const number = new Intl.NumberFormat(tag);
  return {
    currency: (paise) => currency.format(paise / 100),
    date: (iso) => date.format(new Date(iso)),
    day: (iso) => day.format(new Date(iso)),
    month: (iso) => month.format(new Date(iso)),
    number: (value) => number.format(value),
  };
}
