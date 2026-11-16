/**
 * Background jobs shared by the API (producer) and worker (consumer).
 * BullMQ on Valkey (never Redis 7.4+). Each queue's payload is typed here once.
 */
import { and, count, type Db, documents, eq, pages } from "@vakilmitra/db";
import { type ConnectionOptions, Queue, type QueueOptions } from "bullmq";

export const QUEUES = { ocr: "ocr" } as const;

export interface OcrJob {
  pageId: string;
}

export function connectionFromUrl(url: string): ConnectionOptions {
  // Workers block on Valkey; BullMQ requires maxRetriesPerRequest: null for that.
  return { url, maxRetriesPerRequest: null };
}

export function createOcrQueue(url: string, opts: Partial<QueueOptions> = {}) {
  return new Queue<OcrJob, void, "ocr">(QUEUES.ocr, {
    connection: connectionFromUrl(url),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
    ...opts,
  });
}

export type OcrQueue = ReturnType<typeof createOcrQueue>;
/** The only part producers need (lets tests pass a fake). */
export type OcrQueueLike = Pick<OcrQueue, "add">;

/**
 * Queue OCR for a page. The job id includes a version stamp so that a re-uploaded or retried
 * page gets a fresh job, while accidental double-submits of the same version are ignored.
 */
export async function enqueueOcr(queue: OcrQueueLike, pageId: string, version: number | string = Date.now()) {
  await queue.add("ocr", { pageId }, { jobId: `ocr-${pageId}-${version}` });
}

/**
 * Roll a document's status up from its pages:
 * no pages -> PENDING; any page still queued or running -> PROCESSING;
 * all read -> DONE; otherwise (some failed, none pending) -> FAILED.
 */
export async function rollUpDocumentStatus(db: Db, documentId: string) {
  const rows = await db
    .select({ status: pages.ocrStatus, n: count() })
    .from(pages)
    .where(eq(pages.documentId, documentId))
    .groupBy(pages.ocrStatus);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<(typeof rows)[number]["status"], number>>;
  const total = rows.reduce((s, r) => s + r.n, 0);
  const status =
    total === 0 ? "PENDING" : (by.PENDING ?? 0) + (by.PROCESSING ?? 0) > 0 ? "PROCESSING" : (by.FAILED ?? 0) > 0 ? "FAILED" : "DONE";
  await db
    .update(documents)
    .set({ ocrStatus: status })
    .where(and(eq(documents.id, documentId)));
  return status;
}
