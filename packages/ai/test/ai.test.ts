import { generateText, type LanguageModel, Output } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  Ai,
  AiConfigError,
  AiFailedError,
  AiUnavailableError,
  aiConfigFromEnv,
  createModel,
  dataLocation,
  parseModelSpec,
} from "../src/index.js";

const usage = {
  inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};
const answering = (text: string, modelId = "mock") =>
  new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({ content: [{ type: "text", text }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] }),
  });
const failing = (message: string) =>
  new MockLanguageModelV4({
    doGenerate: async () => {
      throw new Error(message);
    },
  });

describe("settings", () => {
  it("gives each task its own models, tried in order, with the default for the rest", () => {
    const cfg = aiConfigFromEnv({
      AI_MODEL_DEFAULT: "vertex:gemini-3.5-flash",
      AI_MODEL_TRANSLATION: "sarvam:sarvam-translate, anthropic:claude-sonnet-5-5",
      GOOGLE_VERTEX_PROJECT: "p",
      SARVAM_API_KEY: "s",
      ANTHROPIC_API_KEY: "a",
    });
    expect(cfg.tasks.drafting).toEqual([{ provider: "vertex", model: "gemini-3.5-flash" }]);
    expect(cfg.tasks.translation).toEqual([
      { provider: "sarvam", model: "sarvam-translate" },
      { provider: "anthropic", model: "claude-sonnet-5-5" },
    ]);
  });

  it("leaves every task off when nothing is set", () => {
    const ai = new Ai(aiConfigFromEnv({}));
    expect(ai.enabled("drafting")).toBe(false);
    expect(() => ai.model("drafting")).toThrow(AiUnavailableError);
  });

  it("explains a bad model setting or a missing key at start-up", () => {
    expect(() => parseModelSpec("claude-sonnet")).toThrow(/<provider>:<model id>/);
    expect(() => parseModelSpec("acme:big")).toThrow(/Unknown AI provider "acme"/);
    expect(() => aiConfigFromEnv({ AI_MODEL_DRAFTING: "openai:gpt-5" })).toThrow(/needs OPENAI_API_KEY/);
    expect(() => aiConfigFromEnv({ AI_MODEL_DRAFTING: "compatible:llama" })).toThrow(AiConfigError);
  });

  it("knows where each provider processes data, and India-only refuses the rest", () => {
    const p = { GOOGLE_VERTEX_LOCATION: "asia-south1", AI_COMPATIBLE_IN_INDIA: false };
    expect(dataLocation(parseModelSpec("sarvam:m"), p)).toBe("india");
    expect(dataLocation(parseModelSpec("vertex-anthropic:claude-sonnet-5-5"), p)).toBe("india");
    expect(dataLocation(parseModelSpec("vertex:gemini"), { ...p, GOOGLE_VERTEX_LOCATION: "us-central1" })).toBe("abroad");
    expect(dataLocation(parseModelSpec("openai:gpt-5"), p)).toBe("abroad");
    expect(dataLocation(parseModelSpec("compatible:x"), p)).toBe("unknown");
    const india = { AI_INDIA_ONLY: "true", SARVAM_API_KEY: "s", ANTHROPIC_API_KEY: "a" };
    expect(() => aiConfigFromEnv({ ...india, AI_MODEL_DRAFTING: "sarvam:m" })).not.toThrow();
    expect(() => aiConfigFromEnv({ ...india, AI_MODEL_DRAFTING: "anthropic:claude-sonnet-5-5" })).toThrow(/outside India/);
  });

  it("builds a model for every provider without calling it", () => {
    const cfg = aiConfigFromEnv({
      ANTHROPIC_API_KEY: "a",
      OPENAI_API_KEY: "o",
      GOOGLE_GENERATIVE_AI_API_KEY: "g",
      GOOGLE_VERTEX_PROJECT: "p",
      SARVAM_API_KEY: "s",
      AI_COMPATIBLE_BASE_URL: "https://llm.example.in/v1",
    });
    const made = (s: string) => createModel(parseModelSpec(s), cfg.providers) as Exclude<LanguageModel, string>;
    expect(made("anthropic:claude-sonnet-5-5").provider).toMatch(/^anthropic/);
    expect(made("openai:gpt-5").provider).toMatch(/^openai/);
    expect(made("google:gemini-3.5-flash").provider).toMatch(/^google/);
    expect(made("vertex:gemini-3.5-flash").provider).toMatch(/vertex/i);
    expect(made("vertex-anthropic:claude-sonnet-5-5").provider).toMatch(/vertex.*anthropic/i);
    expect(made("sarvam:sarvam-m")).toMatchObject({ modelId: "sarvam-m" });
    expect(made("sarvam:sarvam-m").provider).toMatch(/^sarvam/);
    expect(made("compatible:llama").provider).toMatch(/^compatible/);
  });
});

describe("running a task", () => {
  const env = { AI_MODEL_TRANSLATION: "sarvam:first,anthropic:second", SARVAM_API_KEY: "s", ANTHROPIC_API_KEY: "a" };

  it("answers with the first model and says which one", async () => {
    const ai = new Ai(aiConfigFromEnv(env), (s) => answering(`from ${s.model}`));
    const { result, model } = await ai.run("translation", (m) => generateText({ model: m, prompt: "नमस्कार" }));
    expect(result.text).toBe("from first");
    expect(model).toEqual({ id: "sarvam:first", dataLocation: "india" });
  });

  it("moves to the next model when one fails, and reports all failures if every one does", async () => {
    const ai = new Ai(aiConfigFromEnv(env), (s) => (s.model === "first" ? failing("rate limited") : answering("from second")));
    const { result, model } = await ai.run("translation", (m) => generateText({ model: m, prompt: "x", maxRetries: 0 }));
    expect(result.text).toBe("from second");
    expect(model.id).toBe("anthropic:second");

    const down = new Ai(aiConfigFromEnv(env), (s) => failing(`${s.model} down`));
    const err = await down.run("translation", (m) => generateText({ model: m, prompt: "x", maxRetries: 0 })).catch((e) => e);
    expect(err).toBeInstanceOf(AiFailedError);
    expect((err as AiFailedError).errors.map((e) => e.model)).toEqual(["sarvam:first", "anthropic:second"]);
  });

  it("works with structured output the same way for any provider", async () => {
    const ai = new Ai(aiConfigFromEnv(env), () => answering(JSON.stringify({ marathi: "सातबारा" })));
    const { result } = await ai.run("translation", (m) =>
      generateText({ model: m, prompt: "7/12", output: Output.object({ schema: z.object({ marathi: z.string() }) }) }),
    );
    expect(result.output).toEqual({ marathi: "सातबारा" });
  });
});
