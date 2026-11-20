import { z } from "zod";
import type { StorageConfig } from "./index.js";

/**
 * Storage settings from environment variables, validated at boot.
 *   STORAGE_DRIVER=fs  STORAGE_DIR=./.data/blobs                       (development)
 *   STORAGE_DRIVER=s3  S3_BUCKET S3_REGION S3_ENDPOINT? S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
 *   STORAGE_MASTER_KEYS=k1:<base64 32 bytes>[,k0:<old key>]           (always; first one encrypts)
 */
const schema = z.discriminatedUnion("STORAGE_DRIVER", [
  z.object({
    STORAGE_DRIVER: z.literal("fs"),
    STORAGE_DIR: z.string().min(1).default("./.data/blobs"),
    STORAGE_MASTER_KEYS: z.string().min(1),
  }),
  z.object({
    STORAGE_DRIVER: z.literal("s3"),
    S3_BUCKET: z.string().min(1),
    S3_REGION: z.string().min(1),
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: z.stringbool().optional(),
    STORAGE_MASTER_KEYS: z.string().min(1),
  }),
]);

export function storageConfigFromEnv(env: Record<string, string | undefined>): StorageConfig {
  // In production the driver must be chosen on purpose: silently writing client files to a
  // container's local disk would lose them on redeploy and keep them out of the India bucket.
  if (env.NODE_ENV === "production" && !env.STORAGE_DRIVER) {
    throw new Error("STORAGE_DRIVER must be set in production (s3, or fs with a persistent volume)");
  }
  const e = schema.parse({ STORAGE_DRIVER: "fs", ...env });
  if (e.STORAGE_DRIVER === "fs") return { driver: "fs", dir: e.STORAGE_DIR, masterKeys: e.STORAGE_MASTER_KEYS };
  return {
    driver: "s3",
    bucket: e.S3_BUCKET,
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT,
    accessKeyId: e.S3_ACCESS_KEY_ID,
    secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    forcePathStyle: e.S3_FORCE_PATH_STYLE,
    masterKeys: e.STORAGE_MASTER_KEYS,
  };
}

/**
 * Where backups go: the same settings with a BACKUP_ prefix (BACKUP_STORAGE_DRIVER,
 * BACKUP_STORAGE_DIR, BACKUP_S3_BUCKET, ...), encrypted with the same STORAGE_MASTER_KEYS.
 * Use a different bucket (ideally a different account) from the live files. Null when unset.
 */
export function backupStorageConfigFromEnv(env: Record<string, string | undefined>): StorageConfig | null {
  if (!env.BACKUP_STORAGE_DRIVER) return null;
  const unprefixed: Record<string, string | undefined> = { STORAGE_MASTER_KEYS: env.STORAGE_MASTER_KEYS };
  for (const [k, v] of Object.entries(env)) if (k.startsWith("BACKUP_")) unprefixed[k.slice("BACKUP_".length)] = v;
  const cfg = storageConfigFromEnv(unprefixed);
  const live = storageConfigFromEnv(env);
  const same = cfg.driver === "fs" ? live.driver === "fs" && cfg.dir === live.dir : live.driver === "s3" && cfg.bucket === live.bucket;
  if (same) throw new Error("Backups must go to a different place from the live files (BACKUP_S3_BUCKET or BACKUP_STORAGE_DIR)");
  return cfg;
}
