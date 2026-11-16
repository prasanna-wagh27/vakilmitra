/**
 * Day boundaries in India Standard Time. India has no DST, so a fixed +05:30 offset is exact.
 * Court dates are calendar days in IST regardless of where the server runs.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" for the IST calendar day containing `d`. */
export function istDate(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** [start, end) instants of an IST calendar day given as "YYYY-MM-DD" (default: today). */
export function istDayRange(day: string = istDate()): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    throw new RangeError(`Invalid date ${day}`);
  }
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

export const startOfTodayIst = () => istDayRange().start;
