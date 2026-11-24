/**
 * The one door to AI models for every feature (drafting, translation, ...). Features never import a
 * provider SDK: they ask for a task's model here and use the Vercel AI SDK's generateText or
 * streamText with it, so the provider behind each task is a setting (see config.ts).
 *
 *   const ai = new Ai(aiConfigFromEnv(process.env));
 *   const { result, model } = await ai.run("translation", (m) => generateText({ model: m, prompt }));
 *
 * `run` tries the task's models in order and moves to the next one if a call fails (outage,
 * rate limit), and says which model answered, for the audit log.
 */
import type { LanguageModel, LanguageModelUsage, streamText as StreamText } from "ai";
import { type AiConfig, type AiTask, type DataLocation, dataLocation, type ModelSpec, specId } from "./config.js";
import { createModel } from "./providers.js";

// Features call the SDK through this package, so every app uses the same SDK version.
export { generateText, type LanguageModel, type LanguageModelUsage, streamText } from "ai";
export * from "./config.js";
export { createModel } from "./providers.js";

export class AiUnavailableError extends Error {
  override name = "AiUnavailableError";
  constructor(readonly task: AiTask) {
    super(`No AI model is set for ${task} (AI_MODEL_${task.toUpperCase()} or AI_MODEL_DEFAULT)`);
  }
}

/** Every model for the task failed; `errors` holds each model's error, in order. */
export class AiFailedError extends Error {
  override name = "AiFailedError";
  constructor(
    readonly task: AiTask,
    readonly errors: { model: string; error: unknown }[],
  ) {
    super(`All AI models for ${task} failed: ${errors.map((e) => `${e.model}: ${(e.error as Error)?.message ?? e.error}`).join("; ")}`);
  }
}

export interface ModelInfo {
  /** "<provider>:<model id>", as written in the settings. */
  id: string;
  dataLocation: DataLocation;
}

export class Ai {
  private readonly cache = new Map<string, LanguageModel>();

  constructor(
    private readonly cfg: AiConfig,
    /** How a setting becomes a model; tests pass mock models here. */
    private readonly resolve: (spec: ModelSpec) => LanguageModel = (spec) => createModel(spec, cfg.providers),
  ) {}

  enabled(task: AiTask) {
    return this.cfg.tasks[task].length > 0;
  }

  /** The task's models in the order they are tried, with where each processes data. */
  models(task: AiTask): ModelInfo[] {
    return this.cfg.tasks[task].map((s) => ({ id: specId(s), dataLocation: dataLocation(s, this.cfg.providers) }));
  }

  private modelFor(spec: ModelSpec) {
    const id = specId(spec);
    let m = this.cache.get(id);
    if (!m) {
      m = this.resolve(spec);
      this.cache.set(id, m);
    }
    return m;
  }

  /** The task's first model, for streaming (a stream cannot move to another model halfway). */
  model(task: AiTask): { model: LanguageModel; info: ModelInfo } {
    const spec = this.cfg.tasks[task][0];
    if (!spec) throw new AiUnavailableError(task);
    return { model: this.modelFor(spec), info: this.models(task)[0]! };
  }

  /**
   * Streams from the task's models: a model that fails before writing anything (outage, rate
   * limit) is skipped for the next one; once text has started, the stream stays on that model.
   * `start` calls streamText with the model given.
   */
  async stream(task: AiTask, start: (model: LanguageModel, info: ModelInfo) => StreamResult): Promise<AiStream> {
    return this.run(task, async (model, info) => {
      const result = start(model, info);
      const parts = textParts(result)[Symbol.asyncIterator]();
      const first = await parts.next(); // throws if the model failed before any text
      async function* text() {
        if (!first.done) yield first.value;
        for (let p = await parts.next(); !p.done; p = await parts.next()) yield p.value;
      }
      return { text: text(), usage: result.usage, model: info };
    }).then((r) => r.result);
  }

  /** Calls `fn` with each of the task's models in turn until one succeeds. A cancelled call is not retried. */
  async run<T>(task: AiTask, fn: (model: LanguageModel, info: ModelInfo) => Promise<T>): Promise<{ result: T; model: ModelInfo }> {
    const specs = this.cfg.tasks[task];
    if (!specs.length) throw new AiUnavailableError(task);
    const errors: { model: string; error: unknown }[] = [];
    for (const [i, spec] of specs.entries()) {
      const info = this.models(task)[i]!;
      try {
        return { result: await fn(this.modelFor(spec), info), model: info };
      } catch (error) {
        if ((error as Error)?.name === "AbortError") throw error;
        errors.push({ model: info.id, error });
      }
    }
    throw new AiFailedError(task, errors);
  }
}

type StreamResult = ReturnType<typeof StreamText>;

export interface AiStream {
  /** The text as it is written. Throws if the model fails partway. */
  text: AsyncGenerator<string>;
  /** Token counts, once the stream has finished. */
  usage: PromiseLike<LanguageModelUsage>;
  model: ModelInfo;
}

/** The text of a stream, throwing the model's error (the SDK's textStream just ends on one). */
async function* textParts(result: StreamResult): AsyncGenerator<string> {
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") yield part.text;
    else if (part.type === "error") throw part.error;
    else if (part.type === "abort") throw Object.assign(new Error("The AI request was cancelled"), { name: "AbortError" });
  }
}
