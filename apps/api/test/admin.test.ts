/** Staff admin panel API: its own sign-in, the dashboard, account actions, and no access to client files. */
import { eq, staff, subscriptions } from "@vakilmitra/db";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentStep, hashPassword, newTotpSecret, sealSecret, totpAt } from "../src/admin/security.js";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";
import { resetLoginFailures } from "../src/routes/admin.js";
import { getServices, setServices } from "../src/services.js";

const refunds: string[] = [];
setServices({
  ...getServices(),
  razorpay: {
    createOrder: async () => ({ id: "order_x" }),
    createSubscription: async () => ({ id: "sub_x" }),
    cancelSubscription: async () => undefined,
    refundPayment: async (id) => {
      refunds.push(id);
      return { id: `rfnd_${id}` };
    },
  },
});

const app = await buildApp();
await app.ready();
const ADMIN = "http://localhost:5174";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let staffSeq = 0;
async function makeStaff(role: "OWNER" | "SUPPORT") {
  const email = `${role.toLowerCase()}-${++staffSeq}-${stamp}@vakilmitra.in`;
  const secret = newTotpSecret();
  await db
    .insert(staff)
    .values({ email, name: `Staff ${role}`, role, passwordHash: hashPassword("staff-pass-123"), totpSecret: sealSecret(secret) });
  return { email, secret };
}

async function login(s: { email: string; secret: string }, step = currentStep()) {
  const agent = request.agent(app.server).set("Origin", ADMIN);
  const r = await agent.post("/api/admin/login").send({ email: s.email, password: "staff-pass-123", code: totpAt(s.secret, step) });
  return { agent, r };
}

let owner: request.Agent;
let support: request.Agent;
let advocateId: string;

beforeAll(async () => {
  resetLoginFailures();
  const o = await makeStaff("OWNER");
  owner = (await login(o)).agent;
  // Support signs in one step earlier, so the two logins do not share a code.
  support = (await login(await makeStaff("SUPPORT"), currentStep() - 1)).agent;
  const adv = request.agent(app.server).set("Origin", "http://localhost:5173");
  await adv
    .post("/api/auth/sign-up/email")
    .send({ name: "Adv. Admin Test", email: `adm-adv-${stamp}@example.com`, password: "password123" });
  advocateId = (await adv.get("/api/me")).body.advocate.id;
  await adv.post("/api/cases").send({ title: "Secret land matter of Patil" });
  await adv.post("/api/clients").send({ name: "गोपनीय पक्षकार" });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("staff sign-in", () => {
  it("needs the password and a fresh authenticator code", async () => {
    resetLoginFailures();
    const s = await makeStaff("SUPPORT");
    const bad = request(app.server).post("/api/admin/login").set("Origin", ADMIN);
    expect((await bad.send({ email: s.email, password: "staff-pass-123", code: "000000" })).status).toBe(401);
    expect(
      (
        await request(app.server)
          .post("/api/admin/login")
          .set("Origin", ADMIN)
          .send({ email: s.email, password: "wrong", code: totpAt(s.secret, currentStep()) })
      ).status,
    ).toBe(401);
    const ok = await login(s);
    expect(ok.r.status).toBe(200);
    expect(ok.r.headers["set-cookie"]?.[0]).toMatch(/HttpOnly; SameSite=Strict/);
    expect((await ok.agent.get("/api/admin/me")).body.staff.email).toBe(s.email);
    // The same code cannot be used twice.
    expect((await login(s)).r.status).toBe(401);
  });

  it("locks out after five failures", async () => {
    resetLoginFailures();
    const s = await makeStaff("SUPPORT");
    for (let i = 0; i < 5; i++) {
      await request(app.server).post("/api/admin/login").set("Origin", ADMIN).send({ email: s.email, password: "x", code: "123456" });
    }
    const r = await login(s);
    expect(r.r.status).toBe(429);
    resetLoginFailures();
  });

  it("refuses changes from another site, and anyone without a staff session", async () => {
    expect((await request(app.server).get("/api/admin/dashboard")).status).toBe(401);
    const advocateCookie = request.agent(app.server).set("Origin", "http://localhost:5173");
    expect((await advocateCookie.post("/api/admin/logout")).status).toBe(403);
    expect(
      (await owner.post(`/api/admin/accounts/${advocateId}/trial`).set("Origin", "http://evil.example").send({ days: 5 })).status,
    ).toBe(403);
  });
});

describe("dashboard and accounts", () => {
  it("shows business numbers", async () => {
    const r = await owner.get("/api/admin/dashboard");
    expect(r.status).toBe(200);
    expect(r.body.accounts.total).toBeGreaterThan(0);
    expect(r.body.accounts.byState.TRIAL).toBeGreaterThan(0);
    expect(typeof r.body.mrrPaise).toBe("number");
    expect(Array.isArray(r.body.signups30d)).toBe(true);
  });

  it("lists and opens accounts with counts only, never client files", async () => {
    const list = await support.get("/api/admin/accounts").query({ q: `adm-adv-${stamp}` });
    expect(list.status).toBe(200);
    expect(list.body.accounts).toHaveLength(1);
    expect(list.body.accounts[0]).toMatchObject({ plan: "TRIAL", state: "TRIAL", cases: 1 });

    const one = await support.get(`/api/admin/accounts/${advocateId}`);
    expect(one.status).toBe(200);
    expect(one.body.counts).toEqual({ cases: 1, clients: 1, documents: 0 });
    const text = JSON.stringify(one.body);
    expect(text).not.toContain("Secret land matter");
    expect(text).not.toContain("गोपनीय");
  });

  it("filters by state", async () => {
    const r = await owner.get("/api/admin/accounts").query({ state: "READ_ONLY", q: `adm-adv-${stamp}` });
    expect(r.body.accounts).toHaveLength(0);
  });
});

describe("account actions", () => {
  it("lets support extend a trial, with an audit row", async () => {
    const before = await db.query.subscriptions.findFirst({ where: eq(subscriptions.advocateId, advocateId) });
    const r = await support.post(`/api/admin/accounts/${advocateId}/trial`).send({ days: 7, note: "Asked at bar association demo" });
    expect(r.status).toBe(200);
    expect(Date.parse(r.body.billing.endsAt) - before!.trialEndsAt.getTime()).toBe(7 * 86_400_000);
    const audit = await owner.get("/api/admin/audit");
    expect(
      audit.body.entries.some((e: { action: string; targetId: string }) => e.action === "trial.extend" && e.targetId === advocateId),
    ).toBe(true);
  });

  it("lets only an owner give a free plan", async () => {
    const body = { plan: "PRO", until: "2099-12-31", note: "Pilot partner" };
    expect((await support.post(`/api/admin/accounts/${advocateId}/comp`).send(body)).status).toBe(403);
    const r = await owner.post(`/api/admin/accounts/${advocateId}/comp`).send(body);
    expect(r.status).toBe(200);
    expect(r.body.billing).toMatchObject({ plan: "PRO", state: "ACTIVE", complimentary: true });
    // Free plans are not revenue.
    expect((await owner.get("/api/admin/dashboard")).body.accounts.complimentary).toBeGreaterThan(0);
    const history = (await owner.get(`/api/admin/accounts/${advocateId}`)).body.history;
    expect(history[0]).toMatchObject({ action: "plan.comp", staffName: "Staff OWNER" });
  });

  it("refunds a payment through Razorpay (owner only)", async () => {
    const [inv] = await db
      .insert((await import("@vakilmitra/db")).invoices)
      .values({
        advocateId,
        number: `TEST/${stamp}`,
        plan: "SOLO",
        interval: "MONTHLY",
        amountPaise: 39_900,
        cgstPaise: 3_591,
        sgstPaise: 3_591,
        igstPaise: 0,
        totalPaise: 47_082,
        periodStart: new Date(),
        periodEnd: new Date(),
        billingName: "Adv. Admin Test",
        billingEmail: "x@example.com",
        razorpayPaymentId: `pay_admin_${stamp}`,
      })
      .returning();
    expect((await support.post(`/api/admin/invoices/${inv!.id}/refund`).send({ note: "Duplicate" })).status).toBe(403);
    expect((await owner.post(`/api/admin/invoices/${inv!.id}/refund`).send({ note: "Duplicate" })).status).toBe(200);
    expect(refunds).toContain(`pay_admin_${stamp}`);
    expect((await owner.post(`/api/admin/invoices/${inv!.id}/refund`).send({ note: "Again" })).status).toBe(409);
  });

  it("signs out", async () => {
    const s = await makeStaff("SUPPORT");
    const { agent } = await login(s, currentStep() + 1);
    expect((await agent.post("/api/admin/logout")).status).toBe(204);
    expect((await agent.get("/api/admin/me")).status).toBe(401);
  });
});
