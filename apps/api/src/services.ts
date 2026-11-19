import { createOcrQueue, type OcrQueueLike } from "@vakilmitra/jobs";
import { createStorage, type SecureStorage, storageConfigFromEnv } from "@vakilmitra/storage";
import { RazorpayClient, type RazorpayLike } from "./billing/razorpay.js";
import { env } from "./env.js";
import { createMailer, type Mailer } from "./mail.js";

/** External services the API talks to. Created once from env; tests swap them out. */
export interface Services {
  storage: SecureStorage;
  ocrQueue: OcrQueueLike & { close?: () => Promise<void> };
  /** Null when Razorpay keys are not configured. */
  razorpay?: RazorpayLike | null;
  /** Created on first use when not given. */
  mailer?: Mailer;
}

let current: Services | null = null;

export function getServices(): Services {
  current ??= {
    storage: createStorage(storageConfigFromEnv(process.env)),
    ocrQueue: createOcrQueue(env.VALKEY_URL),
    razorpay: env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET ? new RazorpayClient(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET) : null,
  };
  return current;
}

export const mailer = (): Mailer => (getServices().mailer ??= createMailer());

export function setServices(s: Services) {
  current = s;
}
