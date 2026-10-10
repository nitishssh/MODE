/** Display helpers. Money is integer paise everywhere in the API. */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function money(paise: number | null | undefined, { whole = false } = {}): string {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return "—";
  if (paise === 0) return "Free";
  return (whole ? inrWhole : inr).format(paise / 100);
}

/** Always numeric, never "Free": for ledgers and totals. */
export function amount(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return "—";
  return inr.format(paise / 100);
}

/** Rupees typed in a form ("349.50") to integer paise, or null when invalid. */
export function rupeesToPaise(value: string): number | null {
  const trimmed = value.trim().replace(/[₹,\s]/g, "");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function paiseToRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return (paise / 100).toFixed(2);
}

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const dateFmt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
const longDateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeStyle: "short", timeZone: "Asia/Kolkata" });

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateTimeFmt.format(d);
}

export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Date-only values (YYYY-MM-DD) are club calendar days; render them as-is in local calendar terms.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-").map(Number);
    return dateFmt.format(new Date(Date.UTC(y, m - 1, d, 12)));
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : longDateFmt.format(d);
}

export function time(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : timeFmt.format(d);
}

/** "in 3 days", "2 hours ago", "just now". */
export function relative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = then - now;
  const abs = Math.abs(diff);
  const minute = 60_000, hour = 3_600_000, day = 86_400_000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < minute) return "just now";
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < day * 30) return rtf.format(Math.round(diff / day), "day");
  return dateFmt.format(new Date(then));
}

/** Remaining time for a hold as "12:34"; empty string when passed. */
export function countdown(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const left = new Date(iso).getTime() - now;
  if (left <= 0) return "";
  const total = Math.floor(left / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** ISO UTC → value for <input type="datetime-local"> in the viewer's local zone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO with offset (what the API's z.iso.datetime({offset:true}) accepts). */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}
