import { createDb } from "@vakilmitra/db";
import { connectionFromUrl, type OcrJob, QUEUES } from "@vakilmitra/jobs";
import { ocrEnv, policyFromEnv } from "@vakilmitra/ocr";
import { createStorage, storageConfigFromEnv } from "@vakilmitra/storage";
import { Worker } from "bullmq";
import pino from "pino";
import { loadEnv } from "./env.js";
import { markFailed, processPage } from "./process-page.js";

const env = loadEnv();
// OCR settings (including OCR_CONCURRENCY, which sizes both the job concurrency and the Tesseract pool).
const ocr = ocrEnv(process.env);
const policy = policyFromEnv(ocr);
const log = pino({ level: env.LOG_LEVEL, transport: env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" } });
const { db, pool } = createDb(env.DATABASE_URL, { max: ocr.OCR_CONCURRENCY + 1 });
const storage = createStorage(storageConfigFromEnv(process.env));

const worker = new Worker<OcrJob>(
  QUEUES.ocr,
  async (job) => {
    const started = Date.now();
    try {
      const result = await processPage({ db, storage, policy, log }, job.data.pageId);
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

worker.on("ready", () =>
  log.info(
    {
      local: policy.local.name,
      cloud: policy.cloud?.name ?? "none",
      mode: policy.mode,
      below: policy.below,
      concurrency: ocr.OCR_CONCURRENCY,
    },
    "OCR worker ready",
  ),
);
worker.on("error", (err) => log.error({ err }, "worker error"));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    log.info("shutting down");
    await worker.close();
    await policy.local.close();
    await policy.cloud?.close();
    await pool.end();
    process.exit(0);
  });
}
