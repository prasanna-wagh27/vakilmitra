import { and, asc, eq, flags, ownershipEvents, properties } from "@vakilmitra/db";
import { checkQuery, eventInput, flagUpdateInput, propertyInput } from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db.js";
import { type ChainEvent, runRules } from "../land/rules.js";
import { requireCaseAccess } from "../lib/access.js";
import { notFound } from "../lib/http.js";

const caseParams = z.object({ caseId: z.string() });
const propParams = z.object({ caseId: z.string(), propertyId: z.string() });
const eventParams = propParams.extend({ eventId: z.string() });

async function propertyInCase(caseId: string, propertyId: string) {
  const p = await db.query.properties.findFirst({ where: and(eq(properties.id, propertyId), eq(properties.caseId, caseId)) });
  if (!p) throw notFound("Property");
  return p;
}

/** Properties, their ownership chain, and the deterministic red-flag check. */
export const landRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post("/cases/:caseId/properties", { schema: { params: caseParams, body: propertyInput } }, async (req, reply) => {
    await requireCaseAccess(req.advocateId, req.params.caseId, "write");
    const [property] = await db
      .insert(properties)
      .values({ ...req.body, caseId: req.params.caseId })
      .returning();
    return reply.code(201).send({ property });
  });

  app.get("/cases/:caseId/properties/:propertyId", { schema: { params: propParams } }, async (req) => {
    await requireCaseAccess(req.advocateId, req.params.caseId);
    await propertyInCase(req.params.caseId, req.params.propertyId);
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, req.params.propertyId),
      with: {
        events: { orderBy: asc(ownershipEvents.date) },
        flags: { orderBy: [asc(flags.resolved), asc(flags.createdAt)] },
      },
    });
    return { property };
  });

  app.patch("/cases/:caseId/properties/:propertyId", { schema: { params: propParams, body: propertyInput.partial() } }, async (req) => {
    await requireCaseAccess(req.advocateId, req.params.caseId, "write");
    await propertyInCase(req.params.caseId, req.params.propertyId);
    const [property] = await db.update(properties).set(req.body).where(eq(properties.id, req.params.propertyId)).returning();
    return { property };
  });

  app.delete("/cases/:caseId/properties/:propertyId", { schema: { params: propParams } }, async (req, reply) => {
    await requireCaseAccess(req.advocateId, req.params.caseId, "write");
    await propertyInCase(req.params.caseId, req.params.propertyId);
    await db.delete(properties).where(eq(properties.id, req.params.propertyId));
    return reply.code(204).send();
  });

  app.post("/cases/:caseId/properties/:propertyId/events", { schema: { params: propParams, body: eventInput } }, async (req, reply) => {
    await requireCaseAccess(req.advocateId, req.params.caseId, "write");
    await propertyInCase(req.params.caseId, req.params.propertyId);
    const [event] = await db
      .insert(ownershipEvents)
      .values({ ...req.body, propertyId: req.params.propertyId })
      .returning();
    return reply.code(201).send({ event });
  });

  app.patch(
    "/cases/:caseId/properties/:propertyId/events/:eventId",
    { schema: { params: eventParams, body: eventInput.partial() } },
    async (req) => {
      await requireCaseAccess(req.advocateId, req.params.caseId, "write");
      await propertyInCase(req.params.caseId, req.params.propertyId);
      const [event] = await db
        .update(ownershipEvents)
        .set(req.body)
        .where(and(eq(ownershipEvents.id, req.params.eventId), eq(ownershipEvents.propertyId, req.params.propertyId)))
        .returning();
      if (!event) throw notFound("Event");
      return { event };
    },
  );

  app.delete("/cases/:caseId/properties/:propertyId/events/:eventId", { schema: { params: eventParams } }, async (req, reply) => {
    await requireCaseAccess(req.advocateId, req.params.caseId, "write");
    await propertyInCase(req.params.caseId, req.params.propertyId);
    const gone = await db
      .delete(ownershipEvents)
      .where(and(eq(ownershipEvents.id, req.params.eventId), eq(ownershipEvents.propertyId, req.params.propertyId)))
      .returning({ id: ownershipEvents.id });
    if (!gone.length) throw notFound("Event");
    return reply.code(204).send();
  });

  /**
   * Run the rules over the property's chain. Open flags are replaced with the fresh result;
   * flags the advocate already resolved stay resolved if the same rule fires on the same events.
   */
  app.post("/cases/:caseId/properties/:propertyId/check", { schema: { params: propParams, querystring: checkQuery } }, async (req) => {
    const { caseId, propertyId } = req.params;
    await requireCaseAccess(req.advocateId, caseId, "write");
    await propertyInCase(caseId, propertyId);
    const locale = req.query.lang ?? "mr";
    const events = await db.query.ownershipEvents.findMany({ where: eq(ownershipEvents.propertyId, propertyId) });
    const results = runRules(events as ChainEvent[], { asOf: new Date() });

    const sig = (rule: string, eventIds: string[]) => `${rule}|${[...eventIds].sort().join(",")}`;
    const resolved = await db.query.flags.findMany({ where: and(eq(flags.propertyId, propertyId), eq(flags.resolved, true)) });
    const resolvedSigs = new Set(resolved.map((f) => sig(f.rule, f.eventIds)));
    const fresh = results.filter((r) => !resolvedSigs.has(sig(r.rule, r.eventIds)));

    const all = await db.transaction(async (tx) => {
      await tx.delete(flags).where(and(eq(flags.propertyId, propertyId), eq(flags.resolved, false)));
      if (fresh.length) {
        await tx.insert(flags).values(
          fresh.map((r) => ({
            caseId,
            propertyId,
            rule: r.rule,
            severity: r.severity,
            message: r.message[locale],
            eventIds: r.eventIds,
            factIds: r.factIds,
          })),
        );
      }
      return tx.query.flags.findMany({ where: eq(flags.propertyId, propertyId), orderBy: [asc(flags.resolved), asc(flags.createdAt)] });
    });
    return { flags: all, ranAt: new Date(), eventCount: events.length };
  });

  app.patch(
    "/cases/:caseId/flags/:flagId",
    { schema: { params: z.object({ caseId: z.string(), flagId: z.string() }), body: flagUpdateInput } },
    async (req) => {
      await requireCaseAccess(req.advocateId, req.params.caseId, "write");
      const [flag] = await db
        .update(flags)
        .set(req.body)
        .where(and(eq(flags.id, req.params.flagId), eq(flags.caseId, req.params.caseId)))
        .returning();
      if (!flag) throw notFound("Flag");
      return { flag };
    },
  );
};
