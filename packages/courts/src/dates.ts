/**
 * Court dates come in many spellings: "2026-11-27", "27-11-2026", "27/11/2026",
 * "27th November 2026", "02nd January 2024", "27 Nov 2026", or a full timestamp.
 * All are read as an IST calendar day, "YYYY-MM-DD".
 */
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const IST_OFFSET_MS = 330 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

function day(y: number, m: number, d: number): string | null {
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejects 31 February and the like.
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** The IST calendar day of an instant. */
export const istDay = (d: Date): string => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export function parseCourtDate(input: unknown): string | null {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : istDay(input);
  if (typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return day(+m[1], +m[2], +m[3]);
  // A timestamp: the IST day it falls on.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : istDay(new Date(t));
  }
  // Indian order: day first.
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return day(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,})[\s,-]+(\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return month < 0 ? null : day(+m[3], month + 1, +m[1]);
  }
  return null;
}

/** "YYYY-MM-DD" plus n days. */
export function addDays(d: string, n: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Whole days from a to b (both "YYYY-MM-DD"). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
