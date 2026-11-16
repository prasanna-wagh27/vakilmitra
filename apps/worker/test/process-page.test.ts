import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { advocates, cases, createDb, documents, eq, pages, runMigrations } from "@vakilmitra/db";
import { TesseractEngine } from "@vakilmitra/ocr";
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
    expect(await processPage({ db, storage, engine }, pageId)).toBe("done");
    const p = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
    expect(p?.ocrStatus).toBe("DONE");
    expect(p?.ocrText).toContain("माळेगाव");
    expect(p?.ocrEngine).toBe("tesseract-mar+eng");
    expect(p?.ocrWords?.length).toBeGreaterThan(20);
    const d = await db.query.documents.findFirst({ where: eq(documents.id, documentId) });
    expect(d?.ocrStatus).toBe("DONE");
  });

  it("returns missing for a page deleted before its job ran", async () => {
    expect(await processPage({ db, storage, engine }, randomUUID())).toBe("missing");
  });

  it("marks a page FAILED after the last retry and the document follows", async () => {
    const pageId = await addPage(2); // no blob stored: storage.get throws
    await expect(processPage({ db, storage, engine }, pageId)).rejects.toThrow();
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
