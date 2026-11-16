import type { Locale } from "./types";

const intl = (l: Locale) => (l === "mr" ? "mr-IN" : "en-IN");

export function rupees(paise: number, locale: Locale): string {
  return new Intl.NumberFormat(intl(locale), { style: "currency", currency: "INR", maximumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
}

export function fmtDate(iso: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Intl.DateTimeFormat(intl(locale), { ...opts, timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export function fmtDay(iso: string | Date, locale: Locale): string {
  return fmtDate(iso, locale, { weekday: "short", day: "numeric", month: "short" });
}

/** "YYYY-MM-DD" of a date in IST. */
export function istDate(d: Date | string = new Date()): string {
  return new Date(new Date(d).getTime() + 330 * 60000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

/** A court date chosen as a calendar day, stored as 11:00 IST that day. */
export function courtDateIso(day: string): string {
  return new Date(`${day}T11:00:00+05:30`).toISOString();
}

export const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
