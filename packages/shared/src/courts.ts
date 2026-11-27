/**
 * Court case tracking, as the API sends it and the apps show it. The readings come from a
 * court-data service (packages/courts); here are the shapes and the CNR rules both sides use.
 */
import { z } from "zod";

/**
 * A court case as read from eCourts. Dates are IST calendar days, "YYYY-MM-DD".
 * Every court-data service's answer is turned into this shape.
 */
export interface CourtCase {
  cnr: string;
  /** Disposed (decided, withdrawn, transferred out...). Tracking stops once a case is disposed. */
  disposed: boolean;
  /** The status as the court shows it, e.g. "Case pending" or "Disposed". */
  statusText: string | null;
  caseType: string | null;
  /** e.g. "RCS/123/2024". */
  caseNumber: string | null;
  /** The court or establishment, e.g. "Civil Court Senior Division, Pune". */
  court: string | null;
  /** Court number and judge, as listed, e.g. "12-3rd Jt. Civil Judge S.D.". */
  courtNo: string | null;
  filedOn: string | null;
  nextHearingDate: string | null;
  /** The stage or purpose for the next date, e.g. "Evidence". */
  nextPurpose: string | null;
  lastHearingDate: string | null;
  decidedOn: string | null;
  /** How it was disposed of, e.g. "Decreed", "Dismissed". */
  disposalNature: string | null;
  petitioners: string[];
  respondents: string[];
  /** Past business dates, newest first. */
  history: CourtHearing[];
  /** Orders and judgments, newest first. */
  orders: CourtOrder[];
}

export interface CourtHearing {
  date: string;
  purpose: string | null;
  judge: string | null;
}

export interface CourtOrder {
  date: string;
  title: string | null;
  /** Link to the order's PDF on the court's site, when the service gives one. */
  url: string | null;
}

/** What a reading found new. */
export type CourtChange =
  | { kind: "NEXT_DATE"; from: string | null; to: string; purpose: string | null }
  | { kind: "NEW_ORDER"; date: string; title: string | null; url: string | null }
  | { kind: "DISPOSED"; on: string | null; nature: string | null };
export type CourtChangeKind = CourtChange["kind"];

export const TRACKING_STATUSES = ["PENDING", "OK", "NOT_FOUND", "ERROR"] as const;
export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

/** A case's tracking, as the case page shows it. */
export interface CaseTracking {
  cnr: string;
  status: TrackingStatus;
  /** Why the last reading failed, in plain words (no service internals). */
  error: string | null;
  snapshot: CourtCase | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface CourtUpdate {
  id: string;
  caseId: string;
  change: CourtChange;
  createdAt: string;
}
export interface CourtUpdateWithCase extends CourtUpdate {
  case: { id: string; title: string; caseNumber: string | null; court: string | null };
}

export interface CaseTrackingResponse {
  /** False when no court-data service is set up: the case page explains tracking is not available yet. */
  available: boolean;
  tracking: CaseTracking | null;
  updates: CourtUpdate[];
}

/**
 * CNR (Case Number Record): the 16-character number eCourts gives every case in the district
 * courts and High Courts. Four letters for the state and district or High Court bench (MHPU =
 * Pune, HCBM = Bombay High Court), two digits for the establishment, six for the case, four for
 * the year. People copy it with spaces and dashes (MHPU01-001234-2024); those are dropped.
 */
const CNR = /^[A-Z]{4}\d{12}$/;

/** The CNR in its plain 16-character form, or null when it is not a CNR. */
export function normalizeCnr(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = input.toUpperCase().replace(/[\s\-/.]/g, "");
  if (!CNR.test(s)) return null;
  const year = Number(s.slice(12));
  // CNRs were also given to old cases when they were entered, so allow from 1950.
  if (year < 1950 || year > new Date().getFullYear() + 1) return null;
  return s;
}

/** "MHPU010012342024" → "MHPU01-001234-2024", easier to read back on screen. */
export const formatCnr = (cnr: string) => (CNR.test(cnr) ? `${cnr.slice(0, 6)}-${cnr.slice(6, 12)}-${cnr.slice(12)}` : cnr);

/** Turning tracking on: the CNR given, or the one already saved on the case. */
export const trackingInput = z.object({
  cnr: z
    .string()
    .trim()
    .max(40)
    .optional()
    .refine((v) => v === undefined || v === "" || normalizeCnr(v) !== null, "Not a CNR: 16 characters, like MHPU010012342024"),
});

export const courtUpdatesQuery = z.object({ days: z.coerce.number().int().min(1).max(30).default(7) });
