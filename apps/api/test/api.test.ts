import { accessLogs, and, count, eq, flags, hearings } from "@vakilmitra/db";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";

const app = await buildApp();
await app.ready();
const server = app.server;
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signup(email: string) {
  const agent = request.agent(server).set("Origin", ORIGIN);
  const r = await agent.post("/api/auth/sign-up/email").send({ name: "Adv. Test", email, password: "password123" });
  expect(r.status).toBe(200);
  return agent;
}

const countLogs = async (entityId: string, action: string) =>
  (
    await db
      .select({ n: count() })
      .from(accessLogs)
      .where(and(eq(accessLogs.entityId, entityId), eq(accessLogs.action, action)))
  )[0].n;

let senior: ReturnType<typeof request.agent>;
let other: ReturnType<typeof request.agent>;
let clientId: string;
let caseId: string;

beforeAll(async () => {
  senior = await signup(`senior-${stamp}@example.com`);
  other = await signup(`other-${stamp}@example.com`);
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("auth", () => {
  it("rejects unauthenticated requests", async () => {
    expect((await request(server).get("/api/cases")).status).toBe(401);
  });

  it("returns the signed-in advocate without the password hash", async () => {
    const r = await senior.get("/api/me");
    expect(r.status).toBe(200);
    expect(r.body.advocate.locale).toBe("mr");
    expect(r.body.advocate.password).toBeUndefined();
  });

  it("rejects a wrong password and a duplicate email", async () => {
    const bad = await request(server)
      .post("/api/auth/sign-in/email")
      .set("Origin", ORIGIN)
      .send({ email: `senior-${stamp}@example.com`, password: "nope" });
    expect(bad.status).toBe(401);
    const dup = await request(server)
      .post("/api/auth/sign-up/email")
      .set("Origin", ORIGIN)
      .send({ name: "Dup", email: `SENIOR-${stamp}@example.com`, password: "password123" });
    expect(dup.status).toBeGreaterThanOrEqual(400);
  });

  it("signs in and out with a session cookie", async () => {
    const agent = request.agent(server).set("Origin", ORIGIN);
    expect(
      (await agent.post("/api/auth/sign-in/email").send({ email: `senior-${stamp}@example.com`, password: "password123" })).status,
    ).toBe(200);
    expect((await agent.get("/api/me")).status).toBe(200);
    expect((await agent.post("/api/auth/sign-out").send({})).status).toBe(200);
    expect((await agent.get("/api/me")).status).toBe(401);
  });

  it("does not expose Better Auth's password-optional delete endpoint", async () => {
    expect((await senior.post("/api/auth/delete-user").send({})).status).toBe(404);
  });
});

describe("cloud OCR consent", () => {
  it("is off by default, can be turned on and off, and every change is logged", async () => {
    const me = await senior.get("/api/me");
    expect(me.body.advocate).toMatchObject({ cloudOcrConsent: false, cloudOcrConsentAt: null });

    const on = await senior.patch("/api/me").send({ cloudOcrConsent: true });
    expect(on.body.advocate.cloudOcrConsent).toBe(true);
    expect(Date.parse(on.body.advocate.cloudOcrConsentAt)).toBeGreaterThan(Date.now() - 60_000);

    const off = await senior.patch("/api/me").send({ cloudOcrConsent: false });
    expect(off.body.advocate).toMatchObject({ cloudOcrConsent: false, cloudOcrConsentAt: null });

    expect(await countLogs(me.body.advocate.id, "consent.cloud_ocr.on")).toBe(1);
    expect(await countLogs(me.body.advocate.id, "consent.cloud_ocr.off")).toBe(1);
  });

  it("keeps the original consent date when 'on' is sent again, and does not log it twice", async () => {
    const me = await senior.get("/api/me");
    const first = (await senior.patch("/api/me").send({ cloudOcrConsent: true })).body.advocate.cloudOcrConsentAt;
    await new Promise((r) => setTimeout(r, 20));
    const again = (await senior.patch("/api/me").send({ cloudOcrConsent: true })).body.advocate.cloudOcrConsentAt;
    expect(again).toBe(first);
    expect(await countLogs(me.body.advocate.id, "consent.cloud_ocr.on")).toBe(2); // one from the earlier test, one here
    await senior.patch("/api/me").send({ cloudOcrConsent: false });
  });

  it("leaves consent alone when other profile fields change", async () => {
    await senior.patch("/api/me").send({ cloudOcrConsent: true });
    const r = await senior.patch("/api/me").send({ phone: "9800000009" });
    expect(r.body.advocate.cloudOcrConsent).toBe(true);
    await senior.patch("/api/me").send({ cloudOcrConsent: false });
  });
});

describe("clients and cases", () => {
  it("creates a client, a case and a party", async () => {
    const c = await senior.post("/api/clients").send({ name: "सुनील जाधव", phone: "9800000000" });
    expect(c.status).toBe(201);
    clientId = c.body.client.id;

    const k = await senior.post("/api/cases").send({
      title: "जाधव वि. पाटील",
      kind: "LAND_PROPERTY",
      clientId,
      court: "Civil Judge Jr. Dn., Baramati",
      caseNumber: "RCS 123/2025",
    });
    expect(k.status).toBe(201);
    caseId = k.body.case.id;

    const p = await senior.post(`/api/cases/${caseId}/parties`).send({ name: "सुनील जाधव", role: "PLAINTIFF", isOurClient: true });
    expect(p.status).toBe(201);
  });

  it("validates input", async () => {
    const r = await senior.post("/api/cases").send({ title: "" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_input");
  });

  it("will not attach another advocate's client", async () => {
    expect((await other.post("/api/cases").send({ title: "x", clientId })).status).toBe(404);
  });

  it("searches cases by party name", async () => {
    const r = await senior.get("/api/cases").query({ q: "जाधव" });
    expect(r.body.cases.map((c: { id: string }) => c.id)).toContain(caseId);
  });

  it("hides one advocate's case from another and logs views", async () => {
    expect((await other.get(`/api/cases/${caseId}`)).status).toBe(404);
    expect((await other.get("/api/cases")).body.cases).toHaveLength(0);
    expect((await other.post(`/api/cases/${caseId}/hearings`).send({ date: "2026-12-01" })).status).toBe(404);
    expect((await senior.get(`/api/cases/${caseId}`)).status).toBe(200);
    expect(await countLogs(caseId, "case.view")).toBe(1);
  });

  it("shares a case with a junior as viewer only", async () => {
    const g = await senior.post(`/api/cases/${caseId}/grants`).send({ email: `other-${stamp}@example.com`, role: "VIEWER" });
    expect(g.status).toBe(201);
    expect((await other.get(`/api/cases/${caseId}`)).body.access).toBe("VIEWER");
    expect((await other.patch(`/api/cases/${caseId}`).send({ notes: "x" })).status).toBe(403);
    expect((await other.delete(`/api/cases/${caseId}/grants/${g.body.grant.id}`)).status).toBe(403);
    expect((await senior.delete(`/api/cases/${caseId}/grants/${g.body.grant.id}`)).status).toBe(204);
    expect((await other.get(`/api/cases/${caseId}`)).status).toBe(404);
  });
});

describe("case diary", () => {
  it("shows today's hearings on the board and records the next date", async () => {
    const now = new Date();
    const h = await senior.post(`/api/cases/${caseId}/hearings`).send({ date: now.toISOString(), purpose: "Evidence" });
    expect(h.status).toBe(201);
    expect(h.body.hearing.court).toBe("Civil Judge Jr. Dn., Baramati"); // inherited from the case

    const board = await senior.get("/api/diary/board");
    expect(board.body.hearings.map((x: { id: string }) => x.id)).toContain(h.body.hearing.id);

    const next = new Date(now.getTime() + 21 * 86400000);
    const u = await senior
      .patch(`/api/hearings/${h.body.hearing.id}`)
      .send({ outcome: "Adjourned", next: { date: next.toISOString(), purpose: "Arguments" } });
    expect(u.status).toBe(200);
    expect(u.body.nextHearing.purpose).toBe("Arguments");

    const list = await senior.get("/api/diary").query({ to: new Date(next.getTime() + 86400000).toISOString().slice(0, 10) });
    expect(list.body.hearings.filter((x: { caseId: string }) => x.caseId === caseId)).toHaveLength(2);
  });

  it("rejects malformed dates", async () => {
    expect((await senior.get("/api/diary/board").query({ date: "tomorrow" })).status).toBe(400);
  });
});

describe("fees", () => {
  it("shows outstanding per client", async () => {
    const a = await senior.post("/api/fees/agreements").send({
      clientId,
      caseId,
      description: "Suit fee",
      totalRupees: 25000,
      installments: [
        { dueDate: "2025-01-01", amountRupees: 10000 },
        { dueDate: "2099-01-01", amountRupees: 15000 },
      ],
    });
    expect(a.status).toBe(201);
    const pay = await senior
      .post(`/api/fees/agreements/${a.body.agreement.id}/payments`)
      .send({ amountRupees: 4000.5, paidOn: "2025-02-01", mode: "upi" });
    expect(pay.status).toBe(201);

    const s = await senior.get("/api/fees/summary");
    const row = s.body.clients.find((c: { clientId: string }) => c.clientId === clientId);
    expect(row).toMatchObject({ totalPaise: 2500000, paidPaise: 400050, outstandingPaise: 2099950, overduePaise: 599950 });
    expect(row.nextDue.amountPaise).toBe(1500000);

    expect((await other.get("/api/fees/summary")).body.clients).toHaveLength(0);
    expect((await other.get(`/api/fees/agreements/${a.body.agreement.id}`)).status).toBe(404);
    expect((await senior.get(`/api/fees/invoice/${clientId}`)).body.totals.outstandingPaise).toBe(2099950);
  });
});

describe("land chain", () => {
  it("raises deterministic flags and keeps resolved ones resolved", async () => {
    const p = await senior
      .post(`/api/cases/${caseId}/properties`)
      .send({ gatNo: "112", village: "माळेगाव", taluka: "बारामती", district: "पुणे" });
    expect(p.status).toBe(201);
    const base = `/api/cases/${caseId}/properties/${p.body.property.id}`;
    const events = [
      { kind: "RECORD_SNAPSHOT", date: "1994-01-01", owners: ["रामचंद्र पाटील"], areaSqm: 8100, landClass: "Class-II" },
      { kind: "DEED", subtype: "sale", date: "2001-03-10", deedRegNo: "1234/2001", fromParties: ["रामचंद्र पाटील"], toParties: ["सुरेश जाधव"] },
      {
        kind: "RECORD_SNAPSHOT",
        date: "2024-01-01",
        owners: ["सुरेश जाधव"],
        areaSqm: 8100,
        landClass: "Class-I",
        otherRights: ["बँक ऑफ महाराष्ट्र बोजा"],
      },
    ];
    for (const e of events) expect((await senior.post(`${base}/events`).send(e)).status).toBe(201);

    const r = await senior.post(`${base}/check`);
    expect(r.status).toBe(200);
    const rules = r.body.flags.map((f: { rule: string }) => f.rule).sort();
    expect(rules).toEqual(["DEED_WITHOUT_MUTATION", "LAND_CLASS_CHANGE", "OTHER_RIGHTS_ENTRY"]);
    expect(r.body.flags[0].message).toMatch(/[ऀ-ॿ]/); // Marathi by default

    const cls = r.body.flags.find((f: { rule: string }) => f.rule === "LAND_CLASS_CHANGE");
    const res = await senior
      .patch(`/api/cases/${caseId}/flags/${cls.id}`)
      .send({ resolved: true, resolution: "Conversion order dated 2010 on file" });
    expect(res.status).toBe(200);

    const again = await senior.post(`${base}/check`).query({ lang: "en" });
    expect(again.body.flags).toHaveLength(3);
    expect(again.body.flags.filter((f: { resolved: boolean }) => f.resolved)).toHaveLength(1);
  });
});

describe("deletion", () => {
  it("deletes a case with everything in it", async () => {
    expect((await other.delete(`/api/cases/${caseId}`)).status).toBe(404);
    expect((await senior.delete(`/api/cases/${caseId}`)).status).toBe(204);
    expect((await db.select({ n: count() }).from(hearings).where(eq(hearings.caseId, caseId)))[0].n).toBe(0);
    expect((await db.select({ n: count() }).from(flags).where(eq(flags.caseId, caseId)))[0].n).toBe(0);
    expect(await countLogs(caseId, "case.delete")).toBe(1);
  });

  it("deletes the whole account after password confirmation", async () => {
    const me = await other.get("/api/me");
    expect((await other.delete("/api/me").send({ password: "wrong" })).status).toBe(401);
    expect((await other.delete("/api/me").send({ password: "password123" })).status).toBe(204);
    expect((await other.get("/api/me")).status).toBe(401);
    expect(await countLogs(me.body.advocate.id, "account.delete")).toBe(1);
  });
});
