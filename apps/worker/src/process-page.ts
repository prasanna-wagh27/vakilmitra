import { accessLogs, and, type Db, eq, pages } from "@vakilmitra/db";
import { rollUpDocumentStatus } from "@vakilmitra/jobs";
import { localRoute, type OcrResult, type ReadPolicy, readCloud } from "@vakilmitra/ocr";
import type { SecureStorage } from "@vakilmitra/storage";

export interface Deps {
  db: Db;
  storage: SecureStorage;
  policy: ReadPolicy;
  /** Queue a cloud read of this page version (a separate queue, so slow cloud calls never block local reads). */
  enqueueCloud?: (pageId: string, version: number) => Promise<void>;
  log?: { info: (o: object, msg: string) => void; warn: (o: object, msg: string) => void };
}

const CLOUD_QUEUED = "local:cloud-queued";

/**
 * OCR one page on our servers: decrypt in memory, read with Tesseract, save text + word boxes.
 * The image is never written to disk. If the policy wants a cloud reading too (the case owner
 * has turned on cloud reading, and the page is unclear or mode is "always"), the local reading
 * is saved first, so the advocate sees text at once, and a cloud job is queued for the page.
 */
export async function processPage(
  { db, storage, policy, enqueueCloud, log }: Deps,
  pageId: string,
): Promise<"done" | "missing" | "stale" | "cloud-queued"> {
  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
    columns: { id: true, documentId: true, storageKey: true, version: true, ocrStatus: true, ocrRoute: true },
    with: {
      document: {
        columns: { id: true },
        with: { case: { columns: { id: true }, with: { advocate: { columns: { id: true, cloudOcrConsent: true } } } } },
      },
    },
  });
  if (!page) return "missing"; // deleted after upload
  if (page.ocrStatus === "DONE") {
    // A retry of a job that already saved this version (e.g. it failed after saving).
    // Make sure its cloud read was queued; never overwrite a newer cloud reading.
    if (page.ocrRoute === CLOUD_QUEUED && enqueueCloud) await enqueueCloud(page.id, page.version);
    return page.ocrRoute === CLOUD_QUEUED ? "cloud-queued" : "done";
  }
  const started = await db
    .update(pages)
    .set({ ocrStatus: "PROCESSING", ocrError: null })
    .where(and(eq(pages.id, pageId), eq(pages.version, page.version)))
    .returning({ id: pages.id });
  if (!started.length) return "stale"; // re-uploaded between our read and now
  await rollUpDocumentStatus(db, page.documentId);

  try {
    const image = await storage.get(page.storageKey);
    const local = await policy.local.recognize(image);
    const final = localRoute(policy, local, page.document.case.advocate.cloudOcrConsent);
    // Without a cloud queue (e.g. a one-off script), keep the local reading.
    const route = final ?? (enqueueCloud ? CLOUD_QUEUED : "local");

    if (!(await save(db, page.id, page.version, local, route))) {
      log?.info({ pageId }, "page changed while reading; newer job will save");
      return "stale";
    }
    if (route === CLOUD_QUEUED) await enqueueCloud?.(page.id, page.version);
    await rollUpDocumentStatus(db, page.documentId);
    log?.info({ pageId, route, localConfidence: local.confidence }, "ocr page read");
    return route === CLOUD_QUEUED ? "cloud-queued" : "done";
  } catch (e) {
    // Tag the failure with the version this job read, so markFailed never overwrites a newer reading.
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { pageVersion: page.version });
  }
}

/**
 * Cloud-read one page version that the local job queued. Re-checks everything at send time:
 * the page must still be this version and still waiting, and the owner must still consent
 * (they may have turned cloud reading off since). The send is recorded before it happens.
 * Engine errors are thrown so the queue retries; see markCloudFailed for the last attempt.
 */
export async function processCloudPage(
  { db, storage, policy, log }: Deps,
  pageId: string,
  version: number,
): Promise<"done" | "missing" | "stale" | "no-consent" | "empty"> {
  const page = await db.query.pages.findFirst({
    where: eq(pages.id, pageId),
    columns: {
      id: true,
      documentId: true,
      storageKey: true,
      version: true,
      ocrStatus: true,
      ocrRoute: true,
      ocrEngine: true,
      ocrText: true,
      ocrConfidence: true,
      ocrWords: true,
    },
    with: {
      document: {
        columns: { id: true },
        with: { case: { columns: { id: true }, with: { advocate: { columns: { id: true, cloudOcrConsent: true } } } } },
      },
    },
  });
  if (!page) return "missing";
  if (page.version !== version || page.ocrStatus !== "DONE" || page.ocrRoute !== CLOUD_QUEUED) return "stale";

  const owner = page.document.case.advocate;
  if (!owner.cloudOcrConsent) {
    await setRoute(db, page.id, version, "local:no-consent");
    return "no-consent";
  }

  const local: OcrResult = {
    engine: page.ocrEngine ?? policy.local.name,
    text: page.ocrText ?? "",
    confidence: page.ocrConfidence,
    words: page.ocrWords ?? [],
    width: 0,
    height: 0,
  };
  const image = await storage.get(page.storageKey);
  const outcome = await readCloud(policy, image, local, {
    // DPDP audit trail, written before the page leaves our servers: if this insert fails, nothing is sent.
    // Recorded against the advocate whose consent allowed it, so it shows in their access history.
    beforeCloudSend: async (engine) => {
      await db
        .insert(accessLogs)
        .values({ advocateId: owner.id, action: `page.sent_to_ocr:${engine}`, entityType: "page", entityId: page.id });
    },
  });
  if (outcome.route !== "cloud") {
    await setRoute(db, page.id, version, outcome.route);
    log?.warn({ pageId, error: outcome.cloudError }, "cloud OCR returned nothing, kept local result");
    return "empty";
  }
  const saved = await save(db, page.id, version, outcome.result, "cloud", CLOUD_QUEUED);
  if (!saved) return "stale";
  log?.info({ pageId, engine: outcome.result.engine, localConfidence: local.confidence }, "ocr page read in cloud");
  return "done";
}

/** After the last cloud retry: keep the local reading and record why. */
export async function markCloudFailed(db: Db, pageId: string, version: number) {
  await setRoute(db, pageId, version, "local:cloud-failed");
}

/** After the last retry: record the failure so the advocate sees it and can re-scan. */
export async function markFailed(db: Db, pageId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const version = (error as { pageVersion?: number } | null)?.pageVersion;
  const [page] = await db
    .update(pages)
    .set({ ocrStatus: "FAILED", ocrError: message.slice(0, 500) })
    // Only the version this job read: a newer upload's result must not be marked FAILED.
    .where(version === undefined ? eq(pages.id, pageId) : and(eq(pages.id, pageId), eq(pages.version, version)))
    .returning({ documentId: pages.documentId });
  if (page) await rollUpDocumentStatus(db, page.documentId);
}

/** Save a reading for one page version (and, if given, only while the page is still on `fromRoute`). */
async function save(db: Db, pageId: string, version: number, r: OcrResult, route: string, fromRoute?: string) {
  const rows = await db
    .update(pages)
    .set({
      ocrStatus: "DONE",
      ocrEngine: r.engine,
      ocrRoute: route,
      ocrText: r.text,
      ocrConfidence: r.confidence,
      ocrWords: r.words,
      ocrAt: new Date(),
    })
    .where(and(eq(pages.id, pageId), eq(pages.version, version), fromRoute ? eq(pages.ocrRoute, fromRoute) : undefined))
    .returning({ id: pages.id });
  return rows.length > 0;
}

/** Record why the local reading was kept, if the page is still this version and still waiting for the cloud. */
async function setRoute(db: Db, pageId: string, version: number, route: string) {
  await db
    .update(pages)
    .set({ ocrRoute: route })
    .where(and(eq(pages.id, pageId), eq(pages.version, version), eq(pages.ocrRoute, CLOUD_QUEUED)));
}
