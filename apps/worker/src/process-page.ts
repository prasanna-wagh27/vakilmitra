import { accessLogs, and, type Db, eq, pages } from "@vakilmitra/db";
import { rollUpDocumentStatus } from "@vakilmitra/jobs";
import { type ReadPolicy, readPage } from "@vakilmitra/ocr";
import type { SecureStorage } from "@vakilmitra/storage";

export interface Deps {
  db: Db;
  storage: SecureStorage;
  policy: ReadPolicy;
  log?: { info: (o: object, msg: string) => void; warn: (o: object, msg: string) => void };
}

/**
 * OCR one page: decrypt in memory, read it under the OCR policy, save text + word boxes.
 * The image is never written to disk. It goes to a cloud OCR provider only if the case's
 * owner has turned on cloud reading, and every such send is recorded in the access log.
 */
export async function processPage({ db, storage, policy, log }: Deps, pageId: string): Promise<"done" | "missing" | "stale"> {
  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
    columns: { id: true, documentId: true, storageKey: true, version: true },
    with: {
      document: {
        columns: { id: true },
        with: { case: { columns: { id: true }, with: { advocate: { columns: { id: true, cloudOcrConsent: true } } } } },
      },
    },
  });
  if (!page) return "missing"; // deleted after upload
  const started = await db
    .update(pages)
    .set({ ocrStatus: "PROCESSING", ocrError: null })
    .where(and(eq(pages.id, pageId), eq(pages.version, page.version)))
    .returning({ id: pages.id });
  if (!started.length) return "stale"; // re-uploaded between our read and now
  await rollUpDocumentStatus(db, page.documentId);

  const owner = page.document.case.advocate;
  const image = await storage.get(page.storageKey);
  const outcome = await readPage(policy, image, {
    cloudAllowed: owner.cloudOcrConsent,
    // DPDP audit trail, written before the page leaves our servers: if this insert fails, nothing is sent.
    // Recorded against the advocate whose consent allowed it, so it shows in their access history.
    beforeCloudSend: async (engine) => {
      await db
        .insert(accessLogs)
        .values({ advocateId: owner.id, action: `page.sent_to_ocr:${engine}`, entityType: "page", entityId: page.id });
    },
  });
  const r = outcome.result;

  if (outcome.cloudError) log?.warn({ pageId, error: outcome.cloudError }, "cloud OCR failed, kept local result");

  // Save only if nobody re-uploaded or re-queued the page while we were reading it.
  const saved = await db
    .update(pages)
    .set({
      ocrStatus: "DONE",
      ocrEngine: r.engine,
      ocrRoute: outcome.route,
      ocrText: r.text,
      ocrConfidence: r.confidence,
      ocrWords: r.words,
      ocrAt: new Date(),
    })
    .where(and(eq(pages.id, pageId), eq(pages.version, page.version)))
    .returning({ id: pages.id });
  if (!saved.length) {
    log?.info({ pageId }, "page changed while reading; newer job will save");
    return "stale";
  }
  await rollUpDocumentStatus(db, page.documentId);
  log?.info({ pageId, engine: r.engine, route: outcome.route, localConfidence: outcome.localConfidence }, "ocr page read");
  return "done";
}

/** After the last retry: record the failure so the advocate sees it and can re-scan. */
export async function markFailed(db: Db, pageId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const [page] = await db
    .update(pages)
    .set({ ocrStatus: "FAILED", ocrError: message.slice(0, 500) })
    .where(eq(pages.id, pageId))
    .returning({ documentId: pages.documentId });
  if (page) await rollUpDocumentStatus(db, page.documentId);
}
