/**
 * Plans, prices and limits. Every plan has the full product (diary, cases, fees, 7/12 and
 * Ferfar analysis, title report, Word export); plans differ only in seats, scanning and storage.
 * Prices are in paise and exclude GST (GST is added only while GST_REGISTERED is true).
 */
import { z } from "zod";

export const PLAN_IDS = ["TRIAL", "SOLO", "PRO", "CHAMBER"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export const PAID_PLANS = ["SOLO", "PRO", "CHAMBER"] as const;
export type PaidPlanId = (typeof PAID_PLANS)[number];
export const BILLING_INTERVALS = ["MONTHLY", "YEARLY"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export interface PlanLimits {
  /** Other advocates (juniors) who can be given access to this account's cases. */
  juniors: number;
  /** New scanned or uploaded pages per calendar month (IST). */
  pagesPerMonth: number;
  storageBytes: number;
}

const GB = 1024 ** 3;

export const PLANS: Record<PlanId, { limits: PlanLimits; price: Record<BillingInterval, number> | null }> = {
  TRIAL: { limits: { juniors: 1, pagesPerMonth: 100, storageBytes: 2 * GB }, price: null },
  SOLO: { limits: { juniors: 0, pagesPerMonth: 300, storageBytes: 5 * GB }, price: { MONTHLY: 39_900, YEARLY: 399_900 } },
  PRO: { limits: { juniors: 1, pagesPerMonth: 1_500, storageBytes: 25 * GB }, price: { MONTHLY: 89_900, YEARLY: 899_900 } },
  CHAMBER: { limits: { juniors: 4, pagesPerMonth: 5_000, storageBytes: 100 * GB }, price: { MONTHLY: 249_900, YEARLY: 2_499_900 } },
};

export const TRIAL_DAYS = 14;
/** Days after a trial or paid period ends before the account turns read-only. */
export const GRACE_DAYS = 7;
/**
 * Whether we are registered for GST. While false, no GST is charged: plan prices are final and
 * each payment gets a plain receipt, not a tax invoice (an unregistered seller may not collect GST).
 * After registering: set this to true, set BILLING_SUPPLIER_GSTIN and BILLING_SAC on the API, and run
 * `pnpm --filter @vakilmitra/api billing:plans` again so the monthly Razorpay plans include GST.
 * Registration is compulsory once a year's turnover passes ₹20 lakh.
 */
export const GST_REGISTERED = false;
export const GST_RATE = 0.18;
/** Our place of supply: same-state customers pay CGST + SGST, others IGST. */
export const SUPPLIER_STATE = "MH";

/** GST split for an amount in paise (excluding tax); all zero when not registered (pass GST_REGISTERED). */
export function gstFor(amountPaise: number, customerState: string | null | undefined, registered: boolean) {
  const gst = registered ? Math.round(amountPaise * GST_RATE) : 0;
  const intra = !customerState || customerState === SUPPLIER_STATE;
  const half = Math.floor(gst / 2);
  return {
    cgstPaise: intra ? half : 0,
    sgstPaise: intra ? gst - half : 0,
    igstPaise: intra ? 0 : gst,
    gstPaise: gst,
    totalPaise: amountPaise + gst,
  };
}

/** Where the account stands: what the advocate can do right now. */
export type AccessState = "TRIAL" | "ACTIVE" | "GRACE" | "READ_ONLY";

export interface BillingUsage {
  pagesThisMonth: number;
  storageBytes: number;
  juniors: number;
}

export interface PlanInvoice {
  id: string;
  number: string;
  plan: PaidPlanId;
  interval: BillingInterval;
  amountPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
  periodStart: string;
  periodEnd: string;
  billingName: string;
  gstin: string | null;
  billingState: string | null;
  /** Our GSTIN when this was issued as a tax invoice; null for a plain receipt. */
  supplierGstin: string | null;
  status: "PAID" | "REFUNDED";
  razorpayPaymentId: string;
  createdAt: string;
}

export interface InvoiceSupplier {
  name: string;
  address: string | null;
  gstin: string | null;
  sac: string | null;
}

export interface Checkout {
  id: string;
  keyId: string;
  subscriptionId: string | null;
  orderId: string | null;
  totalPaise: number;
  prefill: { name: string; email: string; contact: string };
}

/** Indian states and union territories, two-letter codes as used in vehicle and GST records. */
export const INDIAN_STATES: Record<string, string> = {
  MH: "Maharashtra",
  AN: "Andaman and Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CG: "Chhattisgarh",
  DN: "Dadra and Nagar Haveli and Daman and Diu",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JK: "Jammu and Kashmir",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MP: "Madhya Pradesh",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OD: "Odisha",
  PY: "Puducherry",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UK: "Uttarakhand",
  WB: "West Bengal",
};

export interface BillingStatus {
  plan: PlanId;
  interval: BillingInterval | null;
  state: AccessState;
  /** Trial end, or the end of the paid period. */
  endsAt: string;
  /** When the account turns read-only if nothing is paid. */
  readOnlyAt: string;
  cancelAtPeriodEnd: boolean;
  /** Razorpay could not charge the card or UPI mandate after its retries. */
  paymentFailing: boolean;
  complimentary: boolean;
  /** True when a junior uses this account through a senior's plan. */
  coveredBy: { name: string } | null;
  limits: PlanLimits;
  usage: BillingUsage;
  details: { billingName: string | null; gstin: string | null; billingState: string | null };
  /** Razorpay key id for Checkout; null when billing is not configured. */
  razorpayKeyId: string | null;
}

export const checkoutInput = z.object({ plan: z.enum(PAID_PLANS), interval: z.enum(BILLING_INTERVALS) });

export const checkoutVerifyInput = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  razorpay_order_id: z.string().min(1).optional(),
  razorpay_subscription_id: z.string().min(1).optional(),
});

/** Indian GSTIN: 2-digit state code, PAN, entity number, Z, checksum. */
export const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const billingDetailsInput = z.object({
  billingName: z.string().trim().min(2).max(120),
  gstin: z.string().trim().toUpperCase().regex(gstinRegex).nullable().optional(),
  /** Two-letter state code, e.g. MH. */
  billingState: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .optional(),
});
