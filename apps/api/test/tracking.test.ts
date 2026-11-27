/** Case tracking on eCourts: turning it on and off, plan places, refresh, court changes on Today. */
import { caseTracking, courtUpdates, eq, subscriptions } from "@vakilmitra/db";
import { PLANS } from "@vakilmitra/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";
import { getServices } from "../src/services.js";

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CNR = "MHPU010012342024";

/** Jobs the API queued for the worker. */
const queued: { name: string; data: unknown }[] = [];
getServices().courtsQueue = {
  add: (async (name: string, data: unknown) => {
    queued.push({ name, data });
  }) as never,
};

async function signUp(tag: string) {
  const agent = request.agent(app.server).set("Origin", ORIGIN);
  const r = await agent.post("/api/auth/sign-up/email").send({ name: tag, email: `${tag}-${stamp}@example.com`, password: "password123" });
  expect(r.status).toBe(200);
  return { agent, id: r.body.user.id as string };
}

let owner: Awaited<ReturnType<typeof signUp>>;
let junior: Awaited<ReturnType<typeof signUp>>;
let stranger: Awaited<ReturnType<typeof signUp>>;
let caseId: string;

beforeAll(async () => {
  owner = await signUp("track-owner");
  junior = await signUp("track-junior");
  stranger = await signUp("track-stranger");
  const c = await owner.agent.post("/api/cases").send({ title: "Patil v. Jadhav", court: "Pune" });
  caseId = c.body.case.id;
  await owner.agent.post(`/api/cases/${caseId}/grants`).send({ email: `track-junior-${stamp}@example.com`, role: "VIEWER" });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("turning tracking on", () => {
  it("starts off, and says it is available", async () => {
    const r = await owner.agent.get(`/api/cases/${caseId}/tracking`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ available: true, tracking: null, updates: [] });
  });

  it("needs a real CNR", async () => {
    expect((await owner.agent.put(`/api/cases/${caseId}/tracking`).send({})).body.error).toBe("cnr_required");
    const bad = await owner.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: "RCS/123/2024" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid_input");
  });

  it("accepts a CNR as people copy it, saves it on the case and queues the first reading", async () => {
    queued.length = 0;
    const r = await owner.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: "mhpu01-001234-2024" });
    expect(r.status).toBe(200);
    expect(r.body.tracking).toMatchObject({ cnr: CNR, status: "PENDING", snapshot: null });
    expect(queued).toEqual([{ name: "check-case", data: { caseId } }]);
    expect((await owner.agent.get(`/api/cases/${caseId}`)).body.case.cnrNumber).toBe(CNR);
  });

  it("keeps the readings when the same CNR is saved again, and starts over for a new one", async () => {
    await db
      .update(caseTracking)
      .set({ status: "OK", snapshot: { cnr: CNR, disposed: false, nextHearingDate: "2026-12-04" } })
      .where(eq(caseTracking.caseId, caseId));
    queued.length = 0;
    const same = await owner.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: CNR });
    expect(same.body.tracking.status).toBe("OK");
    expect(queued).toEqual([]);
    const other = await owner.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: "MHPU010099992024" });
    expect(other.body.tracking).toMatchObject({ cnr: "MHPU010099992024", status: "PENDING", snapshot: null });
    expect(queued).toHaveLength(1);
    await owner.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: CNR });
  });

  it("uses the CNR already on the case when none is given", async () => {
    const c = await owner.agent.post("/api/cases").send({ title: "With CNR", cnrNumber: "MHPU020000012025" });
    const r = await owner.agent.put(`/api/cases/${c.body.case.id}/tracking`).send({});
    expect(r.body.tracking.cnr).toBe("MHPU020000012025");
  });

  it("is for the case's editors: a viewer can read it but not change it; others cannot see it", async () => {
    expect((await junior.agent.get(`/api/cases/${caseId}/tracking`)).status).toBe(200);
    expect((await junior.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: CNR })).status).toBe(403);
    expect((await junior.agent.delete(`/api/cases/${caseId}/tracking`)).status).toBe(403);
    expect((await stranger.agent.get(`/api/cases/${caseId}/tracking`)).status).toBe(404);
  });

  it("counts tracked cases against the plan, owner's account", async () => {
    const max = PLANS.TRIAL.limits.trackedCases;
    const billing = await owner.agent.get("/api/billing");
    const used = billing.body.billing.usage.trackedCases as number;
    expect(billing.body.billing.limits.trackedCases).toBe(max);
    for (let i = used; i < max; i++) {
      const c = await owner.agent.post("/api/cases").send({ title: `Filler ${i}` });
      const r = await owner.agent.put(`/api/cases/${c.body.case.id}/tracking`).send({ cnr: `MHPU03${String(i).padStart(6, "0")}2025` });
      expect(r.status).toBe(200);
    }
    const c = await owner.agent.post("/api/cases").send({ title: "One too many" });
    const r = await owner.agent.put(`/api/cases/${c.body.case.id}/tracking`).send({ cnr: "MHPU040000012025" });
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({ error: "plan_limit", details: { limit: "trackedCases", max } });
    // Changing the CNR of a case already tracked takes no new place.
    expect((await owner.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: CNR })).status).toBe(200);
  });
});

describe("refreshing", () => {
  it("queues a reading, but not again within 15 minutes of the last one", async () => {
    await db
      .update(caseTracking)
      .set({ lastCheckedAt: new Date(Date.now() - 20 * 60_000) })
      .where(eq(caseTracking.caseId, caseId));
    queued.length = 0;
    expect((await owner.agent.post(`/api/cases/${caseId}/tracking/refresh`)).status).toBe(202);
    expect(queued).toHaveLength(1);
    await db.update(caseTracking).set({ lastCheckedAt: new Date() }).where(eq(caseTracking.caseId, caseId));
    const r = await owner.agent.post(`/api/cases/${caseId}/tracking/refresh`);
    expect(r.status).toBe(429);
    expect(r.body.details.retryAfterSeconds).toBeGreaterThan(800);
  });

  it("answers 404 for a case not tracked", async () => {
    const c = await owner.agent.post("/api/cases").send({ title: "Untracked" });
    expect((await owner.agent.post(`/api/cases/${c.body.case.id}/tracking/refresh`)).status).toBe(404);
  });
});

describe("court changes", () => {
  it("lists recent changes on the advocate's own and shared cases, not others'", async () => {
    await db.insert(courtUpdates).values([
      { caseId, kind: "NEXT_DATE", detail: { kind: "NEXT_DATE", from: "2026-12-04", to: "2026-12-18", purpose: "Arguments" } },
      {
        caseId,
        kind: "NEW_ORDER",
        detail: { kind: "NEW_ORDER", date: "2026-12-04", title: "Order", url: null },
        createdAt: new Date(Date.now() - 20 * 86_400_000),
      },
    ]);
    const mine = await owner.agent.get("/api/court-updates");
    const ours = mine.body.updates.filter((u: { caseId: string }) => u.caseId === caseId);
    expect(ours).toHaveLength(1);
    expect(ours[0]).toMatchObject({ change: { kind: "NEXT_DATE", to: "2026-12-18" }, case: { id: caseId, title: "Patil v. Jadhav" } });
    expect(
      (await owner.agent.get("/api/court-updates?days=30")).body.updates.filter((u: { caseId: string }) => u.caseId === caseId),
    ).toHaveLength(2);
    expect((await junior.agent.get("/api/court-updates")).body.updates.some((u: { caseId: string }) => u.caseId === caseId)).toBe(true);
    expect((await stranger.agent.get("/api/court-updates")).body.updates).toEqual([]);
    expect((await owner.agent.get(`/api/cases/${caseId}/tracking`)).body.updates).toHaveLength(2);
  });
});

describe("turning tracking off", () => {
  it("stops tracking and frees the place; the case and its CNR stay", async () => {
    expect((await owner.agent.delete(`/api/cases/${caseId}/tracking`)).status).toBe(204);
    expect((await owner.agent.get(`/api/cases/${caseId}/tracking`)).body.tracking).toBeNull();
    expect((await owner.agent.get(`/api/cases/${caseId}`)).body.case.cnrNumber).toBe(CNR);
  });

  it("is not offered when no court-data service is set up", async () => {
    const saved = process.env.COURTS_PROVIDER;
    delete process.env.COURTS_PROVIDER;
    try {
      expect((await owner.agent.get(`/api/cases/${caseId}/tracking`)).body.available).toBe(false);
      const r = await owner.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: CNR });
      expect(r.status).toBe(503);
      expect(r.body.error).toBe("tracking_unavailable");
    } finally {
      process.env.COURTS_PROVIDER = saved;
    }
  });
});

describe("evening email setting", () => {
  it("is on by default and can be turned off", async () => {
    expect((await owner.agent.get("/api/me")).body.advocate.dailyDigest).toBe(true);
    expect((await owner.agent.patch("/api/me").send({ dailyDigest: false })).body.advocate.dailyDigest).toBe(false);
  });
});

describe("a read-only account", () => {
  it("cannot turn tracking on", async () => {
    await db
      .update(subscriptions)
      .set({ trialEndsAt: new Date(Date.now() - 60 * 86_400_000) })
      .where(eq(subscriptions.advocateId, stranger.id));
    const c = await db.query.subscriptions.findFirst({ where: eq(subscriptions.advocateId, stranger.id) });
    expect(c).toBeTruthy();
    const r = await stranger.agent.put(`/api/cases/${caseId}/tracking`).send({ cnr: CNR });
    expect(r.status).toBe(402);
    expect(r.body.error).toBe("read_only");
  });
});
