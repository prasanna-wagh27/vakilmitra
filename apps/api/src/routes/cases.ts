import {
  advocates,
  and,
  asc,
  caseAccess,
  cases,
  clients,
  count,
  desc,
  eq,
  flags,
  gte,
  hearings,
  ilike,
  inArray,
  or,
  ownershipEvents,
  parties,
  properties,
} from "@vakilmitra/db";
import { caseInput, caseListQuery, grantInput, istDayRange, partyInput } from "@vakilmitra/shared";
import { keys } from "@vakilmitra/storage";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { assertJuniorSeat } from "../billing/service.js";
import { db } from "../db.js";
import { logAccess, requireCaseAccess, requireCaseOwner, requireOwnClient, visibleCase } from "../lib/access.js";
import { forbidden, HttpError, likePattern, notFound } from "../lib/http.js";
import { getServices } from "../services.js";

const idParams = z.object({ id: z.string() });

export const caseRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", { schema: { querystring: caseListQuery } }, async (req) => {
    const { q, status } = req.query;
    const p = q ? likePattern(q) : null;
    const rows = await db.query.cases.findMany({
      where: and(
        visibleCase(req.advocateId),
        status ? eq(cases.status, status) : undefined,
        p
          ? or(
              ilike(cases.title, p),
              ilike(cases.caseNumber, p),
              ilike(cases.court, p),
              inArray(cases.clientId, db.select({ id: clients.id }).from(clients).where(ilike(clients.name, p))),
              inArray(cases.id, db.select({ id: parties.caseId }).from(parties).where(ilike(parties.name, p))),
            )
          : undefined,
      ),
      orderBy: desc(cases.updatedAt),
      with: { client: { columns: { id: true, name: true, phone: true } } },
    });
    const ids = rows.map((c) => c.id);
    if (ids.length === 0) return { cases: [] };

    const [next, flagCounts] = await Promise.all([
      db
        .selectDistinctOn([hearings.caseId])
        .from(hearings)
        .where(and(inArray(hearings.caseId, ids), gte(hearings.date, istDayRange().start)))
        .orderBy(hearings.caseId, asc(hearings.date)),
      db
        .select({ caseId: flags.caseId, n: count() })
        .from(flags)
        .where(and(inArray(flags.caseId, ids), eq(flags.resolved, false)))
        .groupBy(flags.caseId),
    ]);
    const nextMap = new Map(next.map((h) => [h.caseId, h]));
    const flagMap = new Map(flagCounts.map((f) => [f.caseId, f.n]));
    return {
      cases: rows.map(({ advocateId, ...c }) => ({
        ...c,
        shared: advocateId !== req.advocateId,
        nextHearing: nextMap.get(c.id) ?? null,
        openFlags: flagMap.get(c.id) ?? 0,
      })),
    };
  });

  app.post("/", { schema: { body: caseInput } }, async (req, reply) => {
    if (req.body.clientId) await requireOwnClient(req.advocateId, req.body.clientId);
    const [c] = await db
      .insert(cases)
      .values({ ...req.body, advocateId: req.advocateId })
      .returning();
    return reply.code(201).send({ case: c });
  });

  app.get("/:id", { schema: { params: idParams } }, async (req) => {
    const access = await requireCaseAccess(req.advocateId, req.params.id);
    const c = await db.query.cases.findFirst({
      where: eq(cases.id, req.params.id),
      with: {
        client: { columns: { id: true, name: true, phone: true } },
        parties: { orderBy: asc(parties.createdAt) },
        properties: { orderBy: asc(properties.createdAt) },
        hearings: { orderBy: desc(hearings.date) },
        flags: { where: eq(flags.resolved, false), orderBy: asc(flags.createdAt) },
        drafts: { columns: { id: true, title: true, status: true, language: true, updatedAt: true } },
        feeAgreements: { with: { payments: true, installments: true } },
        grants: { with: { advocate: { columns: { id: true, name: true, email: true } } } },
      },
    });
    if (!c) throw notFound("Case");
    const propIds = c.properties.map((p) => p.id);
    const eventCounts = propIds.length
      ? await db
          .select({ propertyId: ownershipEvents.propertyId, n: count() })
          .from(ownershipEvents)
          .where(inArray(ownershipEvents.propertyId, propIds))
          .groupBy(ownershipEvents.propertyId)
      : [];
    const evMap = new Map(eventCounts.map((e) => [e.propertyId, e.n]));
    await logAccess(req, "case.view", "case", c.id);
    const { advocateId: _owner, ...rest } = c;
    return {
      access,
      case: {
        ...rest,
        properties: c.properties.map((p) => ({ ...p, eventCount: evMap.get(p.id) ?? 0 })),
        // Only the owner sees who else has access.
        grants: access === "OWNER" ? c.grants : [],
        // Billing is the owner's business: juniors never see fees or payments.
        feeAgreements: access === "OWNER" ? c.feeAgreements : [],
      },
    };
  });

  app.patch("/:id", { schema: { params: idParams, body: caseInput.partial() } }, async (req) => {
    const access = await requireCaseAccess(req.advocateId, req.params.id, "write");
    if (req.body.clientId !== undefined) {
      const current = await db.query.cases.findFirst({ where: eq(cases.id, req.params.id), columns: { clientId: true, advocateId: true } });
      if (current && req.body.clientId !== current.clientId) {
        // Only the owner links a case to a client, and only to one of the owner's own clients.
        if (access !== "OWNER") throw forbidden("Only the owning advocate can change the client");
        if (req.body.clientId) await requireOwnClient(current.advocateId, req.body.clientId);
      }
    }
    const [c] = await db.update(cases).set(req.body).where(eq(cases.id, req.params.id)).returning();
    return { case: c };
  });

  /** One-tap delete of a case and everything in it. Owner only. */
  app.delete("/:id", { schema: { params: idParams } }, async (req, reply) => {
    await requireCaseOwner(req.advocateId, req.params.id);
    await db.delete(cases).where(eq(cases.id, req.params.id));
    // Delete scanned files after the rows: a failure here leaves unreachable ciphertext, never a dangling row.
    await getServices().storage.deletePrefix(keys.case(req.advocateId, req.params.id));
    await logAccess(req, "case.delete", "case", req.params.id);
    return reply.code(204).send();
  });

  // ---------- Parties ----------

  const partyParams = z.object({ id: z.string(), partyId: z.string() });

  app.post("/:id/parties", { schema: { params: idParams, body: partyInput } }, async (req, reply) => {
    await requireCaseAccess(req.advocateId, req.params.id, "write");
    const [party] = await db
      .insert(parties)
      .values({ ...req.body, caseId: req.params.id })
      .returning();
    return reply.code(201).send({ party });
  });

  app.patch("/:id/parties/:partyId", { schema: { params: partyParams, body: partyInput.partial() } }, async (req) => {
    await requireCaseAccess(req.advocateId, req.params.id, "write");
    const [party] = await db
      .update(parties)
      .set(req.body)
      .where(and(eq(parties.id, req.params.partyId), eq(parties.caseId, req.params.id)))
      .returning();
    if (!party) throw notFound("Party");
    return { party };
  });

  app.delete("/:id/parties/:partyId", { schema: { params: partyParams } }, async (req, reply) => {
    await requireCaseAccess(req.advocateId, req.params.id, "write");
    const gone = await db
      .delete(parties)
      .where(and(eq(parties.id, req.params.partyId), eq(parties.caseId, req.params.id)))
      .returning({ id: parties.id });
    if (!gone.length) throw notFound("Party");
    return reply.code(204).send();
  });

  // ---------- Sharing with juniors, case by case ----------

  app.post("/:id/grants", { schema: { params: idParams, body: grantInput } }, async (req, reply) => {
    await requireCaseOwner(req.advocateId, req.params.id);
    const junior = await db.query.advocates.findFirst({ where: eq(advocates.email, req.body.email), columns: { id: true } });
    if (!junior) throw notFound("Advocate with that email");
    if (junior.id === req.advocateId) throw new HttpError(400, "invalid_input", "You already own this case");
    await assertJuniorSeat(req.advocateId, junior.id);
    const [grant] = await db
      .insert(caseAccess)
      .values({ caseId: req.params.id, advocateId: junior.id, role: req.body.role })
      .onConflictDoUpdate({ target: [caseAccess.caseId, caseAccess.advocateId], set: { role: req.body.role } })
      .returning();
    await logAccess(req, "case.share", "case", req.params.id);
    return reply.code(201).send({ grant });
  });

  app.delete("/:id/grants/:grantId", { schema: { params: z.object({ id: z.string(), grantId: z.string() }) } }, async (req, reply) => {
    await requireCaseOwner(req.advocateId, req.params.id);
    const gone = await db
      .delete(caseAccess)
      .where(and(eq(caseAccess.id, req.params.grantId), eq(caseAccess.caseId, req.params.id)))
      .returning({ id: caseAccess.id });
    if (!gone.length) throw notFound("Grant");
    await logAccess(req, "case.unshare", "case", req.params.id);
    return reply.code(204).send();
  });
};
