/**
 * Made-up court records for development and staging, so the whole flow (tracking, diary
 * dates, alerts, the evening email) can be tried without a paid service. Each CNR always gets
 * the same case; its next date moves forward a little every few days, as adjournments do.
 * Refused in production (see config.ts).
 */
import { addDays, istDay } from "./dates.js";
import type { CourtCase, CourtProvider } from "./types.js";

function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Monday to Saturday: courts do not sit on Sundays. */
function courtDay(d: string): string {
  return new Date(`${d}T00:00:00Z`).getUTCDay() === 0 ? addDays(d, 1) : d;
}

export class DemoCourtProvider implements CourtProvider {
  readonly name = "demo";
  constructor(private readonly now: () => Date = () => new Date()) {}

  async fetchCase(cnr: string): Promise<CourtCase | null> {
    const h = hash(cnr);
    const serial = cnr.slice(6, 12);
    // Case number 000000 has no case, to try "not found"; one ending 999 is disposed.
    if (serial === "000000") return null;
    const today = istDay(this.now());
    const year = cnr.slice(12);
    // The next date jumps every 5 days, to between 3 and 24 days ahead.
    const epoch = Math.floor(Date.parse(`${today}T00:00:00Z`) / (5 * 86_400_000));
    const next = courtDay(addDays(today, 3 + ((h + epoch) % 22)));
    const last = courtDay(addDays(today, -((h % 20) + 5)));
    const disposed = serial.endsWith("999");
    const stages = ["Evidence", "Arguments", "Written statement", "Issues", "Summons"];
    return {
      cnr,
      disposed,
      statusText: disposed ? "Disposed" : "Case pending",
      caseType: "R.C.S.",
      caseNumber: `RCS/${(h % 900) + 100}/${year}`,
      court: "Civil Court Senior Division, Pune",
      courtNo: `${(h % 14) + 1}-Jt. Civil Judge S.D.`,
      filedOn: `${year}-0${(h % 9) + 1}-1${h % 9}`,
      nextHearingDate: disposed ? null : next,
      nextPurpose: disposed ? null : stages[h % stages.length],
      lastHearingDate: last,
      decidedOn: disposed ? last : null,
      disposalNature: disposed ? "Decreed" : null,
      petitioners: ["Ramesh Patil"],
      respondents: ["Suresh Jadhav"],
      history: [{ date: last, purpose: stages[(h + 1) % stages.length], judge: null }],
      orders: [{ date: last, title: "Order", url: null }],
    };
  }
}
