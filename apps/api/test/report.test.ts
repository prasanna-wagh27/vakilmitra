/** Title search report: built from the chain, opinion saved, signed off as a snapshot. */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db.js";

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signup(name: string) {
  const agent = request.agent(app.server).set("Origin", ORIGIN);
  const r = await agent.post("/api/auth/sign-up/email").send({ name, email: `${name}-${stamp}@example.com`, password: "password123" });
  expect(r.status).toBe(200);
  return agent;
}

let owner: request.Agent;
let editor: request.Agent;
let caseId: string;
let base: string;

beforeAll(async () => {
  owner = await signup("tsr-owner");
  editor = await signup("tsr-editor");
  caseId = (await owner.post("/api/cases").send({ title: "Title search", kind: "LAND_PROPERTY" })).body.case.id;
  await owner.post(`/api/cases/${caseId}/grants`).send({ email: `tsr-editor-${stamp}@example.com`, role: "EDITOR" });
  const p = await owner.post(`/api/cases/${caseId}/properties`).send({ gatNo: "112", village: "माळेगाव" });
  base = `/api/cases/${caseId}/properties/${p.body.property.id}`;
  const events = [
    { kind: "RECORD_SNAPSHOT", date: "1990-01-01", owners: ["रामचंद्र पाटील"], areaSqm: 8100 },
    { kind: "DEED", subtype: "MORTGAGE", date: "2005-06-01", deedRegNo: "77/2005", fromParties: ["रामचंद्र पाटील"], toParties: ["जिल्हा बँक"] },
    { kind: "DEED", subtype: "sale", date: "2010-03-10", deedRegNo: "1234/2010", fromParties: ["रामचंद्र पाटील"], toParties: ["सुरेश जाधव"] },
    { kind: "RECORD_SNAPSHOT", date: "2024-01-01", owners: ["सुरेश जाधव"], areaSqm: 8100, otherRights: ["बोजा: सोसायटी कर्ज"] },
  ];
  for (const e of events) expect((await owner.post(`${base}/events`).send(e)).status).toBe(201);
  await owner.post(`${base}/check`);
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("title search report", () => {
  it("builds the report from the chain", async () => {
    const r = await owner.get(`${base}/report`);
    expect(r.status).toBe(200);
    expect(r.body.report.owners.names).toEqual(["सुरेश जाधव"]);
    expect(r.body.report.chain).toHaveLength(4);
    expect(r.body.report.period.complete).toBe(true);
    const sources = r.body.report.encumbrances.map((e: { source: string }) => e.source).sort();
    expect(sources).toEqual(["mortgage", "other_right"]);
    expect(r.body.draft).toBeNull();
    expect(r.body.caseTitle).toBe("Title search");
  });

  it("needs an opinion, and only the owner can sign off", async () => {
    expect((await owner.post(`${base}/report/approve`)).status).toBe(400);
    const s = await editor.put(`${base}/report`).send({ opinion: "Title is clear subject to the bank charge.", language: "en" });
    expect(s.status).toBe(200);
    expect(s.body.draft.status).toBe("DRAFT");
    expect((await editor.post(`${base}/report/approve`)).status).toBe(403);
    const a = await owner.post(`${base}/report/approve`);
    expect(a.status).toBe(200);
    expect(a.body.draft.status).toBe("APPROVED");
    expect(a.body.draft.approved.owners.names).toEqual(["सुरेश जाधव"]);
  });

  it("keeps the signed snapshot and says when the chain has changed", async () => {
    expect((await owner.get(`${base}/report`)).body.changedSinceApproval).toBe(false);
    await owner.post(`${base}/events`).send({
      kind: "DEED",
      subtype: "RELEASE",
      date: "2024-06-01",
      deedRegNo: "9/2024",
      fromParties: ["जिल्हा बँक"],
      toParties: ["सुरेश जाधव"],
    });
    const r = await owner.get(`${base}/report`);
    expect(r.body.changedSinceApproval).toBe(true);
    expect(r.body.draft.approved.chain).toHaveLength(4);
    expect(r.body.report.chain).toHaveLength(5);
  });

  it("goes back to draft when the opinion is edited", async () => {
    const s = await owner.put(`${base}/report`).send({ opinion: "Revised.", language: "mr" });
    expect(s.body.draft.status).toBe("DRAFT");
    expect(s.body.draft.approved).toBeNull();
  });

  it("is hidden from other advocates", async () => {
    const stranger = await signup("tsr-stranger");
    expect((await stranger.get(`${base}/report`)).status).toBe(404);
  });
});
