/** The audit trail: every request, sign-in events, staff requests, and who can read what. */
import { accessLogs, and, desc, eq, staff, staffAudit, subscriptions } from "@vakilmitra/db";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { currentStep, hashPassword, newTotpSecret, sealSecret, totpAt } from "../src/admin/security.js";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";
import { describeRoute } from "../src/lib/audit.js";

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const ADMIN = "http://localhost:5174";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signup(name: string) {
  const agent = request.agent(app.server).set("Origin", ORIGIN).set("User-Agent", "Mozilla/5.0 (test)");
  const email = `${name}-${stamp}@example.com`;
  const r = await agent.post("/api/auth/sign-up/email").send({ name: `Adv. ${name}`, email, password: "password123" });
  return { agent, email, id: r.body.user.id as string };
}

const rows = (where: Parameters<typeof and>[number]) => db.select().from(accessLogs).where(where).orderBy(desc(accessLogs.at));

let owner: Awaited<ReturnType<typeof signup>>;
let junior: Awaited<ReturnType<typeof signup>>;
let caseId: string;

beforeAll(async () => {
  owner = await signup("au-owner");
  junior = await signup("au-junior");
  await db
    .update(subscriptions)
    .set({ plan: "CHAMBER", paidUntil: new Date(Date.now() + 86_400_000) })
    .where(eq(subscriptions.advocateId, owner.id));
  caseId = (await owner.agent.post("/api/cases").send({ title: "Audit case" })).body.case.id;
  await owner.agent.post(`/api/cases/${caseId}/grants`).send({ email: junior.email, role: "EDITOR" });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("naming actions from routes", () => {
  it.each([
    ["/api/cases/:id", "GET", { id: "c1" }, "case.view", "c1", "c1"],
    ["/api/cases", "POST", {}, "case.create", null, undefined],
    ["/api/cases", "GET", {}, "case.list", null, undefined],
    ["/api/cases/:caseId/hearings", "POST", { caseId: "c1" }, "hearing.create", null, "c1"],
    ["/api/documents/:id/extract", "POST", { id: "d1" }, "document.extract", "d1", undefined],
    ["/api/cases/:caseId/properties/:propertyId/report", "GET", { caseId: "c1", propertyId: "p1" }, "report.view", "p1", "c1"],
    ["/api/cases/:caseId/properties/:propertyId/report/approve", "POST", { caseId: "c1", propertyId: "p1" }, "report.approve", "p1", "c1"],
    ["/api/documents/:id/pages/:pageId/image", "GET", { id: "d1", pageId: "p9" }, "page.view", "p9", undefined],
    ["/api/me", "PATCH", {}, "account.update", null, undefined],
  ])("%s %s", (route, method, params, action, entityId, caseId) => {
    const d = describeRoute(route, method, params as Record<string, string>);
    expect([d.action, d.entityId, d.caseId]).toEqual([action, entityId, caseId]);
  });
});

describe("advocate requests", () => {
  it("records creates with the new id, changes with field names (not values), and searches without the words", async () => {
    const [created] = await rows(and(eq(accessLogs.advocateId, owner.id), eq(accessLogs.action, "case.create")));
    expect(created).toMatchObject({ entityId: caseId, caseId, status: 201, method: "POST", route: "/api/cases" });

    await owner.agent.patch(`/api/cases/${caseId}`).send({ title: "गुप्त नाव" });
    const [changed] = await rows(and(eq(accessLogs.caseId, caseId), eq(accessLogs.action, "case.update")));
    expect(changed.details).toMatchObject({ fields: ["title"] });
    expect(JSON.stringify(changed)).not.toContain("गुप्त");

    await owner.agent.get("/api/search").query({ q: "जाधव पाटील" });
    const [search] = await rows(and(eq(accessLogs.advocateId, owner.id), eq(accessLogs.route, "/api/search")));
    expect(search.details).toMatchObject({ query: { q: "[10 characters]" } });
    expect(search.userAgent).toBe("Mozilla/5.0 (test)");
  });

  it("notes the case for routes that do not name it", async () => {
    const doc = (await owner.agent.post(`/api/cases/${caseId}/documents`).send({ type: "OTHER", title: "Paper" })).body.document;
    await owner.agent.get(`/api/documents/${doc.id}`);
    const [view] = await rows(and(eq(accessLogs.entityId, doc.id), eq(accessLogs.action, "document.view")));
    expect(view.caseId).toBe(caseId);
  });
});

describe("sign-in events", () => {
  it("records sign-in, a failed sign-in against the account, and sign-out", async () => {
    const agent = request.agent(app.server).set("Origin", ORIGIN);
    expect((await agent.post("/api/auth/sign-in/email").send({ email: owner.email, password: "wrong-pass" })).status).toBe(401);
    expect((await agent.post("/api/auth/sign-in/email").send({ email: owner.email, password: "password123" })).status).toBe(200);
    await agent.post("/api/auth/sign-out").send({});
    const actions = (await rows(and(eq(accessLogs.advocateId, owner.id)))).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["account.create", "auth.sign_in_failed", "auth.sign_in", "auth.sign_out"]));

    await agent.post("/api/auth/sign-in/email").send({ email: `nobody-${stamp}@example.com`, password: "x".repeat(10) });
    const [unknown] = await rows(eq(accessLogs.action, "auth.sign_in_failed"));
    expect(unknown).toMatchObject({ advocateId: null, actor: "anonymous", details: { email: `nobody-${stamp}@example.com` } });
  });
});

describe("activity page", () => {
  it("shows the owner what a junior did on their case, and the junior only their own", async () => {
    await junior.agent.get(`/api/cases/${caseId}`);
    const mine = await owner.agent.get("/api/activity").query({ caseId });
    const juniorView = mine.body.entries.find(
      (e: { action: string; actor: { id: string } }) => e.action === "case.view" && e.actor.id === junior.id,
    );
    expect(juniorView).toMatchObject({ caseTitle: "गुप्त नाव", actor: { name: "Adv. au-junior", isMe: false } });

    const theirs = await junior.agent.get("/api/activity");
    expect(theirs.body.entries.every((e: { actor: { id: string } }) => e.actor.id === junior.id)).toBe(true);

    const signins = await owner.agent.get("/api/activity").query({ kind: "signin" });
    expect(signins.body.entries.length).toBeGreaterThan(0);
    expect(signins.body.entries.every((e: { action: string }) => e.action.startsWith("auth.") || e.action === "account.create")).toBe(true);
  });

  it("pages through older entries", async () => {
    const first = await owner.agent.get("/api/activity").query({ limit: 2 });
    expect(first.body.hasMore).toBe(true);
    const last = first.body.entries.at(-1);
    const next = await owner.agent.get("/api/activity").query({ limit: 2, before: `${last.at}|${last.id}` });
    expect(next.body.entries[0].id).not.toBe(first.body.entries[0].id);
    expect(new Date(next.body.entries[0].at).getTime()).toBeLessThanOrEqual(new Date(last.at).getTime());
  });
});

describe("staff", () => {
  it("records every staff request and lets staff read an account's activity without case names", async () => {
    const email = `owner-au-${stamp}@vakilmitra.in`;
    const secret = newTotpSecret();
    const [s] = await db
      .insert(staff)
      .values({ email, name: "Staff audit", role: "OWNER", passwordHash: hashPassword("staff-pass-123"), totpSecret: sealSecret(secret) })
      .returning();
    const agent = request.agent(app.server).set("Origin", ADMIN);
    await agent.post("/api/admin/login").send({ email, password: "staff-pass-123", code: totpAt(secret, currentStep()) });
    await agent.get("/api/admin/accounts").query({ q: "au-owner" });
    const act = await agent.get(`/api/admin/accounts/${owner.id}/activity`);
    expect(act.status).toBe(200);
    expect(act.body.entries.length).toBeGreaterThan(0);
    expect(JSON.stringify(act.body)).not.toContain("गुप्त नाव");

    const trail = (await db.select().from(staffAudit).where(eq(staffAudit.staffId, s.id))).map((r) => r.action);
    expect(trail).toEqual(expect.arrayContaining(["login", "account.list", "account.activity.view"]));
  });
});
