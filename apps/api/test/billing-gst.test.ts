/**
 * Billing once we are registered for GST: tax added at checkout, CGST + SGST inside Maharashtra,
 * IGST outside, and invoices that carry our GSTIN. The rest of billing is covered in billing.test.ts.
 */
import { createHmac } from "node:crypto";
import { advocates, eq, invoices } from "@vakilmitra/db";
import { gstFor } from "@vakilmitra/shared";
import request from "supertest";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("@vakilmitra/shared", async (importOriginal) => ({ ...(await importOriginal<object>()), GST_REGISTERED: true }));

const { buildApp } = await import("../src/app.js");
const { db, pool } = await import("../src/db.js");
const { recordCharge } = await import("../src/billing/service.js");
const { getServices, setServices } = await import("../src/services.js");
type Mail = import("../src/mail.js").Mail;

const sent: Mail[] = [];
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let seq = 0;
setServices({
  ...getServices(),
  mailer: { send: async (m: Mail) => void sent.push(m) },
  razorpay: {
    createOrder: async () => ({ id: `order_gst_${stamp}_${++seq}` }),
    createSubscription: async () => ({ id: `sub_gst_${stamp}_${++seq}` }),
    cancelSubscription: async () => undefined,
    refundPayment: async () => ({ id: "rfnd_1" }),
  },
});

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const sign = (data: string) => createHmac("sha256", "test-key-secret").update(data).digest("hex");

async function signup(name: string) {
  const agent = request.agent(app.server).set("Origin", ORIGIN);
  const email = `${name}-${stamp}@example.com`;
  expect((await agent.post("/api/auth/sign-up/email").send({ name, email, password: "password123" })).status).toBe(200);
  const id = (await agent.get("/api/me")).body.advocate.id as string;
  return { agent, id, email };
}

async function payYearly(a: Awaited<ReturnType<typeof signup>>, plan: "SOLO" | "PRO", pay: string) {
  const c = await a.agent.post("/api/billing/checkout").send({ plan, interval: "YEARLY" });
  const o = c.body.checkout.orderId as string;
  const v = await a.agent
    .post("/api/billing/verify")
    .send({ razorpay_payment_id: pay, razorpay_order_id: o, razorpay_signature: sign(`${o}|${pay}`) });
  expect(v.status).toBe(200);
  return c.body.checkout.totalPaise as number;
}

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("GST split", () => {
  it("is CGST + SGST inside Maharashtra, IGST outside, and nothing when not registered", () => {
    expect(gstFor(899_900, "MH", true)).toEqual({
      cgstPaise: 80_991,
      sgstPaise: 80_991,
      igstPaise: 0,
      gstPaise: 161_982,
      totalPaise: 1_061_882,
    });
    expect(gstFor(399_900, "GA", true)).toMatchObject({ cgstPaise: 0, sgstPaise: 0, igstPaise: 71_982, totalPaise: 471_882 });
    expect(gstFor(899_900, "MH", false)).toEqual({ cgstPaise: 0, sgstPaise: 0, igstPaise: 0, gstPaise: 0, totalPaise: 899_900 });
  });
});

describe("when registered for GST", () => {
  it("adds GST at checkout and issues a tax invoice with our GSTIN", async () => {
    const a = await signup("gst-mh");
    expect(await payYearly(a, "PRO", `pay_gst1_${stamp}`)).toBe(1_061_882);
    const list = await a.agent.get("/api/billing/invoices");
    const inv = list.body.invoices[0];
    expect(inv).toMatchObject({ amountPaise: 899_900, cgstPaise: 80_991, sgstPaise: 80_991, igstPaise: 0, totalPaise: 1_061_882 });
    expect(inv.supplierGstin).toBe("27AAAAA0000A1Z5");
    const one = await a.agent.get(`/api/billing/invoices/${inv.id}`);
    expect(one.body.supplier.gstin).toBe("27AAAAA0000A1Z5");
  });

  it("charges IGST to customers outside Maharashtra and keeps their GSTIN", async () => {
    const b = await signup("gst-ga");
    await b.agent.put("/api/billing/details").send({ billingName: "Adv. Goa", gstin: "30abcde1234f1z5", billingState: "ga" });
    expect(await payYearly(b, "SOLO", `pay_gst2_${stamp}`)).toBe(471_882);
    const [inv] = await db.query.invoices.findMany({ where: eq(invoices.advocateId, b.id) });
    expect(inv).toMatchObject({ igstPaise: 71_982, cgstPaise: 0, sgstPaise: 0, gstin: "30ABCDE1234F1Z5", billingState: "GA" });
  });

  it("emails a receipt that links to the tax invoice and says GST is included", async () => {
    const c = await signup("gst-mail");
    await db.update(advocates).set({ locale: "en" }).where(eq(advocates.id, c.id));
    await recordCharge({
      advocateId: c.id,
      plan: "PRO",
      interval: "MONTHLY",
      paymentId: `pay_gst3_${stamp}`,
      razorpaySubscriptionId: null,
    });
    const m = sent.filter((x) => x.to === c.email).at(-1)!;
    expect(m.subject).toMatch(/invoice VM\//);
    expect(m.text).toMatch(/₹1,060\.82 \(including GST\) for the Pro plan/);
    expect(m.text).toMatch(/View or print the tax invoice/);
  });
});
