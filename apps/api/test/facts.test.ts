/** Land-file analyzer: extract facts from OCR, review them, and add the record to a property's chain. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { documents, eq, pages } from "@vakilmitra/db";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";

const app = await buildApp();
await app.ready();
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fixture = (name: string) => JSON.parse(readFileSync(join(import.meta.dirname, "fixtures", "extract", `${name}.json`), "utf8"));

async function signup(name: string) {
  const agent = request.agent(app.server).set("Origin", ORIGIN);
  const r = await agent.post("/api/auth/sign-up/email").send({ name, email: `${name}-${stamp}@example.com`, password: "password123" });
  expect(r.status).toBe(200);
  return agent;
}

/** A document with one page already read by OCR (words from the eval fixtures). */
async function readDocument(caseId: string, sample: string, type = "OTHER", status: "DONE" | "PROCESSING" = "DONE") {
  const s = fixture(sample);
  const [doc] = await db
    .insert(documents)
    .values({ caseId, type: type as never, ocrStatus: "DONE" })
    .returning();
  await db.insert(pages).values({
    documentId: doc.id,
    pageNo: 1,
    storageKey: `test/${doc.id}`,
    ocrStatus: status,
    ocrText: s.lines.join("\n"),
    ocrWords: s.words,
  });
  return doc.id;
}

let owner: ReturnType<typeof request.agent>;
let caseId: string;
let propertyId: string;

beforeAll(async () => {
  owner = await signup("facts-owner");
  caseId = (await owner.post("/api/cases").send({ title: "Gat 908" })).body.case.id;
  propertyId = (await owner.post(`/api/cases/${caseId}/properties`).send({ gatNo: "908" })).body.property.id;
});
afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("7/12 → facts → record snapshot", () => {
  let docId: string;
  type F = { id: string; field: string; value: string; reviewed: boolean; crop: unknown; confidence: number; originalValue: string | null };
  const facts = async () => (await owner.get(`/api/documents/${docId}/facts`)).body.extraction.facts as F[];

  it("identifies the record, re-types an 'Other' document, and reads its fields with source crops", async () => {
    docId = await readDocument(caseId, "satbara-00");
    const r = await owner.post(`/api/documents/${docId}/extract`);
    expect(r.status).toBe(200);
    expect(r.body.extraction.kind).toBe("SEVEN_TWELVE");
    const byField = Object.fromEntries((r.body.extraction.facts as F[]).map((f) => [f.field, f]));
    expect(byField.owner).toMatchObject({ value: "गणपत मोरे", reviewed: false });
    expect(byField.owner.crop).toMatchObject({ x: expect.any(Number), w: expect.any(Number) });
    expect(byField.owner.confidence).toBeGreaterThan(0.5);
    expect(byField.area.value).toBe("39000");
    expect((await db.query.documents.findFirst({ where: eq(documents.id, docId) }))?.type).toBe("SEVEN_TWELVE");
  });

  it("will not build an event from unreviewed facts", async () => {
    const r = await owner
      .post(`/api/cases/${caseId}/properties/${propertyId}/events/from-document`)
      .send({ documentId: docId, date: "2025-06-01" });
    expect(r.status).toBe(409);
    expect(r.body.code ?? r.body.error).toBeTruthy();
  });

  it("keeps the extractor's reading when the advocate corrects a value, and rejects malformed values", async () => {
    const area = (await facts()).find((f) => f.field === "area")!;
    expect((await owner.patch(`/api/facts/${area.id}`).send({ value: "3.9 हेक्टर" })).status).toBe(400);
    const r = await owner.patch(`/api/facts/${area.id}`).send({ value: "39001" });
    expect(r.body.fact).toMatchObject({ value: "39001", originalValue: "39000", reviewed: true });
  });

  it("re-reading keeps reviewed facts and replaces only unreviewed ones", async () => {
    await owner.post(`/api/documents/${docId}/extract`);
    const all = await facts();
    expect(all.filter((f) => f.field === "area").map((f) => f.value)).toEqual(["39001"]);
    expect(all.filter((f) => f.field === "owner")).toHaveLength(1);
  });

  it("after review, becomes a record snapshot; fills blank property details and runs the rules", async () => {
    for (const f of await facts()) if (!f.reviewed) await owner.patch(`/api/facts/${f.id}`).send({ reviewed: true });
    const url = `/api/cases/${caseId}/properties/${propertyId}/events/from-document`;
    expect((await owner.post(url).send({ documentId: docId })).status).toBe(400); // a 7/12 needs a date
    const r = await owner.post(url).send({ documentId: docId, date: "2025-06-01" });
    expect(r.status).toBe(201);
    expect(r.body.event).toMatchObject({
      kind: "RECORD_SNAPSHOT",
      owners: ["गणपत मोरे"],
      areaSqm: 39001,
      landClass: "Class-I",
      documentId: docId,
    });
    expect(r.body.event.factIds.length).toBeGreaterThan(5);
    expect(r.body.filled).toMatchObject({ village: "निमगाव", taluka: "शिरूर", district: "अहमदनगर" });
    expect(r.body.mismatches).toEqual([]);
    expect(r.body.flags.map((f: { rule: string }) => f.rule)).toContain("OTHER_RIGHTS_ENTRY");
    expect((await owner.post(url).send({ documentId: docId, date: "2025-06-01" })).status).toBe(409); // already added
    expect((await owner.get(`/api/documents/${docId}/facts`)).body.extraction.events).toHaveLength(1);
  });
});

describe("Ferfar and Index-II", () => {
  it("a sale ferfar becomes a mutation citing its deed; a differing gat no is reported, not overwritten", async () => {
    const docId = await readDocument(caseId, "ferfar-01", "FERFAR");
    const ex = (await owner.post(`/api/documents/${docId}/extract`)).body.extraction;
    for (const f of ex.facts) await owner.patch(`/api/facts/${f.id}`).send({ reviewed: true });
    const r = await owner.post(`/api/cases/${caseId}/properties/${propertyId}/events/from-document`).send({ documentId: docId });
    expect(r.status).toBe(201);
    expect(r.body.event).toMatchObject({
      kind: "MUTATION",
      subtype: "SALE",
      ferfarNo: "295",
      refDeedRegNo: "4972/2010",
      fromParties: ["विजय गायकवाड"],
      toParties: ["गणपत मोरे"],
    });
    expect(r.body.mismatches).toContainEqual({ field: "gat_no", property: "908", document: "911" });
  });

  it("the advocate can add a fact the extractor missed", async () => {
    const docId = await readDocument(caseId, "index2-00", "INDEX_II");
    await owner.post(`/api/documents/${docId}/extract`);
    const r = await owner.post(`/api/documents/${docId}/facts`).send({ field: "gat_no", value: "908" });
    expect(r.status).toBe(201);
    expect(r.body.fact).toMatchObject({ reviewed: true, crop: null, confidence: 1 });
    expect((await owner.post(`/api/documents/${docId}/facts`).send({ field: "gat_no", value: "1" })).status).toBe(409);
  });
});

describe("after review fixes", () => {
  it("freezes a document's facts once it is in a timeline", async () => {
    const docId = await readDocument(caseId, "satbara-03", "SEVEN_TWELVE");
    const ex = (await owner.post(`/api/documents/${docId}/extract`)).body.extraction;
    for (const f of ex.facts) await owner.patch(`/api/facts/${f.id}`).send({ reviewed: true });
    const p2 = (await owner.post(`/api/cases/${caseId}/properties`).send({})).body.property.id;
    expect(
      (await owner.post(`/api/cases/${caseId}/properties/${p2}/events/from-document`).send({ documentId: docId, date: "2024-01-01" }))
        .status,
    ).toBe(201);
    expect((await owner.patch(`/api/facts/${ex.facts[0].id}`).send({ value: "x" })).status).toBe(409);
    expect((await owner.delete(`/api/facts/${ex.facts[0].id}`)).status).toBe(409);
    expect((await owner.post(`/api/documents/${docId}/extract`)).status).toBe(409);
    expect((await owner.post(`/api/documents/${docId}/facts`).send({ field: "hissa_no", value: "1" })).status).toBe(409);
  });

  it("creates a new property only together with the event, so a refused request leaves nothing behind", async () => {
    const docId = await readDocument(caseId, "satbara-04", "SEVEN_TWELVE");
    const ex = (await owner.post(`/api/documents/${docId}/extract`)).body.extraction;
    const count = async () => (await owner.get(`/api/cases/${caseId}`)).body.case.properties.length;
    const before = await count();
    const url = `/api/cases/${caseId}/properties/new/events/from-document`;
    expect((await owner.post(url).send({ documentId: docId, date: "2024-01-01" })).status).toBe(409); // not reviewed yet
    expect(await count()).toBe(before);
    for (const f of ex.facts) await owner.patch(`/api/facts/${f.id}`).send({ reviewed: true });
    const r = await owner.post(url).send({ documentId: docId, date: "2024-01-01" });
    expect(r.status).toBe(201);
    expect(await count()).toBe(before + 1);
    const prop = (await owner.get(`/api/cases/${caseId}/properties/${r.body.propertyId}`)).body.property;
    expect(prop.village).toBeTruthy();
    expect(prop.events).toHaveLength(1);
  });

  it("reads details only from land records or untyped documents", async () => {
    const docId = await readDocument(caseId, "satbara-05", "SALE_DEED");
    expect((await owner.post(`/api/documents/${docId}/extract`)).status).toBe(409);
  });

  it("an Index-II deed keeps its own type (a mortgage is not recorded as a sale)", async () => {
    const docId = await readDocument(caseId, "index2-02", "INDEX_II"); // a mortgage deed in the eval set
    const ex = (await owner.post(`/api/documents/${docId}/extract`)).body.extraction;
    expect(ex.facts.find((f: { field: string }) => f.field === "deed_type")?.value).toBe("MORTGAGE");
    for (const f of ex.facts) await owner.patch(`/api/facts/${f.id}`).send({ reviewed: true });
    const r = await owner.post(`/api/cases/${caseId}/properties/new/events/from-document`).send({ documentId: docId });
    expect(r.body.event).toMatchObject({ kind: "DEED", subtype: "MORTGAGE" });
  });

  it("rejects dates that do not exist", async () => {
    const docId = await readDocument(caseId, "index2-03", "INDEX_II");
    const ex = (await owner.post(`/api/documents/${docId}/extract`)).body.extraction;
    const date = ex.facts.find((f: { field: string }) => f.field === "date");
    expect((await owner.patch(`/api/facts/${date.id}`).send({ value: "2019-02-31" })).status).toBe(400);
  });
});

describe("guards", () => {
  it("waits for OCR to finish, and says so when the record cannot be identified", async () => {
    const pending = await readDocument(caseId, "satbara-01", "OTHER", "PROCESSING");
    expect((await owner.post(`/api/documents/${pending}/extract`)).status).toBe(409);
    const [doc] = await db.insert(documents).values({ caseId, type: "OTHER" }).returning();
    await db.insert(pages).values({ documentId: doc.id, pageNo: 1, storageKey: "x", ocrStatus: "DONE", ocrText: "नोटीस", ocrWords: [] });
    const r = await owner.post(`/api/documents/${doc.id}/extract`);
    expect(r.body.extraction).toMatchObject({ kind: null, facts: [] });
  });

  it("another advocate cannot read or change the facts", async () => {
    const stranger = await signup("facts-stranger");
    const docId = await readDocument(caseId, "satbara-02", "SEVEN_TWELVE");
    const ex = (await owner.post(`/api/documents/${docId}/extract`)).body.extraction;
    expect([403, 404]).toContain((await stranger.get(`/api/documents/${docId}/facts`)).status);
    expect([403, 404]).toContain((await stranger.patch(`/api/facts/${ex.facts[0].id}`).send({ reviewed: true })).status);
    expect([403, 404]).toContain((await stranger.post(`/api/documents/${docId}/extract`)).status);
  });
});
