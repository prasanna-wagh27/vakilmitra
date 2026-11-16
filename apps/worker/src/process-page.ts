import { type Db, eq, pages } from "@vakilmitra/db";
import { rollUpDocumentStatus } from "@vakilmitra/jobs";
import type { OcrEngine } from "@vakilmitra/ocr";
import type { SecureStorage } from "@vakilmitra/storage";

export interface Deps {
  db: Db;
  storage: SecureStorage;
  engine: OcrEngine;
}

/** OCR one page: decrypt in memory, read it, save text + word boxes. The image is never written to disk. */
export async function processPage({ db, storage, engine }: Deps, pageId: string): Promise<"done" | "missing"> {
  const page = await db.query.pages.findFirst({ where: eq(pages.id, pageId), columns: { id: true, documentId: true, storageKey: true } });
  if (!page) return "missing"; // deleted after upload
  await db.update(pages).set({ ocrStatus: "PROCESSING", ocrError: null }).where(eq(pages.id, pageId));
  await rollUpDocumentStatus(db, page.documentId);

  const image = await storage.get(page.storageKey);
  const r = await engine.recognize(image);
  await db
    .update(pages)
    .set({
      ocrStatus: "DONE",
      ocrEngine: r.engine,
      ocrText: r.text,
      ocrConfidence: r.confidence,
      ocrWords: r.words,
      ocrAt: new Date(),
    })
    .where(eq(pages.id, pageId));
  await rollUpDocumentStatus(db, page.documentId);
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
