/**
 * Day boundaries in India Standard Time. India has no DST, so a fixed +05:30 offset is exact.
 * Court dates are calendar days in IST regardless of where the server or phone runs.
 */
import { addDays as addDaysToDate, format } from "date-fns";

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" for the IST calendar day containing `d`. */
export function istDate(d: Date | string = new Date()): string {
  return new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** [start, end) instants of an IST calendar day given as "YYYY-MM-DD" (default: today). */
export function istDayRange(day: string = istDate()): { start: Date; end: Date } {
  if (!DAY_PATTERN.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) throw new RangeError(`Invalid date ${day}`);
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);
  return { start, end: addDaysToDate(start, 1) };
}

/** Add days to a "YYYY-MM-DD" calendar day. */
export function addDays(day: string, n: number): string {
  return format(addDaysToDate(new Date(`${day}T12:00:00`), n), "yyyy-MM-dd");
}

/** A court date picked as a calendar day, stored as 11:00 IST on that day. */
export function courtDateIso(day: string): string {
  return new Date(`${day}T11:00:00+05:30`).toISOString();
}
