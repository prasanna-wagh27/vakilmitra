/**
 * Which model does which job, read from settings so a provider can be changed without a code change.
 *
 *   AI_MODEL_DRAFTING=anthropic:claude-sonnet-5-5
 *   AI_MODEL_TRANSLATION=sarvam:<model id>,vertex:gemini-3.5-flash   (tried in order)
 *   AI_MODEL_DEFAULT=vertex:gemini-3.5-flash                          (for any task not set)
 *
 * A model is "<provider>:<model id>". Providers: anthropic, openai, google, vertex,
 * vertex-anthropic, sarvam and compatible (any OpenAI-compatible endpoint). AI_INDIA_ONLY=true
 * refuses, at start-up, any model whose data would be processed outside India.
 */
import { z } from "zod";

export const AI_TASKS = ["drafting", "translation"] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const PROVIDERS = ["anthropic", "openai", "google", "vertex", "vertex-anthropic", "sarvam", "compatible"] as const;
export type ProviderId = (typeof PROVIDERS)[number];

export interface ModelSpec {
  provider: ProviderId;
  model: string;
}

export type DataLocation = "india" | "abroad" | "unknown";

export class AiConfigError extends Error {
  override name = "AiConfigError";
}

const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

const envSchema = z.object({
  AI_MODEL_DEFAULT: optional,
  AI_MODEL_DRAFTING: optional,
  AI_MODEL_TRANSLATION: optional,
  AI_INDIA_ONLY: z.preprocess((v) => (v === "" ? undefined : v), z.stringbool().default(false)),
  ANTHROPIC_API_KEY: optional,
  OPENAI_API_KEY: optional,
  GOOGLE_GENERATIVE_AI_API_KEY: optional,
  // Vertex AI signs in with Google Application Default Credentials.
  GOOGLE_VERTEX_PROJECT: optional,
  GOOGLE_VERTEX_LOCATION: z.preprocess((v) => (v === "" ? undefined : v), z.string().default("asia-south1")),
  SARVAM_API_KEY: optional,
  SARVAM_BASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().default("https://api.sarvam.ai/v1")),
  // Any OpenAI-compatible endpoint (Azure OpenAI's v1 API, a self-hosted model, another Indian provider).
  AI_COMPATIBLE_BASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
  AI_COMPATIBLE_API_KEY: optional,
  AI_COMPATIBLE_NAME: z.preprocess((v) => (v === "" ? undefined : v), z.string().default("compatible")),
  AI_COMPATIBLE_IN_INDIA: z.preprocess((v) => (v === "" ? undefined : v), z.stringbool().default(false)),
});

export type ProviderSettings = z.infer<typeof envSchema>;

export interface AiConfig {
  /** Models for each task, in the order to try them; empty means the task is off. */
  tasks: Record<AiTask, ModelSpec[]>;
  indiaOnly: boolean;
  providers: ProviderSettings;
}

export function parseModelSpec(s: string): ModelSpec {
  const i = s.indexOf(":");
  const provider = s.slice(0, i).trim();
  const model = s.slice(i + 1).trim();
  if (i < 1 || !model) throw new AiConfigError(`"${s}" is not a model: write it as <provider>:<model id>`);
  if (!(PROVIDERS as readonly string[]).includes(provider)) {
    throw new AiConfigError(`Unknown AI provider "${provider}" in "${s}". Known: ${PROVIDERS.join(", ")}`);
  }
  return { provider: provider as ProviderId, model };
}

export const specId = (s: ModelSpec) => `${s.provider}:${s.model}`;

/** Where a provider processes what we send it, as far as our settings decide it. */
export function dataLocation(
  spec: ModelSpec,
  p: Pick<ProviderSettings, "GOOGLE_VERTEX_LOCATION" | "AI_COMPATIBLE_IN_INDIA">,
): DataLocation {
  switch (spec.provider) {
    case "sarvam":
      return "india";
    case "vertex":
    case "vertex-anthropic":
      return p.GOOGLE_VERTEX_LOCATION.startsWith("asia-south") ? "india" : "abroad";
    case "compatible":
      return p.AI_COMPATIBLE_IN_INDIA ? "india" : "unknown";
    default:
      return "abroad";
  }
}

/** The setting each provider cannot work without. */
function missingSetting(provider: ProviderId, p: ProviderSettings): string | null {
  switch (provider) {
    case "anthropic":
      return p.ANTHROPIC_API_KEY ? null : "ANTHROPIC_API_KEY";
    case "openai":
      return p.OPENAI_API_KEY ? null : "OPENAI_API_KEY";
    case "google":
      return p.GOOGLE_GENERATIVE_AI_API_KEY ? null : "GOOGLE_GENERATIVE_AI_API_KEY";
    case "vertex":
    case "vertex-anthropic":
      return p.GOOGLE_VERTEX_PROJECT ? null : "GOOGLE_VERTEX_PROJECT";
    case "sarvam":
      return p.SARVAM_API_KEY ? null : "SARVAM_API_KEY";
    case "compatible":
      return p.AI_COMPATIBLE_BASE_URL ? null : "AI_COMPATIBLE_BASE_URL";
  }
}

/** Reads and checks the AI settings; throws AiConfigError with a plain message when they cannot work. */
export function aiConfigFromEnv(env: Record<string, string | undefined>): AiConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) throw new AiConfigError(`Invalid AI settings: ${z.prettifyError(parsed.error)}`);
  const p = parsed.data;
  const list = (v: string | undefined) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(parseModelSpec);
  const fallback = list(p.AI_MODEL_DEFAULT);
  const tasks = {
    drafting: p.AI_MODEL_DRAFTING ? list(p.AI_MODEL_DRAFTING) : fallback,
    translation: p.AI_MODEL_TRANSLATION ? list(p.AI_MODEL_TRANSLATION) : fallback,
  } satisfies Record<AiTask, ModelSpec[]>;

  for (const spec of Object.values(tasks).flat()) {
    const missing = missingSetting(spec.provider, p);
    if (missing) throw new AiConfigError(`${specId(spec)} needs ${missing}`);
    if (p.AI_INDIA_ONLY && dataLocation(spec, p) !== "india") {
      throw new AiConfigError(`AI_INDIA_ONLY is on, but ${specId(spec)} may process data outside India`);
    }
  }
  return { tasks, indiaOnly: p.AI_INDIA_ONLY, providers: p };
}
