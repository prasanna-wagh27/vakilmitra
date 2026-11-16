import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { accessLogs, advocates, and, cases, count, createDb, documents, eq, pages, runMigrations, sql } from "@vakilmitra/db";
import { type OcrEngine, type ReadPolicy, TesseractEngine } from "@vakilmitra/ocr";
import { FsBlobStore, keys, parseMasterKeys, SecureStorage } from "@vakilmitra/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { markCloudFailed, markFailed, processCloudPage, processPage } from "../src/process-page.js";

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

  describe("with consent: local first, then a separate cloud job", () => {
    const queued: [string, number][] = [];
    const deps = { db, storage, policy: cloudAlways, enqueueCloud: async (id: string, v: number) => void queued.push([id, v]) };
    const setConsent = (on: boolean) => db.update(advocates).set({ cloudOcrConsent: on }).where(eq(advocates.id, advocateId));
    const get = (id: string) => db.query.pages.findFirst({ where: eq(pages.id, id) });

    beforeAll(() => setConsent(true));
    afterAll(() => setConsent(false));

    it("saves the local reading at once, queues the cloud read, and the cloud job replaces it (logging the send)", async () => {
      queued.length = 0;
      cloudCalls.length = 0;
      const pageId = await addPage(11, fixture);
      expect(await processPage(deps, pageId)).toBe("cloud-queued");
      expect(await get(pageId)).toMatchObject({ ocrStatus: "DONE", ocrRoute: "local:cloud-queued", ocrEngine: "tesseract-mar+eng" });
      expect(cloudCalls).toHaveLength(0); // the local job never calls the cloud
      expect(queued).toEqual([[pageId, 1]]);

      expect(await processCloudPage(deps, pageId, 1)).toBe("done");
      const p = await get(pageId);
      expect(p).toMatchObject({ ocrRoute: "cloud", ocrEngine: "fake-cloud", ocrText: "गाव : माळेगाव (cloud)" });
      expect(p?.ocrWords?.length).toBeGreaterThan(20); // the cloud engine gave no boxes: local ones kept
      expect(cloudCalls).toHaveLength(1);
      expect(await sentLogs(pageId)).toBe(1);

      // A duplicate cloud job, or a retried local job, changes nothing.
      expect(await processCloudPage(deps, pageId, 1)).toBe("stale");
      expect(await processPage(deps, pageId)).toBe("done");
      expect((await get(pageId))?.ocrRoute).toBe("cloud");
      expect(cloudCalls).toHaveLength(1);
    });

    it("re-queues the cloud read if a local job is retried after saving", async () => {
      const pageId = await addPage(12, fixture);
      await processPage({ ...deps, enqueueCloud: async () => Promise.reject(new Error("valkey down")) }, pageId).catch(() => undefined);
      queued.length = 0;
      expect(await processPage(deps, pageId)).toBe("cloud-queued");
      expect(queued).toEqual([[pageId, 1]]);
      await db.delete(pages).where(eq(pages.id, pageId));
    });

    it("does not send if the owner turned cloud reading off after the page was queued", async () => {
      cloudCalls.length = 0;
      const pageId = await addPage(13, fixture);
      await processPage(deps, pageId);
      await setConsent(false);
      expect(await processCloudPage(deps, pageId, 1)).toBe("no-consent");
      await setConsent(true);
      expect(cloudCalls).toHaveLength(0);
      expect(await sentLogs(pageId)).toBe(0);
      expect((await get(pageId))?.ocrRoute).toBe("local:no-consent");
      await db.delete(pages).where(eq(pages.id, pageId));
    });

    it("does not send an image that was replaced after the page was queued", async () => {
      cloudCalls.length = 0;
      const pageId = await addPage(14, fixture);
      await processPage(deps, pageId);
      await db.update(pages).set({ version: 2, ocrStatus: "PENDING" }).where(eq(pages.id, pageId));
      expect(await processCloudPage(deps, pageId, 1)).toBe("stale");
      expect(cloudCalls).toHaveLength(0);
      await db.delete(pages).where(eq(pages.id, pageId));
    });

    it("keeps the local reading when the cloud engine keeps failing", async () => {
      const pageId = await addPage(15, fixture);
      await processPage(deps, pageId);
      const down: ReadPolicy = {
        ...cloudAlways,
        cloud: { ...fakeCloud, recognize: async () => Promise.reject(new Error("sarvam 503")) },
      };
      await expect(processCloudPage({ ...deps, policy: down }, pageId, 1)).rejects.toThrow("sarvam 503");
      await markCloudFailed(db, pageId, 1);
      expect(await get(pageId)).toMatchObject({ ocrStatus: "DONE", ocrRoute: "local:cloud-failed", ocrEngine: "tesseract-mar+eng" });
      await db.delete(pages).where(eq(pages.id, pageId));
    });
  });

  it("returns missing for a page deleted before its job ran", async () => {
    expect(await processPage({ db, storage, policy: localOnly }, randomUUID())).toBe("missing");
  });

  it("does not save a reading of an image that was replaced while it was being read", async () => {
    const pageId = await addPage(20, fixture);
    // A slow engine; the page is re-uploaded (version bumped) while it reads.
    const slow: ReadPolicy = {
      ...localOnly,
      local: {
        name: "slow",
        external: false,
        async recognize() {
          await db
            .update(pages)
            .set({ version: sql`${pages.version} + 1`, ocrStatus: "PENDING" })
            .where(eq(pages.id, pageId));
          return { engine: "slow", text: "old image text", confidence: 0.9, words: [], width: 1, height: 1 };
        },
        async close() {},
      },
    };
    expect(await processPage({ db, storage, policy: slow }, pageId)).toBe("stale");
    const p = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
    expect(p?.ocrText).toBeNull();
    expect(p?.ocrStatus).toBe("PENDING"); // the newer job will read it
    await db.delete(pages).where(eq(pages.id, pageId)); // keep the shared document's roll-up clean for later tests
  });

  it("a stale job's final failure does not mark a newer reading FAILED", async () => {
    const pageId = await addPage(21, fixture);
    expect(await processPage({ db, storage, policy: localOnly }, pageId)).toBe("done"); // version 1 read
    const err = Object.assign(new Error("old job timed out"), { pageVersion: 0 }); // from an older version
    await markFailed(db, pageId, err);
    const p = await db.query.pages.findFirst({ where: eq(pages.id, pageId) });
    expect(p?.ocrStatus).toBe("DONE");
    await db.delete(pages).where(eq(pages.id, pageId));
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
