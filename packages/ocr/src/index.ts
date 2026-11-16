/**
 * OCR behind one small interface, so engines can be compared by evals and swapped by config.
 *
 * Policy (see `readPage`): Tesseract on our own servers always reads first. A cloud engine
 * (Sarvam Vision or Gemini) is used only when the case's advocate has consented to cloud reading,
 * and then either for every page or only for pages Tesseract was unsure about.
 */
import { z } from "zod";
import { DEFAULT_GEMINI_MODEL, GeminiEngine } from "./gemini.js";
import { SarvamEngine } from "./sarvam.js";
import { TesseractEngine } from "./tesseract.js";
import type { OcrEngine, OcrHints, OcrResult } from "./types.js";

export { DEFAULT_GEMINI_MODEL, type GeminiConfig, GeminiEngine, TRANSCRIBE_PROMPT, transcriptionSchema } from "./gemini.js";
export * from "./metrics.js";
export { markdownToText, type SarvamConfig, SarvamEngine } from "./sarvam.js";
export { preprocess, TesseractEngine } from "./tesseract.js";
export type { OcrEngine, OcrHints, OcrResult, OcrWord } from "./types.js";

export const CLOUD_ENGINES = ["sarvam", "gemini"] as const;
export type CloudEngineName = (typeof CLOUD_ENGINES)[number];

const envSchema = z.object({
  OCR_CLOUD_ENGINE: z.enum(["none", ...CLOUD_ENGINES]).default("none"),
  // fallback: only pages Tesseract reads below OCR_CLOUD_BELOW; always: every page.
  OCR_CLOUD_MODE: z.enum(["fallback", "always"]).default("fallback"),
  OCR_CLOUD_BELOW: z.coerce.number().min(0).max(1).default(0.85),
  OCR_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(1),
  SARVAM_API_KEY: z.string().optional(),
  SARVAM_BASE_URL: z.url().optional(),
  SARVAM_MODEL: z.string().optional(),
  GEMINI_PROVIDER: z.enum(["vertex", "google"]).default("vertex"),
  GEMINI_MODEL: z.string().default(DEFAULT_GEMINI_MODEL),
  GOOGLE_VERTEX_PROJECT: z.string().optional(),
  GOOGLE_VERTEX_LOCATION: z.string().default("asia-south1"),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
});

export type OcrEnv = z.infer<typeof envSchema>;

export function ocrEnv(env: Record<string, string | undefined>): OcrEnv {
  return envSchema.parse(env);
}

export const ENGINE_NAMES = ["tesseract", ...CLOUD_ENGINES] as const;
export type EngineName = (typeof ENGINE_NAMES)[number];

/**
 * Build one engine by name from env. Unknown names throw: a typo must never fall through to
 * an engine that sends pages outside our servers.
 */
export function createEngine(name: string, env: OcrEnv): OcrEngine {
  switch (name) {
    case "tesseract":
      return new TesseractEngine(["mar", "eng"], env.OCR_CONCURRENCY);
    case "sarvam":
      if (!env.SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is required for the sarvam engine");
      return new SarvamEngine({ apiKey: env.SARVAM_API_KEY, baseUrl: env.SARVAM_BASE_URL, model: env.SARVAM_MODEL });
    case "gemini":
      if (env.GEMINI_PROVIDER === "vertex") {
        if (!env.GOOGLE_VERTEX_PROJECT) throw new Error("GOOGLE_VERTEX_PROJECT is required for gemini on Vertex AI");
        return new GeminiEngine({
          provider: "vertex",
          model: env.GEMINI_MODEL,
          project: env.GOOGLE_VERTEX_PROJECT,
          location: env.GOOGLE_VERTEX_LOCATION,
        });
      }
      if (!env.GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required for gemini on the Gemini API");
      return new GeminiEngine({ provider: "google", model: env.GEMINI_MODEL, apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    default:
      throw new Error(`Unknown OCR engine "${name}". Use one of: ${ENGINE_NAMES.join(", ")}`);
  }
}

export interface ReadPolicy {
  local: OcrEngine;
  cloud: OcrEngine | null;
  mode: "fallback" | "always";
  /** In fallback mode, pages with local confidence below this go to the cloud engine. */
  below: number;
}

export function policyFromEnv(env: OcrEnv): ReadPolicy {
  // Client pages never go to the consumer Gemini API (its free tier may train on inputs and is
  // not India-hosted). It stays available to the eval harness for non-client pages only.
  if (env.OCR_CLOUD_ENGINE === "gemini" && env.GEMINI_PROVIDER !== "vertex") {
    throw new Error(
      "The worker only uses Gemini through Vertex AI (GEMINI_PROVIDER=vertex). The consumer Gemini API is for evaluation only.",
    );
  }
  return {
    local: createEngine("tesseract", env),
    cloud: env.OCR_CLOUD_ENGINE === "none" ? null : createEngine(env.OCR_CLOUD_ENGINE, env),
    mode: env.OCR_CLOUD_MODE,
    below: env.OCR_CLOUD_BELOW,
  };
}

export type ReadRoute = "local" | "local:no-consent" | "local:confident" | "cloud" | "local:cloud-failed" | "local:cloud-empty";

export interface ReadOutcome {
  result: OcrResult;
  /** Why this engine's result was kept. */
  route: ReadRoute;
  localConfidence: number | null;
  cloudError?: string;
}

export interface ReadOptions {
  /** The case owner's consent to cloud reading. Without it, no page leaves our servers. */
  cloudAllowed: boolean;
  hints?: OcrHints;
  /**
   * Awaited just before the page is sent to the cloud engine (e.g. to write the audit row).
   * If it throws, nothing is sent and the error propagates: a page never leaves unrecorded.
   */
  beforeCloudSend?: (engine: string) => Promise<void>;
}

/**
 * Read one page under the policy.
 * - Tesseract always reads first, on our servers (it is also the fallback and gives word boxes).
 * - The cloud engine is used only with consent, and in fallback mode only below the threshold.
 * - If the cloud call fails or returns no text, the local reading is kept.
 * - If the cloud engine gives no boxes (Sarvam's text output), the local word boxes are kept so
 *   unclear regions stay marked on the scan. Their text is Tesseract's, not the stored text.
 */
export async function readPage(policy: ReadPolicy, image: Buffer, opts: ReadOptions): Promise<ReadOutcome> {
  const { cloud } = policy;
  const local = await policy.local.recognize(image, opts.hints);
  const keep = (route: ReadRoute, cloudError?: string): ReadOutcome => ({
    result: local,
    route,
    localConfidence: local.confidence,
    cloudError,
  });
  if (!cloud) return keep("local");
  if (!opts.cloudAllowed) return keep("local:no-consent");
  if (policy.mode === "fallback" && (local.confidence ?? 0) >= policy.below) return keep("local:confident");

  await opts.beforeCloudSend?.(cloud.name);
  let remote: OcrResult;
  try {
    remote = await cloud.recognize(image, opts.hints);
  } catch (e) {
    return keep("local:cloud-failed", e instanceof Error ? e.message : String(e));
  }
  if (!remote.text.trim()) return keep("local:cloud-empty", `${cloud.name} returned no text`);
  const result = remote.words.length ? remote : { ...remote, words: local.words };
  return { result, route: "cloud", localConfidence: local.confidence };
}
