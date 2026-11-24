/**
 * Plan state, usage and limits. Access is worked out from dates every time, so a missed
 * webhook can never lock someone out early: trial or paid period, then GRACE_DAYS, then read-only.
 */
import {
  accessLogs,
  advocates,
  aiUsage,
  and,
  caseAccess,
  cases,
  checkouts,
  count,
  countDistinct,
  type Db,
  documents,
  eq,
  gte,
  inArray,
  invoices,
  pages,
  sql,
  subscriptions,
  sum,
} from "@vakilmitra/db";
import {
  type AccessState,
  type BillingInterval,
  type BillingStatus,
  type BillingUsage,
  GRACE_DAYS,
  GST_REGISTERED,
  gstFor,
  istDate,
  type PaidPlanId,
  PLANS,
  TRIAL_DAYS,
} from "@vakilmitra/shared";
import { translate } from "@vakilmitra/shared/i18n";
import { addDays, addMonths, addYears } from "date-fns";
import { db } from "../db.js";
import { env } from "../env.js";
import { HttpError } from "../lib/http.js";
import { receiptMail } from "../mail.js";
import { getServices, mailer } from "../services.js";

export type Subscription = typeof subscriptions.$inferSelect;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The advocate's subscription row; a new account starts its trial on first use. */
export async function ensureSubscription(advocateId: string, now = new Date()): Promise<Subscription> {
  const found = await db.query.subscriptions.findFirst({ where: eq(subscriptions.advocateId, advocateId) });
  if (found) return found;
  await db
    .insert(subscriptions)
    .values({ advocateId, trialEndsAt: addDays(now, TRIAL_DAYS) })
    .onConflictDoNothing();
  return (await db.query.subscriptions.findFirst({ where: eq(subscriptions.advocateId, advocateId) }))!;
}

/** End of what has been given (trial or paid period). */
export function periodEnd(sub: Pick<Subscription, "plan" | "trialEndsAt" | "paidUntil">): Date {
  return sub.plan === "TRIAL" || !sub.paidUntil ? sub.trialEndsAt : sub.paidUntil;
}

export function accessState(sub: Pick<Subscription, "plan" | "trialEndsAt" | "paidUntil">, now = new Date()): AccessState {
  const end = periodEnd(sub);
  if (now < end) return sub.plan === "TRIAL" ? "TRIAL" : "ACTIVE";
  return now < addDays(end, GRACE_DAYS) ? "GRACE" : "READ_ONLY";
}

/**
 * A junior whose own trial has ended keeps working while a senior who shared cases with them
 * is on a paid plan (the senior's plan pays for that seat).
 */
async function sponsorOf(advocateId: string, now: Date) {
  const owners = await db
    .selectDistinct({ id: cases.advocateId })
    .from(caseAccess)
    .innerJoin(cases, eq(cases.id, caseAccess.caseId))
    .where(eq(caseAccess.advocateId, advocateId));
  if (!owners.length) return null;
  const subs = await db.query.subscriptions.findMany({
    where: inArray(
      subscriptions.advocateId,
      owners.map((o) => o.id),
    ),
  });
  const sub = subs.find((s) => s.plan !== "TRIAL" && PLANS[s.plan].limits.juniors > 0 && accessState(s, now) !== "READ_ONLY");
  if (!sub) return null;
  const owner = await db.query.advocates.findFirst({ where: eq(advocates.id, sub.advocateId), columns: { name: true } });
  return { name: owner?.name ?? "" };
}

/** What this advocate can do now, counting a senior's plan for juniors. */
export async function effectiveAccess(advocateId: string, now = new Date()) {
  const sub = await ensureSubscription(advocateId, now);
  const own = accessState(sub, now);
  if (own === "TRIAL" || own === "ACTIVE") return { sub, state: own, coveredBy: null };
  const sponsor = await sponsorOf(advocateId, now);
  return sponsor ? { sub, state: "ACTIVE" as const, coveredBy: sponsor } : { sub, state: own, coveredBy: null };
}

function istMonthStart(now: Date) {
  return new Date(`${istDate(now).slice(0, 7)}-01T00:00:00+05:30`);
}

/** Usage of the account owned by this advocate: pages and storage in their cases, and juniors given access. */
export async function usageOf(ownerId: string, now = new Date()): Promise<BillingUsage> {
  const ownedPages = db
    .select({ createdAt: pages.createdAt, byteSize: pages.byteSize })
    .from(pages)
    .innerJoin(documents, eq(documents.id, pages.documentId))
    .innerJoin(cases, eq(cases.id, documents.caseId))
    .where(eq(cases.advocateId, ownerId))
    .as("owned");
  const [p] = await db
    .select({
      storage: sum(ownedPages.byteSize),
      month: sql<number>`count(*) filter (where ${ownedPages.createdAt} >= ${istMonthStart(now).toISOString()})`.mapWith(Number),
    })
    .from(ownedPages);
  const [j] = await db
    .select({ n: countDistinct(caseAccess.advocateId) })
    .from(caseAccess)
    .innerJoin(cases, eq(cases.id, caseAccess.caseId))
    .where(eq(cases.advocateId, ownerId));
  const [a] = await db
    .select({ n: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.ownerId, ownerId), gte(aiUsage.createdAt, istMonthStart(now))));
  return { pagesThisMonth: p?.month ?? 0, storageBytes: Number(p?.storage ?? 0), juniors: j?.n ?? 0, aiThisMonth: a?.n ?? 0 };
}

const limitError = (message: string, details: Record<string, unknown>) => new HttpError(402, "plan_limit", message, details);

/** Called before a new page is stored in a case owned by `ownerId`. */
export async function assertPageQuota(ownerId: string, addBytes: number) {
  const sub = await ensureSubscription(ownerId);
  const { limits } = PLANS[sub.plan];
  const u = await usageOf(ownerId);
  if (u.pagesThisMonth + 1 > limits.pagesPerMonth) {
    throw limitError("This month's scanning limit for the plan is used up. Upgrade the plan to scan more.", {
      limit: "pagesPerMonth",
      max: limits.pagesPerMonth,
    });
  }
  if (u.storageBytes + addBytes > limits.storageBytes) {
    throw limitError("Storage for the plan is full. Upgrade the plan for more space.", { limit: "storageBytes", max: limits.storageBytes });
  }
}

/** Called before an AI request charged to the account owned by `ownerId`. */
export async function assertAiQuota(ownerId: string) {
  const sub = await ensureSubscription(ownerId);
  const { limits } = PLANS[sub.plan];
  const u = await usageOf(ownerId);
  if (u.aiThisMonth + 1 > limits.aiPerMonth) {
    throw limitError("This month's AI limit for the plan is used up. Upgrade the plan for more.", {
      limit: "aiPerMonth",
      max: limits.aiPerMonth,
    });
  }
}

/** Called before giving `juniorId` access to a case owned by `ownerId`. */
export async function assertJuniorSeat(ownerId: string, juniorId: string) {
  const already = await db
    .select({ n: count() })
    .from(caseAccess)
    .innerJoin(cases, eq(cases.id, caseAccess.caseId))
    .where(and(eq(cases.advocateId, ownerId), eq(caseAccess.advocateId, juniorId)));
  if ((already[0]?.n ?? 0) > 0) return;
  const sub = await ensureSubscription(ownerId);
  const { limits } = PLANS[sub.plan];
  const u = await usageOf(ownerId);
  if (u.juniors + 1 > limits.juniors) {
    throw limitError(
      limits.juniors === 0 ? "Sharing cases with juniors needs the Pro or Chamber plan." : "All junior seats on the plan are in use.",
      { limit: "juniors", max: limits.juniors },
    );
  }
}

export async function billingStatus(advocateId: string, now = new Date()): Promise<BillingStatus> {
  const { sub, state, coveredBy } = await effectiveAccess(advocateId, now);
  const end = periodEnd(sub);
  return {
    plan: sub.plan,
    interval: sub.interval,
    state,
    endsAt: end.toISOString(),
    readOnlyAt: addDays(end, GRACE_DAYS).toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    paymentFailing: sub.paymentFailing,
    complimentary: sub.complimentary,
    coveredBy,
    limits: PLANS[sub.plan].limits,
    usage: await usageOf(advocateId, now),
    details: { billingName: sub.billingName, gstin: sub.gstin, billingState: sub.billingState },
    razorpayKeyId: getServices().razorpay ? (env.RAZORPAY_KEY_ID ?? null) : null,
  };
}

/** "2026-27": the Indian financial year (April to March) of a date in IST. */
export function financialYear(now: Date) {
  const [y, m] = istDate(now).split("-").map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function priceOf(plan: PaidPlanId, interval: BillingInterval) {
  return PLANS[plan].price![interval];
}

/**
 * Records one successful charge: extends the plan and issues the invoice (a GST tax invoice when
 * we are registered, otherwise a plain receipt).
 * Idempotent on the Razorpay payment id, because both the browser and the webhook report the same payment.
 */
export async function recordCharge(c: {
  advocateId: string;
  plan: PaidPlanId;
  interval: BillingInterval;
  paymentId: string;
  razorpaySubscriptionId: string | null;
  /** Exact period from Razorpay for subscription charges; computed otherwise. */
  periodStart?: Date;
  periodEnd?: Date;
  checkoutId?: string;
  now?: Date;
}) {
  const now = c.now ?? new Date();
  const done = await db.transaction(async (tx) => {
    const done = await tx.query.invoices.findFirst({ where: eq(invoices.razorpayPaymentId, c.paymentId), columns: { id: true } });
    if (done) {
      // Already recorded (e.g. by the browser); only take Razorpay's exact period end.
      if (c.periodEnd && c.razorpaySubscriptionId) {
        await tx
          .update(subscriptions)
          .set({ paidUntil: sql`greatest(${subscriptions.paidUntil}, ${c.periodEnd.toISOString()}::timestamptz)` })
          .where(eq(subscriptions.razorpaySubscriptionId, c.razorpaySubscriptionId));
      }
      return null;
    }
    await tx
      .insert(subscriptions)
      .values({ advocateId: c.advocateId, trialEndsAt: addDays(now, TRIAL_DAYS) })
      .onConflictDoNothing();
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.advocateId, c.advocateId)).for("update");
    const advocate = await tx.query.advocates.findFirst({
      where: eq(advocates.id, c.advocateId),
      columns: { name: true, email: true, locale: true },
    });
    if (!sub || !advocate) throw new HttpError(404, "not_found", "Advocate not found");

    // A yearly renewal of the same plan stacks on top of the time left; anything else starts today.
    const stack = c.interval === "YEARLY" && sub.plan === c.plan && sub.paidUntil && sub.paidUntil > now;
    const start = c.periodStart ?? (stack ? sub.paidUntil! : now);
    const end = c.periodEnd ?? (c.interval === "YEARLY" ? addYears(start, 1) : addMonths(start, 1));
    const oldRecurring =
      sub.razorpaySubscriptionId && sub.razorpaySubscriptionId !== c.razorpaySubscriptionId ? sub.razorpaySubscriptionId : null;

    await tx
      .update(subscriptions)
      .set({
        plan: c.plan,
        interval: c.interval,
        paidUntil: end,
        razorpaySubscriptionId: c.razorpaySubscriptionId,
        paymentFailing: false,
        cancelAtPeriodEnd: false,
        complimentary: false,
      })
      .where(eq(subscriptions.advocateId, c.advocateId));

    const amount = priceOf(c.plan, c.interval);
    const tax = gstFor(amount, sub.billingState, GST_REGISTERED);
    const [{ n }] = (await tx.execute(sql`select nextval('invoice_number_seq') as n`)).rows as [{ n: string }];
    const [inv] = await tx
      .insert(invoices)
      .values({
        advocateId: c.advocateId,
        number: `VM/${financialYear(now)}/${String(n).padStart(6, "0")}`,
        plan: c.plan,
        interval: c.interval,
        amountPaise: amount,
        cgstPaise: tax.cgstPaise,
        sgstPaise: tax.sgstPaise,
        igstPaise: tax.igstPaise,
        totalPaise: tax.totalPaise,
        periodStart: start,
        periodEnd: end,
        billingName: sub.billingName ?? advocate.name,
        billingEmail: advocate.email,
        gstin: sub.gstin,
        billingState: sub.billingState,
        supplierGstin: GST_REGISTERED ? (env.BILLING_SUPPLIER_GSTIN ?? null) : null,
        razorpayPaymentId: c.paymentId,
      })
      .returning({
        id: invoices.id,
        number: invoices.number,
        totalPaise: invoices.totalPaise,
        periodEnd: invoices.periodEnd,
        supplierGstin: invoices.supplierGstin,
      });
    if (c.checkoutId) await tx.update(checkouts).set({ completedAt: now }).where(eq(checkouts.id, c.checkoutId));
    await logBilling(tx, c.advocateId, "billing.paid", c.paymentId);
    return { oldRecurring, advocate, inv: inv! };
  });
  if (!done) return;
  // A plan change replaces the old monthly subscription; stop it so it is not charged again.
  if (done.oldRecurring)
    await getServices()
      .razorpay?.cancelSubscription(done.oldRecurring, false)
      .catch(() => undefined);
  sendReceipt(done.advocate, c.plan, done.inv);
}

/** Emails the receipt with a link to the invoice. Never fails the charge. */
function sendReceipt(
  to: { name: string; email: string; locale: "mr" | "en" },
  plan: PaidPlanId,
  inv: { id: string; number: string; totalPaise: number; periodEnd: Date; supplierGstin: string | null },
) {
  const l = to.locale;
  const mail = receiptMail(to, {
    number: inv.number,
    planLabel: translate(l, `billing.plan.${plan}`),
    total: `₹${(inv.totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    periodEnd: inv.periodEnd.toLocaleDateString(l === "mr" ? "mr-IN" : "en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }),
    url: `${env.WEB_ORIGIN}/billing/invoices/${inv.id}`,
    taxInvoice: inv.supplierGstin !== null,
  });
  void mailer()
    .send(mail)
    .catch((err) => console.error("[mail] receipt failed:", (err as Error).message));
}

export async function logBilling(tx: Tx | typeof db, advocateId: string, action: string, entityId: string) {
  await tx.insert(accessLogs).values({ advocateId, action, entityType: "subscription", entityId });
}
