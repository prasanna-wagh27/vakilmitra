import { and, cases, inArray } from "@vakilmitra/db";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { db } from "../db.js";
import { visibleCase } from "../lib/access.js";
import { activityFor, activityQuery } from "../lib/activity.js";

/** The account's audit trail: who viewed or changed what, and sign-ins. */
export const activityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", { schema: { querystring: activityQuery } }, async (req) => {
    const { rows, hasMore } = await activityFor(req.advocateId, req.query);
    // Case names only for cases this advocate can still open (a junior loses them when unshared).
    const ids = [...new Set(rows.flatMap((r) => (r.caseId ? [r.caseId] : [])))];
    const titles = ids.length
      ? new Map(
          (
            await db
              .select({ id: cases.id, title: cases.title })
              .from(cases)
              .where(and(inArray(cases.id, ids), visibleCase(req.advocateId)))
          ).map((c) => [c.id, c.title]),
        )
      : new Map<string, string>();
    return {
      entries: rows.map(({ actorId, actorName, actorKind, details, ...r }) => ({
        ...r,
        caseTitle: (r.caseId && titles.get(r.caseId)) ?? null,
        actor: { id: actorId, name: actorName, isMe: actorId === req.advocateId, kind: actorKind },
        fields: Array.isArray(details?.fields) ? (details.fields as string[]) : null,
      })),
      hasMore,
    };
  });
};
