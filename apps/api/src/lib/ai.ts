/**
 * The rules every AI feature follows before and after client text goes to a model:
 * the task is set up, the case owner allowed AI (their clients' data), the owner's plan has room,
 * and each call is counted (ai_usage, no text) and named in the audit entry (model, where it ran).
 */
import * as Sentry from "@sentry/node";
import {
  AiFailedError,
  type AiTask,
  AiUnavailableError,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelInfo,
} from "@vakilmitra/ai";
import { advocates, aiUsage, eq } from "@vakilmitra/db";
import type { FastifyRequest } from "fastify";
import { assertAiQuota } from "../billing/service.js";
import { db } from "../db.js";
import { ai } from "../services.js";
import { HttpError } from "./http.js";

const aiOff = () => new HttpError(503, "ai_off", "AI is not set up yet");

/** Throws unless `ownerId`'s client text may go to the task's models now. */
export async function assertAiAllowed(req: FastifyRequest, task: AiTask, ownerId: string) {
  if (!ai().enabled(task)) throw aiOff();
  const owner = await db.query.advocates.findFirst({ where: eq(advocates.id, ownerId), columns: { aiConsent: true } });
  if (!owner?.aiConsent) {
    const yours = ownerId === req.advocateId;
    throw new HttpError(
      403,
      "ai_consent_required",
      yours ? "Allow AI in Settings first" : "The case owner has not allowed AI for their cases",
      { yours },
    );
  }
  await assertAiQuota(ownerId);
}

/**
 * Runs `fn` on the task's models (next model on failure), then records the call against `ownerId`.
 * `fn` returns the SDK result's usage alongside its value.
 */
export async function runAi<T>(
  req: FastifyRequest,
  task: AiTask,
  ownerId: string,
  fn: (model: LanguageModel, info: ModelInfo) => Promise<{ value: T; usage?: LanguageModelUsage }>,
): Promise<{ value: T; model: ModelInfo }> {
  try {
    const { result, model } = await ai().run(task, fn);
    await recordAiUse(req, task, ownerId, model, result.usage);
    return { value: result.value, model };
  } catch (err) {
    throw aiHttpError(req, err);
  }
}

/** Counts one call and names the model in this request's audit entry. */
export async function recordAiUse(req: FastifyRequest, task: AiTask, ownerId: string, model: ModelInfo, usage?: LanguageModelUsage) {
  noteAiModel(req, model);
  await countAiUse(req.advocateId, task, ownerId, model, usage);
}

/** Names the model and where it processed the data in this request's audit entry. */
export function noteAiModel(req: FastifyRequest, model: ModelInfo) {
  req.audit.details = { ...req.audit.details, model: model.id, dataLocation: model.dataLocation };
}

/** One ai_usage row (no text), charged to the account that owns the case. */
export async function countAiUse(advocateId: string, task: AiTask, ownerId: string, model: ModelInfo, usage?: LanguageModelUsage) {
  await db.insert(aiUsage).values({
    ownerId,
    advocateId,
    task,
    model: model.id,
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
  });
}

/** Maps the AI package's errors to answers; anything else is rethrown as is. */
export function aiHttpError(req: FastifyRequest, err: unknown) {
  if (err instanceof AiUnavailableError) return aiOff();
  if (err instanceof AiFailedError) return aiFailed(req, err);
  return err;
}

/** Every model failed: report it (model ids and error kinds only, never text) and answer 502. */
export function aiFailed(req: FastifyRequest, err: AiFailedError) {
  req.log.error({ task: err.task, models: err.errors.map((e) => e.model) }, "AI models failed");
  Sentry.withScope((scope) => {
    scope.setTag("route", req.routeOptions.url ?? "unknown");
    scope.setTag("ai_task", err.task);
    scope.setContext("ai", {
      attempts: err.errors.map((e) => ({
        model: e.model,
        error: (e.error as Error)?.name,
        status: (e.error as { statusCode?: number })?.statusCode,
      })),
    });
    Sentry.captureMessage(`All AI models failed for ${err.task}`, "error");
  });
  return new HttpError(502, "ai_failed", "The AI service did not answer. Try again in a minute.");
}
