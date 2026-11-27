/**
 * What changed between two readings of a case, as the advocate would want to hear it:
 * a new next date, a new order, or the case being disposed of. Other differences (a reworded
 * status, a new judge name) are not news. The first reading reports nothing: the past orders
 * and the current date are not "new", they are where the case stands.
 */
import type { CourtChange, CourtChangeKind } from "@vakilmitra/shared";
import type { CourtCase, CourtOrder } from "./types.js";

export type { CourtChange, CourtChangeKind } from "@vakilmitra/shared";
export const COURT_CHANGE_KINDS = ["NEXT_DATE", "NEW_ORDER", "DISPOSED"] as const satisfies readonly CourtChangeKind[];

const orderKey = (o: CourtOrder) => `${o.date}|${o.url ?? o.title ?? ""}`;

export function courtChanges(prev: CourtCase | null, next: CourtCase): CourtChange[] {
  if (!prev) return [];
  const changes: CourtChange[] = [];
  if (next.disposed && !prev.disposed) changes.push({ kind: "DISPOSED", on: next.decidedOn, nature: next.disposalNature });
  // A blank next date is not news on its own: services often blank it the day the case is heard.
  if (!next.disposed && next.nextHearingDate && next.nextHearingDate !== prev.nextHearingDate) {
    changes.push({ kind: "NEXT_DATE", from: prev.nextHearingDate, to: next.nextHearingDate, purpose: next.nextPurpose });
  }
  const seen = new Set(prev.orders.map(orderKey));
  // Oldest first, so alerts read in the order the court made them.
  for (const o of [...next.orders].reverse()) {
    if (!seen.has(orderKey(o))) changes.push({ kind: "NEW_ORDER", date: o.date, title: o.title, url: o.url });
  }
  return changes;
}
