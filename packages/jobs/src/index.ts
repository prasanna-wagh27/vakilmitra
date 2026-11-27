/**
 * Background jobs shared by the API (producer) and worker (consumer).
 * BullMQ on Valkey (never Redis 7.4+). Each queue's payload is typed here once.
 */
import { and, count, type Db, documents, eq, pages } from "@vakilmitra/db";
import { type ConnectionOptions, Queue, type QueueOptions } from "bullmq";

export const QUEUES = { ocr: "ocr", ocrCloud: "ocr-cloud", backup: "backup", housekeeping: "housekeeping", courts: "courts" } as const;

export interface OcrJob {
  pageId: string;
}

/** A cloud read for one page version, queued by the local OCR job after it saved its reading. */
export interface OcrCloudJob {
  pageId: string;
  version: number;
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

export function createOcrCloudQueue(url: string, opts: Partial<QueueOptions> = {}) {
  return new Queue<OcrCloudJob, void, "ocr-cloud">(QUEUES.ocrCloud, {
    connection: connectionFromUrl(url),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
    ...opts,
  });
}

/** Nightly backup at 03:00 IST (one job at a time; the worker schedules it). */
export function createBackupQueue(url: string) {
  return new Queue<Record<string, never>, void, string>(QUEUES.backup, {
    connection: connectionFromUrl(url),
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 15 * 60_000 },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 30 },
    },
  });
}
export const BACKUP_SCHEDULE = { pattern: "0 3 * * *", tz: "Asia/Kolkata" } as const;

/** Daily clean-up at 02:30 IST, before the backup: deletes records past their keeping period. */
export function createHousekeepingQueue(url: string) {
  return new Queue<Record<string, never>, void, string>(QUEUES.housekeeping, {
    connection: connectionFromUrl(url),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "fixed", delay: 30 * 60_000 },
      removeOnComplete: { count: 30 },
      removeOnFail: { count: 30 },
    },
  });
}
export const HOUSEKEEPING_SCHEDULE = { pattern: "30 2 * * *", tz: "Asia/Kolkata" } as const;

/**
 * Court case tracking. Two kinds of job on one queue:
 *   "check-case" { caseId }: read one case now (tracking just turned on, or "refresh" pressed)
 *   "evening"    {}:         read every tracked case that is due, then send the evening emails
 */
export type CourtsJob = { caseId: string } | Record<string, never>;
export function createCourtsQueue(url: string) {
  return new Queue<CourtsJob, void, string>(QUEUES.courts, {
    connection: connectionFromUrl(url),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
}
/** 7:30 pm IST: district courts have usually entered the day's next dates by then. */
export const COURTS_EVENING_SCHEDULE = { pattern: "30 19 * * *", tz: "Asia/Kolkata" } as const;

export type CourtsQueueLike = Pick<ReturnType<typeof createCourtsQueue>, "add">;

/** Queue a reading of one case. The API limits how often a case may be refreshed, so every request gets its own job. */
export async function enqueueCaseCheck(queue: CourtsQueueLike, caseId: string, now = Date.now()) {
  await queue.add("check-case", { caseId }, { jobId: `check-case-${caseId}-${now}`, attempts: 2 });
}

export type OcrCloudQueue = ReturnType<typeof createOcrCloudQueue>;
export type OcrCloudQueueLike = Pick<OcrCloudQueue, "add">;

/** Queue a cloud read of one page version. One job per version: duplicates are ignored. */
export async function enqueueCloudOcr(queue: OcrCloudQueueLike, pageId: string, version: number) {
  await queue.add("ocr-cloud", { pageId, version }, { jobId: `ocr-cloud-${pageId}-${version}` });
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
