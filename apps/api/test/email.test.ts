/** Account emails: password reset, address check, and payment receipts. */
import { advocates, eq } from "@vakilmitra/db";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { recordCharge } from "../src/billing/service.js";
import { db, pool } from "../src/db.js";
import type { Mail } from "../src/mail.js";
import { getServices, setServices } from "../src/services.js";

const sent: Mail[] = [];
setServices({ ...getServices(), mailer: { send: async (m) => void sent.push(m) } });

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const email = `mail-${stamp}@example.com`;
const mailTo = (to: string) => sent.filter((m) => m.to === to);
const linkIn = (m: Mail) => new URL(/https?:\/\/\S+/.exec(m.text)![0]);
/** Path and query of an API link, for supertest. */
const apiPath = (u: URL) => `${u.pathname}${u.search}`;

let agent: request.Agent;
let advocateId: string;

beforeAll(async () => {
  agent = request.agent(app.server).set("Origin", ORIGIN);
  await agent.post("/api/auth/sign-up/email").send({ name: "Adv. Mail Test", email, password: "password123", locale: "en" });
  advocateId = (await agent.get("/api/me")).body.advocate.id;
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("email address check", () => {
  it("sends a link at sign-up that confirms the address and returns to the app", async () => {
    expect((await agent.get("/api/me")).body.advocate.emailVerified).toBe(false);
    const [m] = mailTo(email);
    expect(m?.subject).toMatch(/confirm your email/);
    const link = linkIn(m!);
    expect(link.searchParams.get("callbackURL")).toBe(`${ORIGIN}/settings?verified=1`);
    const r = await request(app.server).get(apiPath(link));
    expect(r.status).toBe(302);
    expect(r.headers.location).toBe(`${ORIGIN}/settings?verified=1`);
    expect((await agent.get("/api/me")).body.advocate.emailVerified).toBe(true);
  });
});

describe("password reset", () => {
  it("says the same for unknown addresses and sends nothing", async () => {
    const before = sent.length;
    const r = await request(app.server)
      .post("/api/auth/request-password-reset")
      .set("Origin", ORIGIN)
      .send({ email: `nobody-${stamp}@example.com`, redirectTo: `${ORIGIN}/reset-password` });
    expect(r.status).toBe(200);
    expect(sent.length).toBe(before);
  });

  it("emails a one-hour link; the new password works and every old session ends", async () => {
    const r = await request(app.server)
      .post("/api/auth/request-password-reset")
      .set("Origin", ORIGIN)
      .send({ email, redirectTo: `${ORIGIN}/reset-password` });
    expect(r.status).toBe(200);
    const m = mailTo(email).at(-1)!;
    expect(m.subject).toMatch(/set a new password/);
    expect(m.text).toMatch(/one hour/);

    // The emailed link checks the token and sends the browser to the app's reset page with it.
    const hop = await request(app.server).get(apiPath(linkIn(m)));
    expect(hop.status).toBe(302);
    const back = new URL(hop.headers.location);
    expect(`${back.origin}${back.pathname}`).toBe(`${ORIGIN}/reset-password`);
    const token = back.searchParams.get("token")!;

    const done = await request(app.server)
      .post("/api/auth/reset-password")
      .set("Origin", ORIGIN)
      .send({ token, newPassword: "new-password-456" });
    expect(done.status).toBe(200);
    expect((await agent.get("/api/me")).status).toBe(401);

    const fresh = request.agent(app.server).set("Origin", ORIGIN);
    expect((await fresh.post("/api/auth/sign-in/email").send({ email, password: "password123" })).status).toBe(401);
    expect((await fresh.post("/api/auth/sign-in/email").send({ email, password: "new-password-456" })).status).toBe(200);
    agent = fresh;

    // A token works once.
    const again = await request(app.server)
      .post("/api/auth/reset-password")
      .set("Origin", ORIGIN)
      .send({ token, newPassword: "another-pass-789" });
    expect(again.status).toBe(400);
  });
});

describe("payment receipts", () => {
  it("emails one receipt per payment, with a link to the GST invoice", async () => {
    await db.update(advocates).set({ locale: "en" }).where(eq(advocates.id, advocateId));
    const charge = {
      advocateId,
      plan: "PRO" as const,
      interval: "MONTHLY" as const,
      paymentId: `pay_mail_${stamp}`,
      razorpaySubscriptionId: null,
    };
    await recordCharge(charge);
    await recordCharge(charge); // the webhook reporting the same payment
    const receipts = mailTo(email).filter((m) => /payment received/.test(m.subject));
    expect(receipts).toHaveLength(1);
    expect(receipts[0]!.subject).toMatch(/invoice VM\/\d{4}-\d{2}\/\d{6}/);
    expect(receipts[0]!.text).toMatch(/₹1,060\.82 \(including GST\) for the Pro plan/);
    expect(linkIn(receipts[0]!).href).toMatch(new RegExp(`^${ORIGIN}/billing/invoices/`));
  });

  it("writes in Marathi for Marathi accounts", async () => {
    await db.update(advocates).set({ locale: "mr" }).where(eq(advocates.id, advocateId));
    await recordCharge({ advocateId, plan: "SOLO", interval: "MONTHLY", paymentId: `pay_mail2_${stamp}`, razorpaySubscriptionId: null });
    expect(mailTo(email).at(-1)!.subject).toMatch(/पैसे मिळाले/);
  });
});
