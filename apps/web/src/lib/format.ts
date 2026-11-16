import type { Locale } from "@vakilmitra/shared";

const intl = (l: Locale) => (l === "mr" ? "mr-IN" : "en-IN");

export function rupees(paise: number, locale: Locale): string {
  return new Intl.NumberFormat(intl(locale), { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 ? 2 : 0 }).format(
    paise / 100,
  );
}

export function fmtDate(
  iso: string | Date,
  locale: Locale,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
) {
  return new Intl.DateTimeFormat(intl(locale), { ...opts, timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

/** Format a "YYYY-MM-DD" calendar day as e.g. "Mon, 16 Nov". */
export function fmtDay(day: string, locale: Locale) {
  return fmtDate(`${day}T12:00:00+05:30`, locale, { weekday: "short", day: "numeric", month: "short" });
}

export function fmtNumber(n: number, locale: Locale) {
  return n.toLocaleString(intl(locale));
}

export const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

/** "" -> null for optional text fields. */
export const orNull = (s: string | undefined | null) => (s?.trim() ? s.trim() : null);
