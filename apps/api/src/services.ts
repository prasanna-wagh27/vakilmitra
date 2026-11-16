import { createOcrQueue, type OcrQueueLike } from "@vakilmitra/jobs";
import { createStorage, type SecureStorage, storageConfigFromEnv } from "@vakilmitra/storage";
import { env } from "./env.js";

/** External services the API talks to. Created once from env; tests swap them out. */
export interface Services {
  storage: SecureStorage;
  ocrQueue: OcrQueueLike & { close?: () => Promise<void> };
}

let current: Services | null = null;

export function getServices(): Services {
  current ??= {
    storage: createStorage(storageConfigFromEnv(process.env)),
    ocrQueue: createOcrQueue(env.VALKEY_URL),
  };
  return current;
}

export function setServices(s: Services) {
  current = s;
}
