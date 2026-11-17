/**
 * Shared Zod schemas, enums, types and helpers for the API, web and mobile apps.
 * The API validates every request with these schemas; clients use the same ones for forms.
 */
import { z } from "zod";

export * from "./time.js";

// ---------- Enums ----------

export const LOCALES = ["mr", "en"] as const;
export const CASE_KINDS = ["CIVIL", "LAND_PROPERTY", "TITLE_SEARCH", "CRIMINAL", "FAMILY", "REVENUE", "OTHER"] as const;
export const CASE_STATUSES = ["ACTIVE", "DISPOSED", "ON_HOLD", "CLOSED"] as const;
/** Where a suit stands, in the usual order of a civil trial. */
export const CASE_STAGES = ["FILED", "SUMMONS", "WRITTEN_STATEMENT", "ISSUES", "EVIDENCE", "ARGUMENTS", "ORDER"] as const;
export type CaseStage = (typeof CASE_STAGES)[number];
export const PARTY_ROLES = ["PETITIONER", "RESPONDENT", "PLAINTIFF", "DEFENDANT", "APPLICANT", "OPPONENT", "APPELLANT", "OTHER"] as const;
export const CASE_ROLES = ["EDITOR", "VIEWER"] as const;
export const EVENT_KINDS = ["RECORD_SNAPSHOT", "DEED", "MUTATION"] as const;
export const DEED_SUBTYPES = ["SALE", "GIFT", "PARTITION", "MORTGAGE", "WILL", "RELEASE", "EXCHANGE", "OTHER"] as const;
export const MUTATION_SUBTYPES = [
  "SALE",
  "HEIRSHIP",
  "GIFT",
  "PARTITION",
  "MORTGAGE",
  "RELEASE",
  "EXCHANGE",
  "CORRECTION",
  "ACQUISITION",
  "OTHER",
] as const;
export const SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const PAYMENT_MODES = ["cash", "upi", "cheque", "bank"] as const;
export const DOC_TYPES = [
  "SEVEN_TWELVE",
  "FERFAR",
  "EIGHT_A",
  "INDEX_II",
  "SALE_DEED",
  "GIFT_DEED",
  "WILL",
  "PARTITION_DEED",
  "MORTGAGE_DEED",
  "COURT_ORDER",
  "OTHER",
] as const;
export const OCR_STATUSES = ["PENDING", "PROCESSING", "DONE", "FAILED"] as const;

export type Locale = (typeof LOCALES)[number];
export type CaseKind = (typeof CASE_KINDS)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type PartyRole = (typeof PARTY_ROLES)[number];
export type CaseRole = (typeof CASE_ROLES)[number];
export type EventKind = (typeof EVENT_KINDS)[number];
export type Severity = (typeof SEVERITIES)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export type DocType = (typeof DOC_TYPES)[number];
export type OcrStatus = (typeof OCR_STATUSES)[number];
export type CaseAccessLevel = "OWNER" | CaseRole;

// ---------- Building blocks ----------

/** ISO date ("2026-11-16") or datetime with offset, parsed to a Date. */
export const isoDate = z
  .string()
  .refine((s) => /^\d{4}-\d{2}-\d{2}(T.+)?$/.test(s) && !Number.isNaN(Date.parse(s)), "Expected an ISO date")
  .transform((s) => new Date(s));

const optText = (max: number) => z.string().trim().max(max).nullable().optional();

/** Rupees (may be decimal) to integer paise. */
export const toPaise = (rupees: number) => Math.round(rupees * 100);

// ---------- Inputs ----------

export const updateProfileInput = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: optText(20),
  barCouncilNo: optText(40),
  locale: z.enum(LOCALES).optional(),
  /** Allow hard-to-read pages to be sent to a cloud OCR provider. */
  cloudOcrConsent: z.boolean().optional(),
});

export const clientInput = z.object({
  name: z.string().trim().min(1).max(160),
  phone: optText(20),
  email: z
    .union([z.email(), z.literal("").transform(() => null)])
    .nullable()
    .optional(),
  address: optText(500),
  whatsappOptIn: z.boolean().optional(),
  notes: optText(5000),
});
export type ClientInput = z.input<typeof clientInput>;

export const caseInput = z.object({
  title: z.string().trim().min(1).max(300),
  kind: z.enum(CASE_KINDS).optional(),
  clientId: z.string().nullable().optional(),
  caseNumber: optText(80),
  court: optText(200),
  cnrNumber: optText(32),
  status: z.enum(CASE_STATUSES).optional(),
  stage: z.enum(CASE_STAGES).nullable().optional(),
  filedOn: isoDate.nullable().optional(),
  notes: optText(20000),
});
export type CaseInput = z.input<typeof caseInput>;

export const caseListQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.enum(CASE_STATUSES).optional(),
});

export const partyInput = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.enum(PARTY_ROLES),
  isOurClient: z.boolean().optional(),
  opposingCounsel: optText(200),
  address: optText(500),
});
export type PartyInput = z.input<typeof partyInput>;

export const grantInput = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  role: z.enum(CASE_ROLES).default("VIEWER"),
});

/** Hearing time of day, 24-hour "HH:MM" (court time, IST). */
const hearingTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
  .nullable()
  .optional();

export const hearingInput = z.object({
  date: isoDate,
  time: hearingTime,
  court: optText(200),
  courtHall: optText(40),
  purpose: optText(200),
  prepNotes: optText(2000),
  nextStep: optText(2000),
  outcome: optText(2000),
});

/** Recording what happened usually means setting the next date too: `next` creates it in the same call. */
export const hearingUpdateInput = hearingInput.partial().extend({
  next: z.object({ date: isoDate, time: hearingTime, purpose: optText(200) }).optional(),
});

export const dayQuery = z.object({ date: z.iso.date().optional() });
export const rangeQuery = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() });

export const propertyInput = z.object({
  surveyNo: optText(40),
  gatNo: optText(40),
  hissaNo: optText(40),
  village: optText(120),
  taluka: optText(120),
  district: optText(120),
});
export type PropertyInput = z.input<typeof propertyInput>;

/**
 * Field rules shared by create and update. Defaults live only on the create schema:
 * Zod keeps inner .default()s under .partial(), so an update built from a schema with
 * defaults would silently reset fields the client never sent.
 */
const eventFields = z.object({
  kind: z.enum(EVENT_KINDS),
  date: isoDate,
  subtype: z.string().trim().toUpperCase().max(40).nullable().optional(),
  ferfarNo: optText(40),
  deedRegNo: optText(60),
  refDeedRegNo: optText(60),
  fromParties: z.array(z.string().trim().min(1).max(200)).max(100),
  toParties: z.array(z.string().trim().min(1).max(200)).max(100),
  owners: z.array(z.string().trim().min(1).max(200)).max(100),
  areaSqm: z.number().nonnegative().nullable().optional(),
  landClass: optText(40),
  otherRights: z.array(z.string().trim().max(500)).max(50),
  section155: z.boolean(),
  factIds: z.array(z.string()).max(200),
  notes: optText(2000),
});
export const eventInput = eventFields.extend({
  fromParties: eventFields.shape.fromParties.default([]),
  toParties: eventFields.shape.toParties.default([]),
  owners: eventFields.shape.owners.default([]),
  otherRights: eventFields.shape.otherRights.default([]),
  section155: eventFields.shape.section155.default(false),
  factIds: eventFields.shape.factIds.default([]),
});
/** Update: only the fields sent are changed. */
export const eventUpdateInput = eventFields.partial();
export type EventInput = z.input<typeof eventInput>;

export const checkQuery = z.object({ lang: z.enum(LOCALES).optional() });

// ---------- Land-record extraction (facts) ----------

/** Records the extractor can read. A document of another type is extracted only if its text says which it is. */
export const RECORD_KINDS = ["SEVEN_TWELVE", "FERFAR", "INDEX_II"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const FACT_FIELDS = [
  "village",
  "taluka",
  "district",
  "survey_no",
  "gat_no",
  "hissa_no",
  "owner",
  "area",
  "land_class",
  "other_right",
  "ferfar_no",
  "date",
  "mutation_type",
  "deed_type",
  "section_155",
  "deed_reg_no",
  "from_party",
  "to_party",
] as const;
export type FactField = (typeof FACT_FIELDS)[number];
export const MUTATION_TYPES = ["SALE", "HEIRSHIP", "GIFT", "PARTITION", "MORTGAGE", "WILL", "RELEASE", "CORRECTION"] as const;
/** Deeds registered under Index-II. */
export const DEED_TYPES = ["SALE", "GIFT", "MORTGAGE", "PARTITION", "RELEASE", "EXCHANGE", "WILL"] as const;

/** "YYYY-MM-DD" naming a real calendar day (no 31 February rolling over into March). */
export function isRealDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/**
 * Format check for a fact's value, shared by the API and the review screen.
 * Returns a message key, or null when the value is usable.
 */
export function factValueProblem(
  field: FactField,
  value: string,
): "fact.badArea" | "fact.badDate" | "fact.badClass" | "fact.badType" | "fact.badYesNo" | null {
  const v = value.trim();
  switch (field) {
    case "area":
      return /^\d{1,9}$/.test(v) ? null : "fact.badArea";
    case "date":
      return isRealDate(v) ? null : "fact.badDate";
    case "land_class":
      return v === "Class-I" || v === "Class-II" ? null : "fact.badClass";
    case "mutation_type":
      return (MUTATION_TYPES as readonly string[]).includes(v) ? null : "fact.badType";
    case "deed_type":
      return (DEED_TYPES as readonly string[]).includes(v) ? null : "fact.badType";
    case "section_155":
      return v === "true" || v === "false" ? null : "fact.badYesNo";
    default:
      return null;
  }
}

export const factCreateInput = z.object({ field: z.enum(FACT_FIELDS), value: z.string().trim().min(1).max(500) });
export const factUpdateInput = z
  .object({ value: z.string().trim().min(1).max(500).optional(), reviewed: z.boolean().optional() })
  .refine((v) => v.value !== undefined || v.reviewed !== undefined, { message: "Nothing to update" });
export const eventFromDocumentInput = z.object({
  documentId: z.string(),
  /** The record's date when the document carries none (a 7/12 extract is dated by its year). */
  date: isoDate.optional(),
});

export const flagUpdateInput = z.object({ resolved: z.boolean(), resolution: optText(2000) });

export const feeAgreementInput = z.object({
  clientId: z.string(),
  caseId: z.string().nullable().optional(),
  description: z.string().trim().min(1).max(300),
  totalRupees: z.number().positive().max(1e9),
  installments: z
    .array(z.object({ dueDate: isoDate, amountRupees: z.number().positive().max(1e9), note: z.string().max(200).optional() }))
    .max(60)
    .optional(),
});
export type FeeAgreementInput = z.input<typeof feeAgreementInput>;

export const paymentInput = z.object({
  amountRupees: z.number().positive().max(1e9),
  paidOn: isoDate,
  mode: z.enum(PAYMENT_MODES).optional(),
  reference: z.string().trim().max(100).optional(),
});
export type PaymentInput = z.input<typeof paymentInput>;

export const searchQuery = z.object({ q: z.string().trim().max(200).optional() });

const documentFields = z.object({
  type: z.enum(DOC_TYPES),
  year: z.number().int().min(1800).max(2100).nullable().optional(),
  title: optText(200),
  propertyId: z.string().nullable().optional(),
});
export const documentInput = documentFields.extend({
  type: documentFields.shape.type.default("OTHER"),
  source: z.enum(["scan", "upload"]).default("scan"),
});
export type DocumentInput = z.input<typeof documentInput>;
/** Update: only the fields sent are changed (no defaults, see eventFields). */
export const documentUpdateInput = documentFields.partial();

/** Upload limits shared by clients (to resize before sending) and the API (to enforce). */
export const PAGE_UPLOAD = { maxBytes: 15 * 1024 * 1024, maxPages: 300, types: ["image/jpeg", "image/png", "image/webp"] } as const;

export const textSearchQuery = z.object({
  q: z.string().trim().min(2).max(200),
  caseId: z.string().optional(),
});

// ---------- Response shapes (dates are ISO strings over the wire) ----------

export interface Advocate {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  barCouncilNo?: string | null;
  locale: Locale;
  cloudOcrConsent: boolean;
  cloudOcrConsentAt?: string | null;
}
export interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsappOptIn: boolean;
  notes: string | null;
}
export interface ClientListItem extends Client {
  caseCount: number;
  outstandingPaise: number;
}
export interface Hearing {
  id: string;
  caseId: string;
  date: string;
  /** "HH:MM", court time. */
  time: string | null;
  court: string | null;
  courtHall: string | null;
  purpose: string | null;
  prepNotes: string | null;
  nextStep: string | null;
  outcome: string | null;
}
export interface CaseRef {
  id: string;
  title: string;
  caseNumber: string | null;
  court: string | null;
  status: CaseStatus;
  client: { id: string; name: string; phone: string | null } | null;
}
export interface HearingWithCase extends Hearing {
  case: CaseRef;
}
export interface Party {
  id: string;
  name: string;
  role: PartyRole;
  isOurClient: boolean;
  opposingCounsel: string | null;
  address: string | null;
}
export interface Property {
  id: string;
  surveyNo: string | null;
  gatNo: string | null;
  hissaNo: string | null;
  village: string | null;
  taluka: string | null;
  district: string | null;
}
export interface Flag {
  id: string;
  propertyId: string | null;
  rule: string;
  severity: Severity;
  message: string;
  eventIds: string[];
  factIds: string[];
  resolved: boolean;
  resolution: string | null;
}
export interface OwnershipEvent {
  id: string;
  kind: EventKind;
  date: string;
  subtype: string | null;
  ferfarNo: string | null;
  deedRegNo: string | null;
  refDeedRegNo: string | null;
  fromParties: string[];
  toParties: string[];
  owners: string[];
  areaSqm: number | null;
  landClass: string | null;
  otherRights: string[];
  section155: boolean;
  notes: string | null;
}
export interface Payment {
  id: string;
  amountPaise: number;
  paidOn: string;
  mode: string | null;
  reference: string | null;
}
export interface Installment {
  id: string;
  dueDate: string;
  amountPaise: number;
  note: string | null;
}
export interface FeeAgreement {
  id: string;
  clientId: string;
  caseId: string | null;
  description: string;
  totalPaise: number;
  installments: Installment[];
  payments: Payment[];
  case?: { id: string; title: string; caseNumber: string | null; court: string | null } | null;
}
export interface CaseListItem extends CaseRef {
  kind: CaseKind;
  shared: boolean;
  openFlags: number;
  nextHearing: Hearing | null;
}
export interface CaseDetail extends CaseRef {
  kind: CaseKind;
  stage: CaseStage | null;
  clientId: string | null;
  cnrNumber: string | null;
  filedOn: string | null;
  notes: string | null;
  parties: Party[];
  properties: (Property & { eventCount: number })[];
  hearings: Hearing[];
  flags: Flag[];
  feeAgreements: FeeAgreement[];
  drafts: { id: string; title: string; status: "DRAFT" | "APPROVED"; language: Locale; updatedAt: string }[];
  grants: { id: string; role: CaseRole; advocate: { id: string; name: string; email: string } }[];
}
export interface ClientTotals {
  clientId: string;
  clientName: string;
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  /** Installments already due minus everything paid (never negative). */
  overduePaise: number;
  nextDue: { date: string; amountPaise: number } | null;
}
export interface PageSummary {
  id: string;
  pageNo: number;
  width: number | null;
  height: number | null;
  ocrStatus: OcrStatus;
  ocrConfidence: number | null;
  ocrError: string | null;
}
export interface PageDetail extends PageSummary {
  ocrText: string | null;
  ocrEngine: string | null;
  /** local | local:no-consent | local:confident | local:cloud-queued | cloud | local:cloud-failed | local:cloud-empty */
  ocrRoute: string | null;
  ocrWords: { t: string; c: number; b: [number, number, number, number] }[] | null;
}
export interface DocumentSummary {
  id: string;
  caseId: string;
  propertyId: string | null;
  type: DocType;
  year: number | null;
  title: string | null;
  source: string;
  ocrStatus: OcrStatus;
  pageCount: number;
  createdAt: string;
}
export interface DocumentDetail extends DocumentSummary {
  pages: PageDetail[];
}
export interface Fact {
  id: string;
  documentId: string | null;
  pageId: string | null;
  field: FactField;
  value: string;
  /** What the extractor read, when the advocate has corrected it. */
  originalValue: string | null;
  position: number;
  confidence: number;
  /** Source crop on the page, as fractions of the page. Null for facts read from the whole page or added by hand. */
  crop: { x: number; y: number; w: number; h: number } | null;
  reviewed: boolean;
  reviewedAt: string | null;
}
/** Title search report, assembled from a property's chain (see apps/api/src/land/report.ts). */
export interface TitleReport {
  property: {
    village: string | null;
    taluka: string | null;
    district: string | null;
    surveyNo: string | null;
    gatNo: string | null;
    hissaNo: string | null;
    areaSqm: number | null;
    landClass: string | null;
  };
  /** The search period: earliest record to the report date, and whether it covers the required years. */
  period: { from: string | null; to: string; years: number; complete: boolean };
  /** Owners at the end of the chain, as per the latest 7/12 and later transfers. */
  owners: { names: string[]; asPerEventId: string; asPerDate: string } | null;
  chain: {
    id: string;
    date: string;
    kind: EventKind;
    subtype: string | null;
    ferfarNo: string | null;
    deedRegNo: string | null;
    from: string[];
    to: string[];
    owners: string[];
    areaSqm: number | null;
    section155: boolean;
    notes: string | null;
    documentId: string | null;
  }[];
  encumbrances: { source: "other_right" | "mortgage"; text: string; category: string | null; eventId: string | null }[];
  flags: {
    open: { id: string; rule: string; severity: Severity; message: string; eventIds: string[] }[];
    resolved: { id: string; rule: string; severity: Severity; message: string; resolution: string | null; eventIds: string[] }[];
  };
  documents: { id: string; type: string; year: number | null; title: string | null; pageCount: number }[];
}

/** The advocate's opinion and sign-off on a title report. */
export interface ReportDraft {
  id: string;
  language: Locale;
  opinion: string;
  status: "DRAFT" | "APPROVED";
  approvedAt: string | null;
  approvedBy: string | null;
  /** The report as it stood when approved; it does not change when the chain does. */
  approved: TitleReport | null;
  updatedAt: string;
}

export interface TitleReportResponse {
  /** The report from the chain as it is now. */
  report: TitleReport;
  draft: ReportDraft | null;
  /** True when an approved report no longer matches the chain (records or flags changed since). */
  changedSinceApproval: boolean;
  advocate: { name: string; barCouncilNo: string | null; phone: string | null; email: string };
  client: { name: string } | null;
  caseTitle: string;
}

export const reportDraftInput = z.object({ opinion: z.string().max(20_000), language: z.enum(LOCALES) });

export interface Extraction {
  /** The record kind used, or null when the document could not be identified. */
  kind: RecordKind | null;
  facts: Fact[];
  /** Events already built from this document, by property. */
  events: { id: string; propertyId: string }[];
}
export interface SearchHit {
  pageId: string;
  pageNo: number;
  documentId: string;
  documentType: DocType;
  documentTitle: string | null;
  caseId: string;
  caseTitle: string;
  /** Text around the first match; the match is at [matchStart, matchEnd). */
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

export interface FeeTotals {
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  overduePaise: number;
}
