/** Regression tests for the full-codebase review (fix/full-review). */
import { accessLogs, and, count, eq, subscriptions } from "@vakilmitra/db";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";
import { makeSnippet } from "../src/routes/documents.js";

const app = await buildApp();
await app.ready();
const server = app.server;
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signup(name: string) {
  const agent = request.agent(server).set("Origin", ORIGIN);
  const email = `${name}-${stamp}@example.com`;
  const r = await agent.post("/api/auth/sign-up/email").send({ name: `Adv. ${name}`, email, password: "password123" });
  expect(r.status).toBe(200);
  return { agent, email };
}

let owner: ReturnType<typeof request.agent>;
let junior: ReturnType<typeof request.agent>;
let juniorEmail: string;
let ownerClientId: string;
let caseId: string;

beforeAll(async () => {
  ({ agent: owner } = await signup("rv-owner"));
  // Chamber plan: these tests share one case with several juniors.
  const ownerId = (await owner.get("/api/me")).body.advocate.id;
  await db
    .update(subscriptions)
    .set({ plan: "CHAMBER", paidUntil: new Date(Date.now() + 86_400_000) })
    .where(eq(subscriptions.advocateId, ownerId));
  ({ agent: junior, email: juniorEmail } = await signup("rv-junior"));
  ownerClientId = (await owner.post("/api/clients").send({ name: "मालक पक्षकार" })).body.client.id;
  caseId = (await owner.post("/api/cases").send({ title: "Review case", clientId: ownerClientId })).body.case.id;
  await owner.post(`/api/cases/${caseId}/grants`).send({ email: juniorEmail, role: "EDITOR" });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("partial updates keep fields that were not sent", () => {
  it("editing an event's notes keeps its parties and owners", async () => {
    const p = (await owner.post(`/api/cases/${caseId}/properties`).send({ gatNo: "7" })).body.property.id;
    const ev = (
      await owner
        .post(`/api/cases/${caseId}/properties/${p}/events`)
        .send({ kind: "MUTATION", subtype: "SALE", date: "2001-01-01", fromParties: ["अ"], toParties: ["ब"], section155: true })
    ).body.event;
    const r = await owner.patch(`/api/cases/${caseId}/properties/${p}/events/${ev.id}`).send({ notes: "checked" });
    expect(r.status).toBe(200);
    expect(r.body.event).toMatchObject({ notes: "checked", fromParties: ["अ"], toParties: ["ब"], section155: true });
  });

  it("editing a document's title keeps its type", async () => {
    const d = (await owner.post(`/api/cases/${caseId}/documents`).send({ type: "SEVEN_TWELVE" })).body.document;
    const r = await owner.patch(`/api/documents/${d.id}`).send({ title: "7/12 2019" });
    expect(r.body.document).toMatchObject({ title: "7/12 2019", type: "SEVEN_TWELVE" });
  });
});

describe("account deletion cannot bypass the password", () => {
  it("blocks dot-segment and trailing-slash variants of delete-user", async () => {
    for (const path of [
      "/api/auth/delete-user",
      "/api/auth/x/../delete-user",
      "/api/auth/delete-user/",
      "/api/auth/DELETE-USER",
      "/api/auth/delete-user/callback?token=x",
    ]) {
      const r = await owner.post(path).send({});
      expect(r.status, path).toBe(404);
    }
    expect((await owner.get("/api/me")).status).toBe(200);
  });
});

describe("shared cases: client links and billing stay with the owner", () => {
  it("an editor can save edits without touching the client, but cannot relink it", async () => {
    const ok = await junior.patch(`/api/cases/${caseId}`).send({ notes: "हजर", clientId: ownerClientId });
    expect(ok.status).toBe(200);
    const juniorClient = (await junior.post("/api/clients").send({ name: "ज्युनियर पक्षकार" })).body.client.id;
    const relink = await junior.patch(`/api/cases/${caseId}`).send({ clientId: juniorClient });
    expect(relink.status).toBe(403);
  });

  it("only the owner can bill on a case, and juniors never see the case's fees", async () => {
    const juniorClient = (await junior.post("/api/clients").send({ name: "दुसरा" })).body.client.id;
    const r = await junior.post("/api/fees/agreements").send({ clientId: juniorClient, caseId, description: "x", totalRupees: 100 });
    expect(r.status).toBe(403);
    await owner.post("/api/fees/agreements").send({ clientId: ownerClientId, caseId, description: "दावा फी", totalRupees: 5000 });
    expect((await owner.get(`/api/cases/${caseId}`)).body.case.feeAgreements).toHaveLength(1);
    expect((await junior.get(`/api/cases/${caseId}`)).body.case.feeAgreements).toHaveLength(0);
  });

  it("deleting a case keeps the client's billing history", async () => {
    const c = (await owner.post("/api/cases").send({ title: "To delete", clientId: ownerClientId })).body.case.id;
    await owner.post("/api/fees/agreements").send({ clientId: ownerClientId, caseId: c, description: "जुनी फी", totalRupees: 700 });
    expect((await owner.delete(`/api/cases/${c}`)).status).toBe(204);
    const client = (await owner.get(`/api/clients/${ownerClientId}`)).body.client;
    expect(
      client.feeAgreements.some((a: { description: string; caseId: string | null }) => a.description === "जुनी फी" && a.caseId === null),
    ).toBe(true);
  });

  it("logs when a junior's access is removed", async () => {
    const other = await signup("rv-other");
    const g = (await owner.post(`/api/cases/${caseId}/grants`).send({ email: other.email, role: "VIEWER" })).body.grant.id;
    expect((await owner.delete(`/api/cases/${caseId}/grants/${g}`)).status).toBe(204);
    const [{ n }] = await db
      .select({ n: count() })
      .from(accessLogs)
      .where(and(eq(accessLogs.entityId, caseId), eq(accessLogs.action, "case.unshare")));
    expect(n).toBe(1);
  });
});

describe("red flags", () => {
  it("resolving one other-rights entry does not hide a different entry on the same 7/12", async () => {
    const p = (await owner.post(`/api/cases/${caseId}/properties`).send({ gatNo: "9" })).body.property.id;
    const base = `/api/cases/${caseId}/properties/${p}`;
    const snap = (
      await owner
        .post(`${base}/events`)
        .send({ kind: "RECORD_SNAPSHOT", date: "1990-01-01", owners: ["क"], otherRights: ["वारस: सौ. सुमन"] })
    ).body.event;
    const first = (await owner.post(`${base}/check`)).body.flags.find((f: { rule: string }) => f.rule === "OTHER_RIGHTS_ENTRY");
    await owner.patch(`/api/cases/${caseId}/flags/${first.id}`).send({ resolved: true, resolution: "वारस नोंद तपासली" });
    await owner.patch(`${base}/events/${snap.id}`).send({ otherRights: ["वारस: सौ. सुमन", "बँक ऑफ महाराष्ट्र बोजा"] });
    const flags = (await owner.post(`${base}/check`)).body.flags.filter((f: { rule: string }) => f.rule === "OTHER_RIGHTS_ENTRY");
    expect(flags.filter((f: { resolved: boolean }) => f.resolved)).toHaveLength(1);
    expect(flags.filter((f: { resolved: boolean; severity: string }) => !f.resolved && f.severity === "HIGH")).toHaveLength(1);
  });
});

describe("daily board", () => {
  it("lists an active case that has never had a hearing under 'next date not recorded'", async () => {
    const fresh = (await owner.post("/api/cases").send({ title: "नवीन दावा" })).body.case.id;
    const board = await owner.get("/api/diary/board");
    expect(board.body.needsNextDate.map((c: { id: string }) => c.id)).toContain(fresh);
  });
});

describe("access log", () => {
  it("counts repeat views within a few minutes once (screens refresh while OCR runs), but logs every change", async () => {
    const c = (await owner.post("/api/cases").send({ title: "Viewed often" })).body.case.id;
    for (let i = 0; i < 3; i++) expect((await owner.get(`/api/cases/${c}`)).status).toBe(200);
    const n = async (action: string) =>
      (
        await db
          .select({ n: count() })
          .from(accessLogs)
          .where(and(eq(accessLogs.entityId, c), eq(accessLogs.action, action)))
      )[0].n;
    expect(await n("case.view")).toBe(1);
    await owner.delete(`/api/cases/${c}`);
    expect(await n("case.delete")).toBe(1);
  });
});

describe("search snippets", () => {
  it("highlights the match, and highlights nothing rather than the wrong text", () => {
    const hit = makeSnippet("गाव माळेगाव भोगवटादार सुरेश जाधव", "सुरेश");
    expect(hit.snippet.slice(hit.matchStart, hit.matchEnd)).toBe("सुरेश");
    const miss = makeSnippet("abc def", "zzz");
    expect(miss.matchStart).toBe(miss.matchEnd);
    // Decomposed query (क + nukta) against composed-form text: highlight the right characters.
    const nfd = makeSnippet("कलम क़ानून १५५", "\u0915\u093c\u093e\u0928\u0942\u0928");
    expect(nfd.snippet.slice(nfd.matchStart, nfd.matchEnd).normalize("NFC")).toBe("क़ानून".normalize("NFC"));
  });
});
