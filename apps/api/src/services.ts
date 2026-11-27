import { Ai, aiConfigFromEnv } from "@vakilmitra/ai";
import { type CourtsQueueLike, createCourtsQueue, createOcrQueue, type OcrQueueLike } from "@vakilmitra/jobs";
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
  /** AI models per task (drafting, translation); a task with no model set is off. Created on first use. */
  ai?: Ai;
  /** Case tracking readings, done by the worker. Created on first use. */
  courtsQueue?: CourtsQueueLike;
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

/** The AI door for features. The settings were already checked at start-up (env.ts). */
export const ai = (): Ai => (getServices().ai ??= new Ai(aiConfigFromEnv(process.env)));

export const courtsQueue = (): CourtsQueueLike => (getServices().courtsQueue ??= createCourtsQueue(env.VALKEY_URL));

export function setServices(s: Services) {
  current = s;
}
