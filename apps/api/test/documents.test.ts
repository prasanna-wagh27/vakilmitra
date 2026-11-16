import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accessLogs, and, count, eq, pages } from "@vakilmitra/db";
import { FsBlobStore, keys, parseMasterKeys, SecureStorage } from "@vakilmitra/storage";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { db, pool } from "../src/db.js";
import { setServices } from "../src/services.js";

const blobDir = await mkdtemp(join(tmpdir(), "vm-api-blobs-"));
const queued: string[] = [];
setServices({
  storage: new SecureStorage(new FsBlobStore(blobDir), parseMasterKeys(`k1:${randomBytes(32).toString("base64")}`)),
  ocrQueue: { add: async (_name: string, data: { pageId: string }) => queued.push(data.pageId) } as never,
});

const app = await buildApp();
await app.ready();
const server = app.server;
const ORIGIN = "http://localhost:5173";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function signup(email: string) {
  const agent = request.agent(server).set("Origin", ORIGIN);
  const r = await agent.post("/api/auth/sign-up/email").send({ name: "Adv. Doc", email, password: "password123" });
  expect(r.status).toBe(200);
  return agent;
}

/** A small JPEG "phone photo" carrying GPS EXIF, to check it gets stripped. */
async function photo(text = "page") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#f4f1e8"/><text x="80" y="200" font-size="60">${text}</text></svg>`;
  return sharp(Buffer.from(svg))
    .jpeg()
    .withExif({ IFD0: { Make: "PhoneCo" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "18/1 31/1 0/1" } })
    .toBuffer();
}

let owner: ReturnType<typeof request.agent>;
let junior: ReturnType<typeof request.agent>;
let ownerId: string;
let caseId: string;
let docId: string;
let pageId: string;

beforeAll(async () => {
  owner = await signup(`doc-owner-${stamp}@example.com`);
  junior = await signup(`doc-junior-${stamp}@example.com`);
  ownerId = (await owner.get("/api/me")).body.advocate.id;
  caseId = (await owner.post("/api/cases").send({ title: "Title search — Gat 112" })).body.case.id;
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe("documents and page upload", () => {
  it("creates a document and uploads a page, encrypted at rest, with OCR queued", async () => {
    const d = await owner.post(`/api/cases/${caseId}/documents`).send({ type: "SEVEN_TWELVE", year: 2025 });
    expect(d.status).toBe(201);
    docId = d.body.document.id;

    const up = await owner
      .post(`/api/documents/${docId}/pages?pageNo=1`)
      .attach("page", await photo(), { filename: "p1.jpg", contentType: "image/jpeg" });
    expect(up.status).toBe(201);
    pageId = up.body.page.id;
    expect(up.body.page).toMatchObject({ pageNo: 1, ocrStatus: "PENDING", width: 1200, height: 1600 });
    expect(queued).toContain(pageId);

    const stored = await readFile(join(blobDir, keys.page(ownerId, caseId, docId, pageId)));
    expect(stored.subarray(0, 4).toString()).toBe("VMEN"); // our envelope, not a JPEG
    expect(stored.includes(Buffer.from([0xff, 0xd8, 0xff]))).toBe(false);

    const doc = await owner.get(`/api/documents/${docId}`);
    expect(doc.body.document).toMatchObject({ ocrStatus: "PROCESSING", pageCount: 1 });
  });

  it("serves the decrypted image without EXIF/GPS, uncached, and logs the view", async () => {
    const r = await owner.get(`/api/documents/${docId}/pages/${pageId}/image`).buffer(true);
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toBe("image/jpeg");
    expect(r.headers["cache-control"]).toBe("private, no-store");
    const meta = await sharp(r.body).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBe(1200);
    const [{ n }] = await db
      .select({ n: count() })
      .from(accessLogs)
      .where(and(eq(accessLogs.entityId, pageId), eq(accessLogs.action, "page.view")));
    expect(n).toBe(1);
  });

  it("replaces a page when the same page number is re-sent", async () => {
    queued.length = 0;
    const again = await owner
      .post(`/api/documents/${docId}/pages?pageNo=1`)
      .attach("page", await photo("retake"), { filename: "p1.jpg", contentType: "image/jpeg" });
    expect(again.status).toBe(200);
    expect(again.body.page.id).toBe(pageId);
    expect(queued).toEqual([pageId]);
    expect((await owner.get(`/api/documents/${docId}`)).body.document.pageCount).toBe(1);
  });

  it("rejects bad uploads", async () => {
    const url = `/api/documents/${docId}/pages?pageNo=2`;
    expect((await owner.post(url).attach("page", Buffer.from("hello"), { filename: "a.txt", contentType: "text/plain" })).status).toBe(415);
    expect(
      (await owner.post(url).attach("page", Buffer.from("not really a jpeg"), { filename: "a.jpg", contentType: "image/jpeg" })).status,
    ).toBe(422);
    const huge = await owner
      .post(url)
      .attach("page", Buffer.alloc(16 * 1024 * 1024, 1), { filename: "big.jpg", contentType: "image/jpeg" });
    expect(huge.status).toBe(413);
    expect((await owner.post(`/api/documents/${docId}/pages`).attach("page", await photo(), "p.jpg")).status).toBe(400); // no pageNo
  });

  it("keeps other advocates out and lets a viewer read but not upload", async () => {
    expect((await junior.get(`/api/documents/${docId}`)).status).toBe(404);
    expect((await junior.get(`/api/documents/${docId}/pages/${pageId}/image`)).status).toBe(404);
    expect((await junior.get(`/api/cases/${caseId}/documents`)).status).toBe(404);

    await owner.post(`/api/cases/${caseId}/grants`).send({ email: `doc-junior-${stamp}@example.com`, role: "VIEWER" });
    expect((await junior.get(`/api/documents/${docId}`)).status).toBe(200);
    const up = await junior
      .post(`/api/documents/${docId}/pages?pageNo=3`)
      .attach("page", await photo(), { filename: "p.jpg", contentType: "image/jpeg" });
    expect(up.status).toBe(403);
  });

  it("re-queues OCR on request", async () => {
    queued.length = 0;
    const r = await owner.post(`/api/documents/${docId}/pages/${pageId}/ocr`);
    expect(r.status).toBe(200);
    expect(queued).toEqual([pageId]);
  });
});

describe("search over OCR text", () => {
  it("finds Marathi text with a snippet, only in visible cases", async () => {
    await db
      .update(pages)
      .set({ ocrStatus: "DONE", ocrText: "गाव नमुना सात\nगाव : माळेगाव तालुका : बारामती\nभोगवटादाराचे नाव : सुरेश जाधव" })
      .where(eq(pages.id, pageId));
    const r = await owner.get("/api/search").query({ q: "सुरेश जाधव" });
    expect(r.status).toBe(200);
    expect(r.body.hits).toHaveLength(1);
    const hit = r.body.hits[0];
    expect(hit).toMatchObject({ pageId, documentId: docId, caseId, documentType: "SEVEN_TWELVE" });
    expect(hit.snippet.slice(hit.matchStart, hit.matchEnd)).toBe("सुरेश जाधव");

    expect((await owner.get("/api/search").query({ q: "जाधव", caseId: "other" })).body.hits).toHaveLength(0);
    expect((await owner.get("/api/search").query({ q: "x" })).status).toBe(400); // too short
    expect((await owner.get("/api/search").query({ q: "100%" })).body.hits).toHaveLength(0); // wildcards escaped

    const stranger = await signup(`doc-stranger-${stamp}@example.com`);
    expect((await stranger.get("/api/search").query({ q: "जाधव" })).body.hits).toHaveLength(0);
  });
});

describe("deleting removes files too", () => {
  it("deletes a page, a document, and a case's files", async () => {
    const d2 = (await owner.post(`/api/cases/${caseId}/documents`).send({ type: "FERFAR" })).body.document.id;
    const p = (
      await owner
        .post(`/api/documents/${d2}/pages?pageNo=1`)
        .attach("page", await photo(), { filename: "p.jpg", contentType: "image/jpeg" })
    ).body.page.id;
    const p2 = (
      await owner
        .post(`/api/documents/${d2}/pages?pageNo=2`)
        .attach("page", await photo(), { filename: "p.jpg", contentType: "image/jpeg" })
    ).body.page.id;

    expect((await owner.delete(`/api/documents/${d2}/pages/${p}`)).status).toBe(204);
    await expect(readFile(join(blobDir, keys.page(ownerId, caseId, d2, p)))).rejects.toThrow();
    await readFile(join(blobDir, keys.page(ownerId, caseId, d2, p2))); // other page untouched

    expect((await owner.delete(`/api/documents/${d2}`)).status).toBe(204);
    await expect(readFile(join(blobDir, keys.page(ownerId, caseId, d2, p2)))).rejects.toThrow();

    expect((await owner.delete(`/api/cases/${caseId}`)).status).toBe(204);
    await expect(readdir(join(blobDir, keys.case(ownerId, caseId)))).rejects.toThrow();
  });

  it("deleting the account removes every file it owns", async () => {
    const c = (await owner.post("/api/cases").send({ title: "Another" })).body.case.id;
    const d = (await owner.post(`/api/cases/${c}/documents`).send({ type: "OTHER" })).body.document.id;
    await owner.post(`/api/documents/${d}/pages?pageNo=1`).attach("page", await photo(), { filename: "p.jpg", contentType: "image/jpeg" });
    expect((await readdir(join(blobDir, keys.advocate(ownerId)))).length).toBeGreaterThan(0);
    expect((await owner.delete("/api/me").send({ password: "password123" })).status).toBe(204);
    await expect(readdir(join(blobDir, keys.advocate(ownerId)))).rejects.toThrow();
  });
});
