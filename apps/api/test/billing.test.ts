/** Plans, Razorpay checkout and webhooks, limits, and the read-only lock after a plan runs out. */
import { createHmac } from "node:crypto";
import { documents, eq, invoices, pages, subscriptions } from "@vakilmitra/db";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";
import { getServices, setServices } from "../src/services.js";

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const calls: { cancel: [string, boolean][] } = { cancel: [] };
let seq = 0;
setServices({
  ...getServices(),
  razorpay: {
    createOrder: async () => ({ id: `order_${stamp}_${++seq}` }),
    createSubscription: async () => ({ id: `sub_${stamp}_${++seq}` }),
    cancelSubscription: async (id, atCycleEnd) => {
      calls.cancel.push([id, atCycleEnd]);
    },
    refundPayment: async () => ({ id: "rfnd_1" }),
  },
});

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const DAY = 86_400_000;
const sign = (secret: string, data: string | Buffer) => createHmac("sha256", secret).update(data).digest("hex");

async function signup(name: string) {
  const agent = request.agent(app.server).set("Origin", ORIGIN);
  const email = `${name}-${stamp}@example.com`;
  expect((await agent.post("/api/auth/sign-up/email").send({ name, email, password: "password123" })).status).toBe(200);
  const id = (await agent.get("/api/me")).body.advocate.id as string;
  return { agent, id, email };
}

function webhook(body: unknown, secret = "test-webhook-secret") {
  const raw = JSON.stringify(body);
  return request(app.server)
    .post("/api/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Signature", sign(secret, raw))
    .send(raw);
}

const setSub = (advocateId: string, v: Partial<typeof subscriptions.$inferInsert>) =>
  db.update(subscriptions).set(v).where(eq(subscriptions.advocateId, advocateId));
const invoicesOf = (advocateId: string) => db.query.invoices.findMany({ where: eq(invoices.advocateId, advocateId) });

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("trial", () => {
  it("starts a 14-day trial with trial limits", async () => {
    const a = await signup("bill-trial");
    const r = await a.agent.get("/api/billing");
    expect(r.status).toBe(200);
    expect(r.body.billing).toMatchObject({
      plan: "TRIAL",
      state: "TRIAL",
      limits: { juniors: 1, pagesPerMonth: 100 },
      razorpayKeyId: "rzp_test_key",
    });
    const days = (Date.parse(r.body.billing.endsAt) - Date.now()) / DAY;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
  });

  it("gives grace after the trial, then turns read-only but keeps everything readable", async () => {
    const a = await signup("bill-expired");
    const c = await a.agent.post("/api/cases").send({ title: "Old matter" });
    expect(c.status).toBe(201);

    await setSub(a.id, { trialEndsAt: new Date(Date.now() - 2 * DAY) });
    expect((await a.agent.get("/api/billing")).body.billing.state).toBe("GRACE");
    expect((await a.agent.post("/api/cases").send({ title: "In grace" })).status).toBe(201);

    await setSub(a.id, { trialEndsAt: new Date(Date.now() - 8 * DAY) });
    expect((await a.agent.get("/api/billing")).body.billing.state).toBe("READ_ONLY");
    const blocked = await a.agent.post("/api/cases").send({ title: "Blocked" });
    expect(blocked.status).toBe(402);
    expect(blocked.body.error).toBe("read_only");
    expect((await a.agent.patch(`/api/cases/${c.body.case.id}`).send({ title: "x" })).status).toBe(402);
    expect((await a.agent.get("/api/cases")).status).toBe(200);
    expect((await a.agent.get(`/api/cases/${c.body.case.id}`)).status).toBe(200);
    // Billing and the account itself stay usable, so they can pay or leave.
    expect((await a.agent.put("/api/billing/details").send({ billingName: "Adv. Expired" })).status).toBe(200);
    expect((await a.agent.patch("/api/me").send({ name: "Adv. Expired" })).status).toBe(200);
  });
});

describe("yearly plan (Razorpay order)", () => {
  let a: Awaited<ReturnType<typeof signup>>;
  let orderId: string;

  beforeAll(async () => {
    a = await signup("bill-yearly");
  });

  it("creates an order for the plan price plus GST", async () => {
    const r = await a.agent.post("/api/billing/checkout").send({ plan: "PRO", interval: "YEARLY" });
    expect(r.status).toBe(200);
    expect(r.body.checkout.totalPaise).toBe(899_900 + 161_982);
    expect(r.body.checkout.subscriptionId).toBeNull();
    orderId = r.body.checkout.orderId;
    expect(orderId).toMatch(/^order_/);
  });

  it("rejects a forged payment", async () => {
    const r = await a.agent
      .post("/api/billing/verify")
      .send({ razorpay_payment_id: `pay_fake_${stamp}`, razorpay_order_id: orderId, razorpay_signature: "0".repeat(64) });
    expect(r.status).toBe(400);
    expect((await a.agent.get("/api/billing")).body.billing.plan).toBe("TRIAL");
  });

  it("activates the plan for a year and issues one GST invoice, however often it is reported", async () => {
    const body = {
      razorpay_payment_id: `pay_y1_${stamp}`,
      razorpay_order_id: orderId,
      razorpay_signature: sign("test-key-secret", `${orderId}|pay_y1_${stamp}`),
    };
    const r = await a.agent.post("/api/billing/verify").send(body);
    expect(r.status).toBe(200);
    expect(r.body.billing).toMatchObject({ plan: "PRO", interval: "YEARLY", state: "ACTIVE", limits: { juniors: 1, pagesPerMonth: 1500 } });
    expect((Date.parse(r.body.billing.endsAt) - Date.now()) / DAY).toBeGreaterThan(364);

    expect((await a.agent.post("/api/billing/verify").send(body)).status).toBe(200);
    const hook = await webhook({
      event: "payment.captured",
      payload: { payment: { entity: { id: `pay_y1_${stamp}`, order_id: orderId } } },
    });
    expect(hook.status).toBe(200);

    const list = await a.agent.get("/api/billing/invoices");
    expect(list.body.invoices).toHaveLength(1);
    const inv = list.body.invoices[0];
    expect(inv.number).toMatch(/^VM\/\d{4}-\d{2}\/\d{6}$/);
    expect(inv).toMatchObject({ amountPaise: 899_900, cgstPaise: 80_991, sgstPaise: 80_991, igstPaise: 0, totalPaise: 1_061_882 });
    expect((await a.agent.get(`/api/billing/invoices/${inv.id}`)).status).toBe(200);
  });

  it("charges IGST to customers outside Maharashtra", async () => {
    const b = await signup("bill-igst");
    await b.agent.put("/api/billing/details").send({ billingName: "Adv. Goa", gstin: "30abcde1234f1z5", billingState: "ga" });
    const c = await b.agent.post("/api/billing/checkout").send({ plan: "SOLO", interval: "YEARLY" });
    const o = c.body.checkout.orderId;
    await b.agent.post("/api/billing/verify").send({
      razorpay_payment_id: `pay_g1_${stamp}`,
      razorpay_order_id: o,
      razorpay_signature: sign("test-key-secret", `${o}|pay_g1_${stamp}`),
    });
    const [inv] = await invoicesOf(b.id);
    expect(inv).toMatchObject({
      igstPaise: 71_982,
      cgstPaise: 0,
      sgstPaise: 0,
      gstin: "30ABCDE1234F1Z5",
      billingState: "GA",
      billingName: "Adv. Goa",
    });
  });

  it("does not let one advocate claim another's checkout", async () => {
    const thief = await signup("bill-thief");
    const r = await thief.agent.post("/api/billing/verify").send({
      razorpay_payment_id: `pay_y2_${stamp}`,
      razorpay_order_id: orderId,
      razorpay_signature: sign("test-key-secret", `${orderId}|pay_y2_${stamp}`),
    });
    expect(r.status).toBe(404);
  });

  it("finishes a payment from the webhook when the browser never came back", async () => {
    const b = await signup("bill-closedtab");
    const o = (await b.agent.post("/api/billing/checkout").send({ plan: "SOLO", interval: "YEARLY" })).body.checkout.orderId;
    expect(
      (await webhook({ event: "payment.captured", payload: { payment: { entity: { id: `pay_ct_${stamp}`, order_id: o } } } })).status,
    ).toBe(200);
    expect((await b.agent.get("/api/billing")).body.billing).toMatchObject({ plan: "SOLO", state: "ACTIVE" });
  });
});

describe("monthly plan (Razorpay subscription)", () => {
  let a: Awaited<ReturnType<typeof signup>>;
  let subId: string;

  beforeAll(async () => {
    a = await signup("bill-monthly");
    const r = await a.agent.post("/api/billing/checkout").send({ plan: "SOLO", interval: "MONTHLY" });
    subId = r.body.checkout.subscriptionId;
  });

  it("activates on a verified first payment", async () => {
    const r = await a.agent.post("/api/billing/verify").send({
      razorpay_payment_id: `pay_m1_${stamp}`,
      razorpay_subscription_id: subId,
      razorpay_signature: sign("test-key-secret", `pay_m1_${stamp}|${subId}`),
    });
    expect(r.status).toBe(200);
    expect(r.body.billing).toMatchObject({ plan: "SOLO", interval: "MONTHLY", state: "ACTIVE" });
  });

  it("renews from webhooks with Razorpay's period, one invoice per charge", async () => {
    const start = Math.floor(Date.now() / 1000) + 30 * 86_400;
    const charged = (paymentId: string) =>
      webhook({
        event: "subscription.charged",
        payload: {
          subscription: { entity: { id: subId, current_start: start, current_end: start + 30 * 86_400 } },
          payment: { entity: { id: paymentId } },
        },
      });
    expect((await charged(`pay_m2_${stamp}`)).status).toBe(200);
    expect((await charged(`pay_m2_${stamp}`)).status).toBe(200);
    expect(await invoicesOf(a.id)).toHaveLength(2);
    const b = (await a.agent.get("/api/billing")).body.billing;
    expect(Date.parse(b.endsAt)).toBe((start + 30 * 86_400) * 1000);
  });

  it("flags failed renewals and cancels at the end of the period", async () => {
    await webhook({ event: "subscription.halted", payload: { subscription: { entity: { id: subId } } } });
    expect((await a.agent.get("/api/billing")).body.billing.paymentFailing).toBe(true);
    const r = await a.agent.post("/api/billing/cancel");
    expect(r.status).toBe(200);
    expect(r.body.billing).toMatchObject({ cancelAtPeriodEnd: true, state: "ACTIVE" });
    expect(calls.cancel).toContainEqual([subId, true]);
  });

  it("stops the old subscription when the plan changes", async () => {
    const r = await a.agent.post("/api/billing/checkout").send({ plan: "CHAMBER", interval: "MONTHLY" });
    const next = r.body.checkout.subscriptionId;
    await a.agent.post("/api/billing/verify").send({
      razorpay_payment_id: `pay_c1_${stamp}`,
      razorpay_subscription_id: next,
      razorpay_signature: sign("test-key-secret", `pay_c1_${stamp}|${next}`),
    });
    expect((await a.agent.get("/api/billing")).body.billing).toMatchObject({
      plan: "CHAMBER",
      cancelAtPeriodEnd: false,
      paymentFailing: false,
    });
    expect(calls.cancel).toContainEqual([subId, false]);
  });

  it("marks refunded invoices", async () => {
    await webhook({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: `pay_m1_${stamp}` } } } });
    const inv = await db.query.invoices.findFirst({ where: eq(invoices.razorpayPaymentId, `pay_m1_${stamp}`) });
    expect(inv?.status).toBe("REFUNDED");
  });

  it("rejects webhooks with a bad signature", async () => {
    const r = await webhook({ event: "refund.processed", payload: {} }, "wrong-secret");
    expect(r.status).toBe(400);
  });
});

describe("limits", () => {
  it("counts junior seats per plan, and covers juniors under a paid senior", async () => {
    const senior = await signup("bill-senior");
    const j1 = await signup("bill-j1");
    const j2 = await signup("bill-j2");
    const c1 = (await senior.agent.post("/api/cases").send({ title: "Shared 1" })).body.case.id;
    const c2 = (await senior.agent.post("/api/cases").send({ title: "Shared 2" })).body.case.id;

    await setSub(senior.id, { plan: "SOLO", interval: "YEARLY", paidUntil: new Date(Date.now() + 100 * DAY) });
    const solo = await senior.agent.post(`/api/cases/${c1}/grants`).send({ email: j1.email, role: "EDITOR" });
    expect(solo.status).toBe(402);
    expect(solo.body.error).toBe("plan_limit");

    await setSub(senior.id, { plan: "PRO" });
    expect((await senior.agent.post(`/api/cases/${c1}/grants`).send({ email: j1.email, role: "EDITOR" })).status).toBe(201);
    // The same junior on a second case uses no new seat.
    expect((await senior.agent.post(`/api/cases/${c2}/grants`).send({ email: j1.email, role: "EDITOR" })).status).toBe(201);
    expect((await senior.agent.post(`/api/cases/${c1}/grants`).send({ email: j2.email, role: "VIEWER" })).status).toBe(402);

    // The junior's own trial is long over, but the senior's plan covers them.
    await setSub(j1.id, { trialEndsAt: new Date(Date.now() - 30 * DAY) });
    const status = (await j1.agent.get("/api/billing")).body.billing;
    expect(status).toMatchObject({ state: "ACTIVE", coveredBy: { name: "bill-senior" } });
    expect((await j1.agent.post("/api/cases").send({ title: "Junior's own" })).status).toBe(201);
  });

  it("stops new pages once storage is full, but allows re-scanning an existing page", async () => {
    const a = await signup("bill-pages");
    const caseId = (await a.agent.post("/api/cases").send({ title: "Scans" })).body.case.id;
    const docId = (await a.agent.post(`/api/cases/${caseId}/documents`).send({ type: "SEVEN_TWELVE" })).body.document.id;
    const jpeg = await sharp({ create: { width: 400, height: 500, channels: 3, background: "#eee" } })
      .jpeg()
      .toBuffer();
    const upload = (n: number) =>
      a.agent.post(`/api/documents/${docId}/pages?pageNo=${n}`).attach("page", jpeg, { filename: "p.jpg", contentType: "image/jpeg" });
    expect((await upload(1)).status).toBe(201);

    const doc = await db.query.documents.findFirst({ where: eq(documents.id, docId) });
    expect(doc).toBeTruthy();
    await db
      .update(pages)
      .set({ byteSize: 2 ** 31 - 1 })
      .where(eq(pages.documentId, docId));
    const full = await upload(2);
    expect(full.status).toBe(402);
    expect(full.body.details.limit).toBe("storageBytes");
    expect((await upload(1)).status).toBe(200);
    expect((await a.agent.get("/api/billing")).body.billing.usage.pagesThisMonth).toBe(1);
  });
});
