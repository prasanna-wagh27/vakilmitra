// VakilMitra core data model.
// The case file is the single core object: every feature reads from and writes to it,
// and every extracted fact keeps a link to the exact crop of the scan it came from.

import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const ts = (name: string) => timestamp(name, { withTimezone: true });
const textArray = (name: string) => text(name).array().notNull().default(sql`'{}'::text[]`);

// ---------- Enums ----------

export const localeEnum = pgEnum("locale", ["mr", "en"]);
export const caseRoleEnum = pgEnum("case_role", ["EDITOR", "VIEWER"]);
export const caseStatusEnum = pgEnum("case_status", ["ACTIVE", "DISPOSED", "ON_HOLD", "CLOSED"]);
export const caseKindEnum = pgEnum("case_kind", ["CIVIL", "LAND_PROPERTY", "TITLE_SEARCH", "CRIMINAL", "FAMILY", "REVENUE", "OTHER"]);
export const partyRoleEnum = pgEnum("party_role", [
  "PETITIONER",
  "RESPONDENT",
  "PLAINTIFF",
  "DEFENDANT",
  "APPLICANT",
  "OPPONENT",
  "APPELLANT",
  "OTHER",
]);
export const docTypeEnum = pgEnum("doc_type", [
  "SEVEN_TWELVE", // ७/१२ उतारा
  "FERFAR", // फेरफार नोंद
  "EIGHT_A", // ८-अ
  "INDEX_II", // सूची क्र. २
  "SALE_DEED",
  "GIFT_DEED",
  "WILL",
  "PARTITION_DEED",
  "MORTGAGE_DEED",
  "COURT_ORDER",
  "OTHER",
]);
export const ocrStatusEnum = pgEnum("ocr_status", ["PENDING", "PROCESSING", "DONE", "FAILED"]);
export const eventKindEnum = pgEnum("event_kind", ["RECORD_SNAPSHOT", "DEED", "MUTATION"]);
export const severityEnum = pgEnum("flag_severity", ["HIGH", "MEDIUM", "LOW"]);
export const draftStatusEnum = pgEnum("draft_status", ["DRAFT", "APPROVED"]);

// ---------- Better Auth tables (advocate = Better Auth "user") ----------

export const advocates = pgTable("advocate", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  phone: text("phone"),
  barCouncilNo: text("bar_council_no"),
  locale: localeEnum("locale").notNull().default("mr"),
  // Consent to send hard-to-read pages to a cloud OCR provider (off by default). See packages/ocr.
  cloudOcrConsent: boolean("cloud_ocr_consent").notNull().default(false),
  cloudOcrConsentAt: ts("cloud_ocr_consent_at"),
  // Consent to send client text (page text, drafting notes) to the configured AI models (off by default). See packages/ai.
  aiConsent: boolean("ai_consent").notNull().default(false),
  aiConsentAt: ts("ai_consent_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => advocates.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => advocates.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------- Case-by-case sharing with juniors ----------

export const caseAccess = pgTable(
  "case_access",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    advocateId: text("advocate_id")
      .notNull()
      .references(() => advocates.id, { onDelete: "cascade" }),
    role: caseRoleEnum("role").notNull().default("VIEWER"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("case_access_case_advocate_uq").on(t.caseId, t.advocateId), index("case_access_advocate_idx").on(t.advocateId)],
);

// ---------- Clients and case files ----------

export const clients = pgTable(
  "client",
  {
    id: id(),
    advocateId: text("advocate_id")
      .notNull()
      .references(() => advocates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    // Client consented to WhatsApp case updates. Each message still needs advocate approval.
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("client_advocate_idx").on(t.advocateId)],
);

export const cases = pgTable(
  "case_file",
  {
    id: id(),
    advocateId: text("advocate_id")
      .notNull()
      .references(() => advocates.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    kind: caseKindEnum("kind").notNull().default("CIVIL"),
    caseNumber: text("case_number"),
    court: text("court"),
    cnrNumber: text("cnr_number"), // eCourts CNR, for status fetch where reliable
    status: caseStatusEnum("status").notNull().default("ACTIVE"),
    stage: text("stage"), // one of CASE_STAGES; validated by the API
    filedOn: ts("filed_on"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("case_advocate_status_idx").on(t.advocateId, t.status), index("case_client_idx").on(t.clientId)],
);

export const parties = pgTable(
  "party",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    role: partyRoleEnum("role").notNull(),
    isOurClient: boolean("is_our_client").notNull().default(false),
    opposingCounsel: text("opposing_counsel"),
    address: text("address"),
    createdAt: createdAt(),
  },
  (t) => [index("party_case_idx").on(t.caseId)],
);

// ---------- Land records ----------

export const properties = pgTable(
  "property",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    surveyNo: text("survey_no"), // सर्वे नंबर
    gatNo: text("gat_no"), // गट नंबर
    hissaNo: text("hissa_no"), // हिस्सा नंबर
    village: text("village"),
    taluka: text("taluka"),
    district: text("district"),
    createdAt: createdAt(),
  },
  (t) => [index("property_case_idx").on(t.caseId)],
);

export const documents = pgTable(
  "document",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    propertyId: text("property_id").references(() => properties.id, { onDelete: "set null" }),
    type: docTypeEnum("type").notNull().default("OTHER"),
    year: integer("year"),
    title: text("title"),
    storageKey: text("storage_key"), // object key in India-region S3-compatible storage
    mimeType: text("mime_type"),
    // Rolled up from its pages: PENDING until uploaded pages exist, DONE when all are read.
    ocrStatus: ocrStatusEnum("ocr_status").notNull().default("PENDING"),
    source: text("source").notNull().default("scan"), // scan (in-app camera) | upload (file/PDF)
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("document_case_idx").on(t.caseId)],
);

export const pages = pgTable(
  "page",
  {
    id: id(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    pageNo: integer("page_no").notNull(),
    // Bumped on every re-upload or re-read request; an OCR job only saves if it read the current version.
    version: integer("version").notNull().default(1),
    storageKey: text("storage_key").notNull(), // encrypted image (see packages/storage)
    byteSize: integer("byte_size"),
    width: integer("width"),
    height: integer("height"),
    ocrStatus: ocrStatusEnum("ocr_status").notNull().default("PENDING"),
    ocrEngine: text("ocr_engine"), // e.g. tesseract-mar+eng, sarvam-vision, gemini-vertex:gemini-3.5-flash
    // How the engine was chosen: local | local:no-consent | local:confident | local:cloud-queued | cloud | local:cloud-failed | local:cloud-empty
    ocrRoute: text("ocr_route"),
    ocrText: text("ocr_text"),
    ocrConfidence: real("ocr_confidence"), // 0..1, mean word confidence
    // Words with boxes as fractions of the page, for source-crop links: [{ t, c, b: [x0, y0, x1, y1] }]
    ocrWords: jsonb("ocr_words").$type<OcrWord[]>(),
    ocrError: text("ocr_error"),
    ocrAt: ts("ocr_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("page_document_no_uq").on(t.documentId, t.pageNo),
    // Trigram index: substring search that works for Devanagari, where word tokenisers struggle.
    index("page_ocr_text_trgm_idx").using("gin", sql`${t.ocrText} gin_trgm_ops`),
  ],
);

/** A page's OCR text translated by an AI model, kept so each page is translated once per reading. */
export const pageTranslations = pgTable(
  "page_translation",
  {
    id: id(),
    pageId: text("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    lang: localeEnum("lang").notNull(), // the language translated into
    // SHA-256 of the OCR text that was translated: a new reading of the page makes this translation stale.
    sourceHash: text("source_hash").notNull(),
    text: text("text").notNull(),
    model: text("model").notNull(), // "<provider>:<model id>" that answered
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("page_translation_page_lang_uq").on(t.pageId, t.lang)],
);

export interface OcrWord {
  t: string;
  c: number;
  b: [number, number, number, number];
}

export const facts = pgTable(
  "fact",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    documentId: text("document_id").references(() => documents.id, { onDelete: "cascade" }),
    pageId: text("page_id").references(() => pages.id, { onDelete: "set null" }),
    field: text("field").notNull(), // e.g. owner, area, land_class, ferfar_no (see FACT_FIELDS)
    value: text("value").notNull(),
    // What the extractor read, kept when the advocate corrects the value (null for facts added by hand).
    originalValue: text("original_value"),
    position: integer("position").notNull().default(0), // order among facts of the same field (owners)
    confidence: real("confidence").notNull().default(1),
    // Source crop on the page, as fractions (0..1) of page width/height.
    cropX: real("crop_x"),
    cropY: real("crop_y"),
    cropW: real("crop_w"),
    cropH: real("crop_h"),
    reviewed: boolean("reviewed").notNull().default(false),
    reviewedById: text("reviewed_by_id"),
    reviewedAt: ts("reviewed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("fact_case_field_idx").on(t.caseId, t.field), index("fact_document_idx").on(t.documentId)],
);

export const ownershipEvents = pgTable(
  "ownership_event",
  {
    id: id(),
    propertyId: text("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    kind: eventKindEnum("kind").notNull(),
    date: ts("date").notNull(),
    // DEED: SALE, GIFT, PARTITION, MORTGAGE, WILL, RELEASE, ...  MUTATION: SALE, HEIRSHIP, CORRECTION, ...
    subtype: text("subtype"),
    ferfarNo: text("ferfar_no"),
    deedRegNo: text("deed_reg_no"),
    refDeedRegNo: text("ref_deed_reg_no"), // MUTATION: deed it was certified from, if stated
    fromParties: textArray("from_parties"),
    toParties: textArray("to_parties"),
    owners: textArray("owners"), // RECORD_SNAPSHOT: owners shown on the extract
    areaSqm: doublePrecision("area_sqm"),
    landClass: text("land_class"),
    otherRights: textArray("other_rights"), // इतर हक्क column
    section155: boolean("section_155").notNull().default(false),
    factIds: textArray("fact_ids"), // facts this event was built from
    documentId: text("document_id").references(() => documents.id, { onDelete: "set null" }), // record it was built from
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("event_property_date_idx").on(t.propertyId, t.date)],
);

export const flags = pgTable(
  "flag",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    propertyId: text("property_id").references(() => properties.id, { onDelete: "cascade" }),
    rule: text("rule").notNull(),
    // Distinguishes flags of one rule on the same events (e.g. each other-rights entry).
    ruleKey: text("rule_key").notNull().default(""),
    severity: severityEnum("severity").notNull(),
    message: text("message").notNull(),
    eventIds: textArray("event_ids"),
    factIds: textArray("fact_ids"),
    resolved: boolean("resolved").notNull().default(false),
    resolution: text("resolution"),
    createdAt: createdAt(),
  },
  (t) => [index("flag_case_idx").on(t.caseId), index("flag_property_idx").on(t.propertyId)],
);

// ---------- Drafts ----------

export const drafts = pgTable(
  "draft",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    template: text("template").notNull(), // e.g. TSR (title search report)
    // For a property's title report: one per property.
    propertyId: text("property_id").references(() => properties.id, { onDelete: "cascade" }),
    language: localeEnum("language").notNull().default("mr"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Filled values, each linked back to the fact it came from: { key: { value, factId } }
    values: jsonb("values").notNull().default({}),
    version: integer("version").notNull().default(1),
    status: draftStatusEnum("status").notNull().default("DRAFT"), // DRAFT = "draft for advocate review"
    approvedAt: ts("approved_at"),
    approvedById: text("approved_by_id").references(() => advocates.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("draft_case_idx").on(t.caseId), uniqueIndex("draft_property_template_idx").on(t.propertyId, t.template)],
);

// ---------- Case diary ----------

export const hearings = pgTable(
  "hearing",
  {
    id: id(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    date: ts("date").notNull(),
    time: text("time"), // "HH:MM" court time (IST); null when not known
    court: text("court"),
    courtHall: text("court_hall"),
    purpose: text("purpose"),
    prepNotes: text("prep_notes"),
    nextStep: text("next_step"),
    outcome: text("outcome"),
    reminderSentAt: ts("reminder_sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("hearing_case_date_idx").on(t.caseId, t.date), index("hearing_date_idx").on(t.date)],
);

// ---------- Fees (amounts in paise) ----------

export const feeAgreements = pgTable(
  "fee_agreement",
  {
    id: id(),
    // SET NULL: deleting a case must not erase the client's billing and payment history.
    caseId: text("case_id").references(() => cases.id, { onDelete: "set null" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    totalPaise: integer("total_paise").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("fee_agreement_client_idx").on(t.clientId)],
);

export const installments = pgTable("installment", {
  id: id(),
  agreementId: text("agreement_id")
    .notNull()
    .references(() => feeAgreements.id, { onDelete: "cascade" }),
  dueDate: ts("due_date").notNull(),
  amountPaise: integer("amount_paise").notNull(),
  note: text("note"),
});

export const payments = pgTable("payment", {
  id: id(),
  agreementId: text("agreement_id")
    .notNull()
    .references(() => feeAgreements.id, { onDelete: "cascade" }),
  amountPaise: integer("amount_paise").notNull(),
  paidOn: ts("paid_on").notNull(),
  mode: text("mode"), // cash, upi, cheque, bank
  reference: text("reference"),
  createdAt: createdAt(),
});

// ---------- Subscription billing (Razorpay) ----------

export const planEnum = pgEnum("plan", ["TRIAL", "SOLO", "PRO", "CHAMBER"]);
export const billingIntervalEnum = pgEnum("billing_interval", ["MONTHLY", "YEARLY"]);

/**
 * One row per advocate who owns an account. Access is decided from dates, not a status flag:
 * before trialEndsAt / paidUntil the account is open, then GRACE_DAYS of grace, then read-only.
 * Data is never deleted for non-payment.
 */
export const subscriptions = pgTable("subscription", {
  advocateId: text("advocate_id")
    .primaryKey()
    .references(() => advocates.id, { onDelete: "cascade" }),
  plan: planEnum("plan").notNull().default("TRIAL"),
  interval: billingIntervalEnum("interval"),
  trialEndsAt: ts("trial_ends_at").notNull(),
  paidUntil: ts("paid_until"),
  // Razorpay recurring subscription (monthly plans); yearly plans are one-off orders.
  razorpaySubscriptionId: text("razorpay_subscription_id").unique(),
  // Set when the Razorpay subscription is halted after failed retries.
  paymentFailing: boolean("payment_failing").notNull().default(false),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  // A plan given by staff without payment (support, partners); shown in the admin panel.
  complimentary: boolean("complimentary").notNull().default(false),
  billingName: text("billing_name"),
  gstin: text("gstin"),
  billingState: text("billing_state"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Checkouts started but not yet paid: what a Razorpay order or subscription was for. */
export const checkouts = pgTable(
  "checkout",
  {
    id: id(),
    advocateId: text("advocate_id")
      .notNull()
      .references(() => advocates.id, { onDelete: "cascade" }),
    plan: planEnum("plan").notNull(),
    interval: billingIntervalEnum("interval").notNull(),
    razorpayOrderId: text("razorpay_order_id").unique(),
    razorpaySubscriptionId: text("razorpay_subscription_id").unique(),
    amountPaise: integer("amount_paise").notNull(), // excluding GST
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("checkout_advocate_idx").on(t.advocateId)],
);

/** Sequential invoice numbers (GST invoices need a unique serial per financial year). */
export const invoiceNumberSeq = pgSequence("invoice_number_seq");

/**
 * Invoice for every successful charge: a GST tax invoice when supplierGstin is set (we were registered
 * when it was issued), otherwise a plain receipt. One per Razorpay payment (webhooks are idempotent on it).
 */
export const invoices = pgTable(
  "invoice",
  {
    id: id(),
    // Kept after the advocate deletes their account: tax records must be retained.
    advocateId: text("advocate_id").references(() => advocates.id, { onDelete: "set null" }),
    number: text("number").notNull().unique(), // VM/2026-27/000123
    plan: planEnum("plan").notNull(),
    interval: billingIntervalEnum("interval").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    cgstPaise: integer("cgst_paise").notNull(),
    sgstPaise: integer("sgst_paise").notNull(),
    igstPaise: integer("igst_paise").notNull(),
    totalPaise: integer("total_paise").notNull(),
    periodStart: ts("period_start").notNull(),
    periodEnd: ts("period_end").notNull(),
    billingName: text("billing_name").notNull(),
    billingEmail: text("billing_email").notNull(),
    gstin: text("gstin"),
    billingState: text("billing_state"),
    supplierGstin: text("supplier_gstin"),
    status: text("status").notNull().default("PAID"), // PAID | REFUNDED
    razorpayPaymentId: text("razorpay_payment_id").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("invoice_advocate_idx").on(t.advocateId, t.createdAt)],
);

// ---------- Admin panel (VakilMitra staff; separate from advocates) ----------

export const staffRoleEnum = pgEnum("staff_role", ["OWNER", "SUPPORT"]);

/**
 * Staff who run the business. Separate from advocates: own login (password + authenticator
 * code), own sessions, own audit trail. Staff see accounts, plans and usage counts, never client files.
 */
export const staff = pgTable("staff", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: staffRoleEnum("role").notNull().default("SUPPORT"),
  passwordHash: text("password_hash").notNull(), // scrypt$N$r$p$salt$hash
  totpSecret: text("totp_secret").notNull(), // AES-GCM encrypted base32 secret
  // Last accepted 30-second step, so a code cannot be used twice.
  totpLastStep: integer("totp_last_step"),
  disabled: boolean("disabled").notNull().default(false),
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
});

export const staffSessions = pgTable(
  "staff_session",
  {
    id: id(),
    staffId: text("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(), // sha256 of the cookie value
    expiresAt: ts("expires_at").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("staff_session_staff_idx").on(t.staffId)],
);

/** Every staff sign-in and every change staff make to an account. */
export const staffAudit = pgTable(
  "staff_audit",
  {
    id: id(),
    staffId: text("staff_id").references(() => staff.id, { onDelete: "set null" }),
    action: text("action").notNull(), // login, login.failed, trial.extend, plan.comp, invoice.refund, ...
    targetType: text("target_type"),
    targetId: text("target_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ip: text("ip"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [index("staff_audit_at_idx").on(t.at), index("staff_audit_target_idx").on(t.targetType, t.targetId)],
);

// ---------- Audit ----------

/**
 * The audit trail: one row per request to the API by a signed-in advocate (views, lists,
 * searches, changes, exports, refusals), per sign-in event, and per system action on a
 * client's data (e.g. a page sent for cloud reading). Never holds client content: ids, the
 * route, which fields changed, and the result. Staff actions are in staff_audit.
 * Kept for one year (the worker's daily clean-up), except the anonymous account.delete rows.
 */
/**
 * One row per AI call, charged to the account that owns the case (like scanned pages), for the
 * plan's monthly AI limit and for cost tracking. Holds no client text.
 */
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => advocates.id, { onDelete: "cascade" }),
    // Who asked (the owner or a junior).
    advocateId: text("advocate_id").references(() => advocates.id, { onDelete: "set null" }),
    task: text("task").notNull(), // translation | drafting
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_usage_owner_at_idx").on(t.ownerId, t.createdAt)],
);

export const accessLogs = pgTable(
  "access_log",
  {
    id: id(),
    // Who: the advocate (owner or junior); null when unknown (failed sign-in) or deleted.
    advocateId: text("advocate_id").references(() => advocates.id, { onDelete: "set null" }),
    actor: text("actor").notNull().default("advocate"), // advocate | system | anonymous
    action: text("action").notNull(), // case.view, case.share, document.create, auth.sign_in, ...
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    // The case it belongs to, so a case's owner sees everyone's activity on it (kept after the case is deleted).
    caseId: text("case_id"),
    method: text("method"),
    route: text("route"), // the route pattern, e.g. /api/cases/:id
    status: integer("status"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [
    index("access_log_advocate_at_idx").on(t.advocateId, t.at),
    index("access_log_entity_idx").on(t.entityType, t.entityId),
    index("access_log_case_at_idx").on(t.caseId, t.at),
    // The daily clean-up deletes by age.
    index("access_log_at_idx").on(t.at),
  ],
);

// ---------- Backups ----------

/**
 * One nightly backup and its restore check. The backup store holds everything needed to
 * restore without this table (it is lost with the database); this is for the admin panel.
 */
export const backupRuns = pgTable(
  "backup_run",
  {
    id: text("id").primaryKey(), // the run's folder in the backup store, e.g. 20261120T213000Z
    status: text("status").notNull().default("RUNNING"), // RUNNING | OK | FAILED
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    dumpBytes: bigint("dump_bytes", { mode: "number" }),
    rows: integer("rows"), // rows in the dump, all tables
    files: integer("files"), // client files this run's restore needs
    filesCopied: integer("files_copied"), // of those, copied tonight (the rest were already there)
    error: text("error"),
    checkedAt: ts("checked_at"),
    checkOk: boolean("check_ok"),
    checkError: text("check_error"),
  },
  (t) => [index("backup_run_started_idx").on(t.startedAt)],
);

// ---------- Relations (for the relational query API) ----------

export const advocatesRelations = relations(advocates, ({ many }) => ({
  clients: many(clients),
  cases: many(cases),
  grants: many(caseAccess),
}));
export const caseAccessRelations = relations(caseAccess, ({ one }) => ({
  case: one(cases, { fields: [caseAccess.caseId], references: [cases.id] }),
  advocate: one(advocates, { fields: [caseAccess.advocateId], references: [advocates.id] }),
}));
export const clientsRelations = relations(clients, ({ one, many }) => ({
  advocate: one(advocates, { fields: [clients.advocateId], references: [advocates.id] }),
  cases: many(cases),
  feeAgreements: many(feeAgreements),
}));
export const casesRelations = relations(cases, ({ one, many }) => ({
  advocate: one(advocates, { fields: [cases.advocateId], references: [advocates.id] }),
  client: one(clients, { fields: [cases.clientId], references: [clients.id] }),
  parties: many(parties),
  properties: many(properties),
  documents: many(documents),
  facts: many(facts),
  flags: many(flags),
  drafts: many(drafts),
  hearings: many(hearings),
  feeAgreements: many(feeAgreements),
  grants: many(caseAccess),
}));
export const partiesRelations = relations(parties, ({ one }) => ({
  case: one(cases, { fields: [parties.caseId], references: [cases.id] }),
}));
export const propertiesRelations = relations(properties, ({ one, many }) => ({
  case: one(cases, { fields: [properties.caseId], references: [cases.id] }),
  events: many(ownershipEvents),
  documents: many(documents),
  flags: many(flags),
}));
export const documentsRelations = relations(documents, ({ one, many }) => ({
  case: one(cases, { fields: [documents.caseId], references: [cases.id] }),
  property: one(properties, { fields: [documents.propertyId], references: [properties.id] }),
  pages: many(pages),
  facts: many(facts),
}));
export const pagesRelations = relations(pages, ({ one, many }) => ({
  document: one(documents, { fields: [pages.documentId], references: [documents.id] }),
  facts: many(facts),
  translations: many(pageTranslations),
}));
export const pageTranslationsRelations = relations(pageTranslations, ({ one }) => ({
  page: one(pages, { fields: [pageTranslations.pageId], references: [pages.id] }),
}));
export const factsRelations = relations(facts, ({ one }) => ({
  case: one(cases, { fields: [facts.caseId], references: [cases.id] }),
  document: one(documents, { fields: [facts.documentId], references: [documents.id] }),
  page: one(pages, { fields: [facts.pageId], references: [pages.id] }),
}));
export const ownershipEventsRelations = relations(ownershipEvents, ({ one }) => ({
  property: one(properties, { fields: [ownershipEvents.propertyId], references: [properties.id] }),
  document: one(documents, { fields: [ownershipEvents.documentId], references: [documents.id] }),
}));
export const flagsRelations = relations(flags, ({ one }) => ({
  case: one(cases, { fields: [flags.caseId], references: [cases.id] }),
  property: one(properties, { fields: [flags.propertyId], references: [properties.id] }),
}));
export const draftsRelations = relations(drafts, ({ one }) => ({ case: one(cases, { fields: [drafts.caseId], references: [cases.id] }) }));
export const hearingsRelations = relations(hearings, ({ one }) => ({
  case: one(cases, { fields: [hearings.caseId], references: [cases.id] }),
}));
export const feeAgreementsRelations = relations(feeAgreements, ({ one, many }) => ({
  case: one(cases, { fields: [feeAgreements.caseId], references: [cases.id] }),
  client: one(clients, { fields: [feeAgreements.clientId], references: [clients.id] }),
  installments: many(installments),
  payments: many(payments),
}));
export const installmentsRelations = relations(installments, ({ one }) => ({
  agreement: one(feeAgreements, { fields: [installments.agreementId], references: [feeAgreements.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  agreement: one(feeAgreements, { fields: [payments.agreementId], references: [feeAgreements.id] }),
}));
