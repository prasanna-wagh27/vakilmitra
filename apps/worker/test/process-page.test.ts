import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accessLogs, advocates, and, cases, count, createDb, documents, eq, pages, runMigrations } from "@vakilmitra/db";
import { type OcrEngine, type ReadPolicy, TesseractEngine } from "@vakilmitra/ocr";
import { FsBlobStore, keys, parseMasterKeys, SecureStorage } from "@vakilmitra/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { markFailed, processPage } from "../src/process-page.js";

const url = process.env.DATABASE_URL!;
await runMigrations(url);
const { db, pool } = createDb(url);
const storage = new SecureStorage(
  new FsBlobStore(await mkdtemp(join(tmpdir(), "vm-worker-"))),
  parseMasterKeys(`k1:${randomBytes(32).toString("base64")}`),
);
const engine = new TesseractEngine();
const cloudCalls: number[] = [];
const fakeCloud: OcrEngine = {
  name: "fake-cloud",
  external: true,
  async recognize() {
    cloudCalls.push(1);
    return { engine: "fake-cloud", text: "गाव : माळेगाव (cloud)", confidence: 0.9, words: [], width: 1, height: 1 };
  },
  async close() {},
};
const localOnly: ReadPolicy = { local: engine, cloud: null, mode: "fallback", below: 0.85 };
const cloudAlways: ReadPolicy = { local: engine, cloud: fakeCloud, mode: "always", below: 0.85 };
const sentLogs = async (pageId: string) =>
  (
    await db
      .select({ n: count() })
      .from(accessLogs)
      .where(and(eq(accessLogs.entityId, pageId), eq(accessLogs.action, "page.sent_to_ocr:fake-cloud")))
  )[0].n;
const require = createRequire(import.meta.url);
const fixture = await readFile(join(require.resolve("@vakilmitra/ocr/package.json"), "..", "test/fixtures/satbara.png"));

let advocateId: string;
let caseId: string;
let documentId: string;

async function addPage(pageNo: number, body?: Buffer) {
  const id = randomUUID();
  const storageKey = keys.page(advocateId, caseId, documentId, id);
  if (body) await storage.put(storageKey, body);
  await db.insert(pages).values({ id, documentId, pageNo, storageKey });
  return id;
}

beforeAll(async () => {
  advocateId = randomUUID();
  await db.insert(advocates).values({ id: advocateId, name: "Worker Test", email: `worker-${advocateId}@example.com` });
  [{ id: caseId }] = await db.insert(cases).values({ advocateId, title: "OCR test" }).returning({ id: cases.id });
  [{ id: documentId }] = await db.insert(documents).values({ caseId, type: "SEVEN_TWELVE" }).returning({ id: documents.id });
});

afterAll(async () => {
  await db.delete(advocates).where(eq(advocates.id, advocateId));
  await engine.close();
  await pool.end();
});

describe("processPage", () => {
  it("decrypts, reads Marathi and stores text + word boxes; document rolls up to DONE", async () => {
    const pageId = await addPage(1, fixture);
    expect(await processPage({ db, storage, policy: localOnly }, pageId)).toBe("done");
    const p = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
    expect(p?.ocrStatus).toBe("DONE");
    expect(p?.ocrText).toContain("माळेगाव");
    expect(p?.ocrEngine).toBe("tesseract-mar+eng");
    expect(p?.ocrWords?.length).toBeGreaterThan(20);
    expect(p?.ocrRoute).toBe("local");
    const d = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    expect(d?.ocrStatus).toBe("DONE");
  });

  it("never sends a page to a cloud engine without the advocate's consent", async () => {
    const pageId = await addPage(10, fixture);
    await processPage({ db, storage, policy: cloudAlways }, pageId);
    const p = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
    expect(p?.ocrRoute).toBe("local:no-consent");
    expect(p?.ocrEngine).toBe("tesseract-mar+eng");
    expect(cloudCalls).toHaveLength(0);
    expect(await sentLogs(pageId)).toBe(0);
  });

  it("uses the cloud engine once consent is on, and logs the send", async () => {
    await db.update(advocates).set({ cloudOcrConsent: true }).where(eq(advocates.id, advocateId));
    const pageId = await addPage(11, fixture);
    await processPage({ db, storage, policy: cloudAlways }, pageId);
    const p = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
    expect(p).toMatchObject({ ocrRoute: "cloud", ocrEngine: "fake-cloud", ocrText: "गाव : माळेगाव (cloud)" });
    expect(cloudCalls).toHaveLength(1);
    expect(await sentLogs(pageId)).toBe(1);
    await db.update(advocates).set({ cloudOcrConsent: false }).where(eq(advocates.id, advocateId));
  });

  it("returns missing for a page deleted before its job ran", async () => {
    expect(await processPage({ db, storage, policy: localOnly }, randomUUID())).toBe("missing");
  });

  it("marks a page FAILED after the last retry and the document follows", async () => {
    const pageId = await addPage(2); // no blob stored: storage.get throws
    await expect(processPage({ db, storage, policy: localOnly }, pageId)).rejects.toThrow();
    let d = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    expect(d?.ocrStatus).toBe("PROCESSING");
    await markFailed(db, pageId, new Error("blob missing"));
    const p = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
    expect(p?.ocrStatus).toBe("FAILED");
    expect(p?.ocrError).toBe("blob missing");
    d = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    expect(d?.ocrStatus).toBe("FAILED");
  });
});
