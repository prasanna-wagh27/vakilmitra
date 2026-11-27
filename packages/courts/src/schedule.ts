/**
 * When to read a tracked case again. Every reading costs money, so a case is read only when
 * something is likely to have changed. The worker runs this every evening, once courts have
 * updated their records:
 *   - never read yet → tonight
 *   - disposed → never again
 *   - the next date has passed or is today (the case was heard), or there is no date → every
 *     evening until the new date appears; weekly if nothing has changed for 45 days
 *   - listed tomorrow → tonight, to confirm the listing
 *   - listed later → once a week, to catch adjournments and new orders
 *   - not found or failing → every evening for the first 14 days (new cases take a while to
 *     appear), then weekly
 */

import type { TrackingStatus } from "@vakilmitra/shared";
import { addDays, daysBetween, istDay } from "./dates.js";
import type { CourtCase } from "./types.js";

export type { TrackingStatus } from "@vakilmitra/shared";

export interface TrackingState {
  status: TrackingStatus;
  snapshot: CourtCase | null;
  lastCheckedAt: Date | null;
  /** The last reading that brought a change (or when tracking started). */
  lastChangedAt: Date | null;
  createdAt: Date;
}

const HOUR = 3_600_000;
/** A weekly check is due after 6½ days, so the evening run does not drift a day later each week. */
const WEEK_MS = 6.5 * 24 * HOUR;
const QUIET_DAYS = 45;
const NEW_CASE_DAYS = 14;

export function isDue(t: TrackingState, now: Date): boolean {
  if (!t.lastCheckedAt) return true;
  if (t.snapshot?.disposed) return false;
  const sinceCheck = now.getTime() - t.lastCheckedAt.getTime();
  // Read at most once an evening (a refresh asked for by hand counts).
  if (sinceCheck < 20 * HOUR) return false;
  const weekly = sinceCheck >= WEEK_MS;
  const today = istDay(now);

  if (t.status !== "OK" || !t.snapshot) return daysBetween(istDay(t.createdAt), today) <= NEW_CASE_DAYS || weekly;

  const next = t.snapshot.nextHearingDate;
  if (!next || next <= today) {
    const quiet = daysBetween(istDay(t.lastChangedAt ?? t.createdAt), today);
    return quiet <= QUIET_DAYS || weekly;
  }
  if (next <= addDays(today, 1)) return true;
  return weekly;
}
