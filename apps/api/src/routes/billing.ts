import { advocates, and, checkouts, desc, eq, invoices, subscriptions } from "@vakilmitra/db";
import { billingDetailsInput, checkoutInput, checkoutVerifyInput, gstFor, type PaidPlanId } from "@vakilmitra/shared";
import type { FastifyPluginAsync } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { checkoutSignatureValid, webhookSignatureValid } from "../billing/razorpay.js";
import { billingStatus, ensureSubscription, logBilling, priceOf, recordCharge } from "../billing/service.js";
import { db } from "../db.js";
import { env } from "../env.js";
import { HttpError, notFound } from "../lib/http.js";
import { getServices } from "../services.js";

const PLAN_IDS: Record<PaidPlanId, string | undefined> = {
  SOLO: env.RAZORPAY_PLAN_SOLO,
  PRO: env.RAZORPAY_PLAN_PRO,
  CHAMBER: env.RAZORPAY_PLAN_CHAMBER,
};

const unavailable = () => new HttpError(503, "billing_unavailable", "Online payment is not set up yet");

function razorpay() {
  const rp = getServices().razorpay;
  if (!rp || !env.RAZORPAY_KEY_SECRET) throw unavailable();
  return rp;
}

const invoiceColumns = {
  id: true,
  number: true,
  plan: true,
  interval: true,
  amountPaise: true,
  cgstPaise: true,
  sgstPaise: true,
  igstPaise: true,
  totalPaise: true,
  periodStart: true,
  periodEnd: true,
  billingName: true,
  gstin: true,
  billingState: true,
  status: true,
  razorpayPaymentId: true,
  createdAt: true,
} as const;

/** Signed-in routes under /api/billing. Always reachable, even when the account is read-only. */
export const billingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", async (req) => ({ billing: await billingStatus(req.advocateId) }));

  app.put("/details", { schema: { body: billingDetailsInput } }, async (req) => {
    await ensureSubscription(req.advocateId);
    await db
      .update(subscriptions)
      .set({ billingName: req.body.billingName, gstin: req.body.gstin ?? null, billingState: req.body.billingState ?? null })
      .where(eq(subscriptions.advocateId, req.advocateId));
    return { billing: await billingStatus(req.advocateId) };
  });

  /** Starts a payment: a Razorpay subscription for monthly plans, a one-off order for yearly ones. */
  app.post("/checkout", { schema: { body: checkoutInput } }, async (req) => {
    const rp = razorpay();
    const { plan, interval } = req.body;
    const sub = await ensureSubscription(req.advocateId);
    const advocate = await db.query.advocates.findFirst({
      where: eq(advocates.id, req.advocateId),
      columns: { name: true, email: true, phone: true },
    });
    const amount = priceOf(plan, interval);
    const notes = { advocateId: req.advocateId, plan, interval };
    const prefill = { name: sub.billingName ?? advocate?.name ?? "", email: advocate?.email ?? "", contact: advocate?.phone ?? "" };
    const totalPaise = gstFor(amount, sub.billingState).totalPaise;

    if (interval === "MONTHLY") {
      const planId = PLAN_IDS[plan];
      if (!planId) throw unavailable();
      const s = await rp.createSubscription({ planId, notes });
      const [c] = await db
        .insert(checkouts)
        .values({ advocateId: req.advocateId, plan, interval, amountPaise: amount, razorpaySubscriptionId: s.id })
        .returning({ id: checkouts.id });
      return { checkout: { id: c!.id, keyId: env.RAZORPAY_KEY_ID!, subscriptionId: s.id, orderId: null, totalPaise, prefill } };
    }
    const [c] = await db
      .insert(checkouts)
      .values({ advocateId: req.advocateId, plan, interval, amountPaise: amount })
      .returning({ id: checkouts.id });
    const o = await rp.createOrder({ amountPaise: totalPaise, receipt: c!.id, notes });
    await db.update(checkouts).set({ razorpayOrderId: o.id }).where(eq(checkouts.id, c!.id));
    return { checkout: { id: c!.id, keyId: env.RAZORPAY_KEY_ID!, subscriptionId: null, orderId: o.id, totalPaise, prefill } };
  });

  /** Checkout's success callback. The signature proves Razorpay took the payment. */
  app.post("/verify", { schema: { body: checkoutVerifyInput } }, async (req) => {
    razorpay();
    const b = req.body;
    const ok = checkoutSignatureValid(env.RAZORPAY_KEY_SECRET!, {
      paymentId: b.razorpay_payment_id,
      signature: b.razorpay_signature,
      orderId: b.razorpay_order_id,
      subscriptionId: b.razorpay_subscription_id,
    });
    if (!ok) throw new HttpError(400, "invalid_signature", "Payment could not be verified");
    const checkout = await db.query.checkouts.findFirst({
      where: and(
        eq(checkouts.advocateId, req.advocateId),
        b.razorpay_order_id
          ? eq(checkouts.razorpayOrderId, b.razorpay_order_id)
          : eq(checkouts.razorpaySubscriptionId, b.razorpay_subscription_id!),
      ),
    });
    if (!checkout || checkout.plan === "TRIAL") throw notFound("Checkout");
    await recordCharge({
      advocateId: req.advocateId,
      plan: checkout.plan,
      interval: checkout.interval,
      paymentId: b.razorpay_payment_id,
      razorpaySubscriptionId: checkout.razorpaySubscriptionId,
      checkoutId: checkout.id,
    });
    return { billing: await billingStatus(req.advocateId) };
  });

  /** Stops renewal. The plan stays until the end of the paid period. */
  app.post("/cancel", async (req) => {
    const sub = await ensureSubscription(req.advocateId);
    if (sub.plan === "TRIAL") throw new HttpError(400, "invalid_input", "There is no paid plan to cancel");
    if (sub.razorpaySubscriptionId) await razorpay().cancelSubscription(sub.razorpaySubscriptionId, true);
    await db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(subscriptions.advocateId, req.advocateId));
    await logBilling(db, req.advocateId, "billing.cancel", req.advocateId);
    return { billing: await billingStatus(req.advocateId) };
  });

  app.get("/invoices", async (req) => ({
    invoices: await db.query.invoices.findMany({
      where: eq(invoices.advocateId, req.advocateId),
      columns: invoiceColumns,
      orderBy: desc(invoices.createdAt),
    }),
  }));

  app.get("/invoices/:id", { schema: { params: z.object({ id: z.string() }) } }, async (req) => {
    const invoice = await db.query.invoices.findFirst({
      where: and(eq(invoices.id, req.params.id), eq(invoices.advocateId, req.advocateId)),
      columns: invoiceColumns,
    });
    if (!invoice) throw notFound("Invoice");
    const supplier = {
      name: env.BILLING_SUPPLIER_NAME,
      address: env.BILLING_SUPPLIER_ADDRESS ?? null,
      gstin: env.BILLING_SUPPLIER_GSTIN ?? null,
      sac: env.BILLING_SAC ?? null,
    };
    return { invoice, supplier };
  });
};

interface RzpEntity {
  id: string;
  order_id?: string | null;
  payment_id?: string;
  subscription_id?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  notes?: Record<string, string> | unknown[];
}
interface RzpEvent {
  event: string;
  payload: { payment?: { entity: RzpEntity }; subscription?: { entity: RzpEntity }; refund?: { entity: RzpEntity } };
}

/**
 * POST /api/webhooks/razorpay. Verified with the webhook secret over the raw body.
 * Covers what the browser may miss (closed tab after paying) and everything after checkout:
 * monthly renewals, failed mandates, cancellations and refunds.
 */
export const razorpayWebhook: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.post("/razorpay", { schema: { hide: true } }, async (req, reply) => {
    if (!env.RAZORPAY_WEBHOOK_SECRET) throw unavailable();
    const raw = req.body as Buffer;
    if (!webhookSignatureValid(env.RAZORPAY_WEBHOOK_SECRET, raw, req.headers["x-razorpay-signature"] as string | undefined)) {
      throw new HttpError(400, "invalid_signature", "Bad signature");
    }
    const e = JSON.parse(raw.toString("utf8")) as RzpEvent;
    const payment = e.payload.payment?.entity;
    const rsub = e.payload.subscription?.entity;

    switch (e.event) {
      case "subscription.charged": {
        if (!payment || !rsub) break;
        const period = {
          periodStart: rsub.current_start ? new Date(rsub.current_start * 1000) : undefined,
          periodEnd: rsub.current_end ? new Date(rsub.current_end * 1000) : undefined,
        };
        const owner = await db.query.subscriptions.findFirst({ where: eq(subscriptions.razorpaySubscriptionId, rsub.id) });
        const checkout = await db.query.checkouts.findFirst({ where: eq(checkouts.razorpaySubscriptionId, rsub.id) });
        const advocateId = owner?.advocateId ?? checkout?.advocateId;
        const plan = (owner && owner.plan !== "TRIAL" ? owner.plan : checkout?.plan) as PaidPlanId | undefined;
        if (!advocateId || !plan || plan === ("TRIAL" as string)) break;
        await recordCharge({
          advocateId,
          plan,
          interval: "MONTHLY",
          paymentId: payment.id,
          razorpaySubscriptionId: rsub.id,
          checkoutId: owner ? undefined : checkout?.id,
          ...period,
        });
        break;
      }
      case "payment.captured": {
        // Yearly plans: a one-off order. Monthly ones arrive as subscription.charged.
        if (!payment?.order_id) break;
        const checkout = await db.query.checkouts.findFirst({ where: eq(checkouts.razorpayOrderId, payment.order_id) });
        if (!checkout || checkout.plan === "TRIAL") break;
        await recordCharge({
          advocateId: checkout.advocateId,
          plan: checkout.plan,
          interval: checkout.interval,
          paymentId: payment.id,
          razorpaySubscriptionId: null,
          checkoutId: checkout.id,
        });
        break;
      }
      case "subscription.halted":
      case "subscription.pending": {
        if (rsub) await db.update(subscriptions).set({ paymentFailing: true }).where(eq(subscriptions.razorpaySubscriptionId, rsub.id));
        break;
      }
      case "subscription.cancelled":
      case "subscription.completed": {
        if (rsub) await db.update(subscriptions).set({ cancelAtPeriodEnd: true }).where(eq(subscriptions.razorpaySubscriptionId, rsub.id));
        break;
      }
      case "refund.processed": {
        const paymentId = e.payload.refund?.entity.payment_id;
        if (paymentId) await db.update(invoices).set({ status: "REFUNDED" }).where(eq(invoices.razorpayPaymentId, paymentId));
        break;
      }
    }
    return reply.send({ ok: true });
  });
};
