import { AI_TASKS } from "@vakilmitra/ai";
import type { AiStatus } from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { ai } from "../services.js";

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Which AI tasks are set up and where their models process data, shown before the advocate consents. */
  app.get("/", async (req) => {
    req.audit.skip = true;
    const status = Object.fromEntries(
      AI_TASKS.map((t) => [t, { enabled: ai().enabled(t), models: ai().models(t) }]),
    ) as unknown as AiStatus;
    return { ai: status };
  });
};
