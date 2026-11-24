import * as Sentry from "@sentry/node";
import { createDb } from "@vakilmitra/db";
import {
  BACKUP_SCHEDULE,
  connectionFromUrl,
  createBackupQueue,
  createHousekeepingQueue,
  createOcrCloudQueue,
  enqueueCloudOcr,
  HOUSEKEEPING_SCHEDULE,
  type OcrCloudJob,
  type OcrJob,
  QUEUES,
} from "@vakilmitra/jobs";
import { ocrEnv, policyFromEnv } from "@vakilmitra/ocr";
import { backupStorageConfigFromEnv, createBlobStore, createStorage, parseMasterKeys, storageConfigFromEnv } from "@vakilmitra/storage";
import { type Job, Worker } from "bullmq";
import pino from "pino";
import { checkRestore, runBackup } from "./backup.js";
import { loadEnv } from "./env.js";
import { markCloudFailed, markFailed, processCloudPage, processPage } from "./process-page.js";
import { pruneActivity } from "./retention.js";

const env = loadEnv();

/** Sends a job's failure to Sentry once its last retry has failed (no-op without SENTRY_DSN). */
const reportFailure = (queue: string) => (job: Job | undefined, err: Error) => {
  if (job && job.attemptsMade < (job.opts.attempts ?? 1)) return;
  Sentry.withScope((scope) => {
    scope.setTag("queue", queue);
    if (job?.name) scope.setTag("job", job.name);
    Sentry.captureException(err);
  });
};
// OCR settings (including OCR_CONCURRENCY, which sizes both the job concurrency and the Tesseract pool).
const ocr = ocrEnv(process.env);
const policy = policyFromEnv(ocr);
const log = pino({ level: env.LOG_LEVEL, transport: env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" } });
const cloudOn = policy.cloud !== null;
// Cloud jobs hold a connection only for short queries, never during the network wait, so a few extra suffice.
const { db, pool } = createDb(env.DATABASE_URL, { max: ocr.OCR_CONCURRENCY + (cloudOn ? 2 : 0) + 2 });
const liveCfg = storageConfigFromEnv(process.env);
const storage = createStorage(liveCfg);
const backupCfg = backupStorageConfigFromEnv(process.env);
const cloudQueue = cloudOn ? createOcrCloudQueue(env.VALKEY_URL) : null;
const deps = {
  db,
  storage,
  policy,
  log,
  enqueueCloud: cloudQueue ? (pageId: string, version: number) => enqueueCloudOcr(cloudQueue, pageId, version) : undefined,
};

const worker = new Worker<OcrJob>(
  QUEUES.ocr,
  async (job) => {
    const started = Date.now();
    try {
      const result = await processPage(deps, job.data.pageId);
      log.info({ pageId: job.data.pageId, result, ms: Date.now() - started }, "ocr page");
    } catch (err) {
      const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      log.warn({ pageId: job.data.pageId, attempt: job.attemptsMade + 1, last, err }, "ocr page failed");
      if (last) await markFailed(db, job.data.pageId, err);
      throw err;
    }
  },
  { connection: connectionFromUrl(env.VALKEY_URL), concurrency: ocr.OCR_CONCURRENCY },
);

// Cloud reads wait on the network (Sarvam polls for up to 2 minutes), so they get their own
// queue and limit: a slow cloud call never holds a Tesseract slot.
const cloudWorker = cloudOn
  ? new Worker<OcrCloudJob>(
      QUEUES.ocrCloud,
      async (job) => {
        const { pageId, version } = job.data;
        const started = Date.now();
        try {
          const result = await processCloudPage(deps, pageId, version);
          log.info({ pageId, result, ms: Date.now() - started }, "cloud ocr page");
        } catch (err) {
          const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
          log.warn({ pageId, attempt: job.attemptsMade + 1, last, err }, "cloud ocr page failed");
          if (last) await markCloudFailed(db, pageId, version);
          throw err;
        }
      },
      { connection: connectionFromUrl(env.VALKEY_URL), concurrency: ocr.OCR_CLOUD_CONCURRENCY },
    )
  : null;
cloudWorker?.on("error", (err) => log.error({ err }, "cloud worker error"));
cloudWorker?.on("failed", reportFailure(QUEUES.ocrCloud));

// Nightly backup, then the restore check. Off until BACKUP_STORAGE_DRIVER is set.
const backupQueue = backupCfg ? createBackupQueue(env.VALKEY_URL) : null;
const backupWorker = backupCfg
  ? new Worker(
      QUEUES.backup,
      async () => {
        const deps = {
          db,
          databaseUrl: env.DATABASE_URL,
          live: createBlobStore(liveCfg),
          backup: createBlobStore(backupCfg),
          masterKeys: parseMasterKeys(liveCfg.masterKeys),
          log,
        };
        const id = await runBackup(deps);
        if (env.BACKUP_RESTORE_CHECK_URL) await checkRestore(deps, env.BACKUP_RESTORE_CHECK_URL, id);
      },
      { connection: connectionFromUrl(env.VALKEY_URL), concurrency: 1, lockDuration: 10 * 60_000 },
    )
  : null;
backupWorker?.on("failed", (job, err) => {
  log.error({ err }, "nightly backup failed");
  reportFailure(QUEUES.backup)(job, err);
});
if (backupQueue) {
  await backupQueue.upsertJobScheduler("nightly-backup", BACKUP_SCHEDULE, { name: "backup" });
  if (!env.BACKUP_RESTORE_CHECK_URL) log.warn("BACKUP_RESTORE_CHECK_URL is not set: backups are taken but never test-restored");
} else if (env.NODE_ENV === "production") {
  log.error("Backups are OFF: set BACKUP_STORAGE_DRIVER and its bucket (see README, Backups)");
}

// Daily clean-up: activity records older than a year (always on; it needs only the database).
const housekeepingQueue = createHousekeepingQueue(env.VALKEY_URL);
const housekeepingWorker = new Worker(
  QUEUES.housekeeping,
  async () => {
    const { deleted, cutoff } = await pruneActivity(db);
    log.info({ deleted, before: cutoff.toISOString() }, "old activity records deleted");
  },
  { connection: connectionFromUrl(env.VALKEY_URL), concurrency: 1, lockDuration: 10 * 60_000 },
);
housekeepingWorker.on("failed", (job, err) => {
  log.error({ err }, "daily clean-up failed");
  reportFailure(QUEUES.housekeeping)(job, err);
});
await housekeepingQueue.upsertJobScheduler("daily-housekeeping", HOUSEKEEPING_SCHEDULE, { name: "housekeeping" });

// Logged once connected; listening for the "ready" event here would miss it, since it fires during the awaits above.
await worker.waitUntilReady();
log.info(
  {
    local: policy.local.name,
    cloud: policy.cloud?.name ?? "none",
    mode: policy.mode,
    below: policy.below,
    concurrency: ocr.OCR_CONCURRENCY,
    cloudConcurrency: cloudOn ? ocr.OCR_CLOUD_CONCURRENCY : 0,
  },
  "OCR worker ready",
);
worker.on("error", (err) => log.error({ err }, "worker error"));
worker.on("failed", reportFailure(QUEUES.ocr));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    log.info("shutting down");
    await Promise.all([worker.close(), cloudWorker?.close(), backupWorker?.close(), housekeepingWorker.close()]);
    await Promise.all([cloudQueue?.close(), backupQueue?.close(), housekeepingQueue.close()]);
    await policy.local.close();
    await policy.cloud?.close();
    await pool.end();
    await Sentry.close(2000);
    process.exit(0);
  });
}
