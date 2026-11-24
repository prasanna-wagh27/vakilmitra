/** Turns "<provider>:<model id>" into a Vercel AI SDK model. Adding a provider is one case here. */
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createVertex } from "@ai-sdk/google-vertex";
import { createVertexAnthropic } from "@ai-sdk/google-vertex/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { ModelSpec, ProviderSettings } from "./config.js";

export function createModel(spec: ModelSpec, p: ProviderSettings): LanguageModel {
  const id = spec.model;
  switch (spec.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: p.ANTHROPIC_API_KEY })(id);
    case "openai":
      return createOpenAI({ apiKey: p.OPENAI_API_KEY })(id);
    case "google":
      return createGoogleGenerativeAI({ apiKey: p.GOOGLE_GENERATIVE_AI_API_KEY })(id);
    case "vertex":
      return createVertex({ project: p.GOOGLE_VERTEX_PROJECT, location: p.GOOGLE_VERTEX_LOCATION })(id);
    case "vertex-anthropic":
      // Claude served by Google Cloud, in the Vertex region set (Mumbai by default).
      return createVertexAnthropic({ project: p.GOOGLE_VERTEX_PROJECT, location: p.GOOGLE_VERTEX_LOCATION })(id);
    case "sarvam":
      // Sarvam's chat API follows the OpenAI format; the key goes in its own header.
      return createOpenAICompatible({
        name: "sarvam",
        baseURL: p.SARVAM_BASE_URL,
        headers: { "api-subscription-key": p.SARVAM_API_KEY ?? "" },
      })(id);
    case "compatible":
      return createOpenAICompatible({
        name: p.AI_COMPATIBLE_NAME,
        baseURL: p.AI_COMPATIBLE_BASE_URL ?? "",
        apiKey: p.AI_COMPATIBLE_API_KEY,
      })(id);
  }
}
