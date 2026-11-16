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

/** Build one engine by name from env. Throws with a clear message when its keys are missing. */
export function createEngine(name: "tesseract" | CloudEngineName, env: OcrEnv): OcrEngine {
  if (name === "tesseract") return new TesseractEngine();
  if (name === "sarvam") {
    if (!env.SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is required for the sarvam engine");
    return new SarvamEngine({ apiKey: env.SARVAM_API_KEY, baseUrl: env.SARVAM_BASE_URL, model: env.SARVAM_MODEL });
  }
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
}

export interface ReadPolicy {
  local: OcrEngine;
  cloud: OcrEngine | null;
  mode: "fallback" | "always";
  /** In fallback mode, pages with local confidence below this go to the cloud engine. */
  below: number;
}

export function policyFromEnv(env: OcrEnv): ReadPolicy {
  return {
    local: createEngine("tesseract", env),
    cloud: env.OCR_CLOUD_ENGINE === "none" ? null : createEngine(env.OCR_CLOUD_ENGINE, env),
    mode: env.OCR_CLOUD_MODE,
    below: env.OCR_CLOUD_BELOW,
  };
}

export interface ReadOutcome {
  result: OcrResult;
  /** Why this engine's result was kept. */
  route: "local" | "local:no-consent" | "local:confident" | "cloud" | "local:cloud-failed";
  localConfidence: number | null;
  cloudError?: string;
}

/**
 * Read one page under the policy. A page image goes to a cloud engine only when `cloudAllowed`
 * (the case owner's consent) is true. If the cloud call fails, the local result is kept.
 */
export async function readPage(policy: ReadPolicy, image: Buffer, opts: { cloudAllowed: boolean; hints?: OcrHints }): Promise<ReadOutcome> {
  const { cloud } = policy;
  if (cloud && opts.cloudAllowed && policy.mode === "always") {
    try {
      return { result: await cloud.recognize(image, opts.hints), route: "cloud", localConfidence: null };
    } catch (e) {
      const local = await policy.local.recognize(image, opts.hints);
      return { result: local, route: "local:cloud-failed", localConfidence: local.confidence, cloudError: errorMessage(e) };
    }
  }
  const local = await policy.local.recognize(image, opts.hints);
  if (!cloud) return { result: local, route: "local", localConfidence: local.confidence };
  if (!opts.cloudAllowed) return { result: local, route: "local:no-consent", localConfidence: local.confidence };
  if ((local.confidence ?? 0) >= policy.below) return { result: local, route: "local:confident", localConfidence: local.confidence };
  try {
    return { result: await cloud.recognize(image, opts.hints), route: "cloud", localConfidence: local.confidence };
  } catch (e) {
    return { result: local, route: "local:cloud-failed", localConfidence: local.confidence, cloudError: errorMessage(e) };
  }
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
