/**
 * Case tracking on eCourts: turn it on for a case (by its CNR), read where it stands, ask for a
 * fresh reading, and list recent court changes across the advocate's cases. The readings
 * themselves happen in the worker (apps/worker/src/court-check.ts).
 */
import { and, cases, caseTracking, count, courtUpdates, desc, eq, gte, inArray } from "@vakilmitra/db";
import { enqueueCaseCheck } from "@vakilmitra/jobs";
import {
  type CaseTracking,
  type CaseTrackingResponse,
  type CourtCase,
  type CourtChange,
  courtUpdatesQuery,
  normalizeCnr,
  PLANS,
  trackingInput,
} from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ensureSubscription } from "../billing/service.js";
import { db } from "../db.js";
import { courtsAvailable } from "../env.js";
import { logAccess, requireCaseAccess, visibleCase } from "../lib/access.js";
import { HttpError } from "../lib/http.js";
import { courtsQueue } from "../services.js";

const params = z.object({ id: z.string() });
/** A fresh reading by hand at most this often per case: each one is a paid lookup. */
export const REFRESH_EVERY_MS = 15 * 60_000;

const unavailable = () =>
  new HttpError(503, "tracking_unavailable", "Case tracking is not switched on yet. Your diary dates still work as before.");

type Row = typeof caseTracking.$inferSelect;
const view = (t: Row): CaseTracking => ({
  cnr: t.cnr,
  status: t.status as CaseTracking["status"],
  error: t.error,
  snapshot: t.snapshot as unknown as CourtCase | null,
  lastCheckedAt: t.lastCheckedAt?.toISOString() ?? null,
  createdAt: t.createdAt.toISOString(),
});

async function trackedCount(ownerId: string) {
  const [r] = await db
    .select({ n: count() })
    .from(caseTracking)
    .innerJoin(cases, eq(cases.id, caseTracking.caseId))
    .where(eq(cases.advocateId, ownerId));
  return r?.n ?? 0;
}

export const trackingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/cases/:id/tracking", { schema: { params } }, async (req): Promise<CaseTrackingResponse> => {
    await requireCaseAccess(req.advocateId, req.params.id);
    const [t, updates] = await Promise.all([
      db.query.caseTracking.findFirst({ where: eq(caseTracking.caseId, req.params.id) }),
      db.query.courtUpdates.findMany({ where: eq(courtUpdates.caseId, req.params.id), orderBy: desc(courtUpdates.createdAt), limit: 20 }),
    ]);
    return {
      available: courtsAvailable(),
      tracking: t ? view(t) : null,
      updates: updates.map((u) => ({
        id: u.id,
        caseId: u.caseId,
        change: u.detail as unknown as CourtChange,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });

  /** Turn tracking on (or change the CNR). The first reading is queued at once. */
  app.put("/cases/:id/tracking", { schema: { params, body: trackingInput } }, async (req) => {
    if (!courtsAvailable()) throw unavailable();
    await requireCaseAccess(req.advocateId, req.params.id, "write");
    const c = await db.query.cases.findFirst({ where: eq(cases.id, req.params.id), columns: { advocateId: true, cnrNumber: true } });
    const cnr = normalizeCnr(req.body.cnr || c?.cnrNumber);
    if (!c || !cnr) throw new HttpError(400, "cnr_required", "Enter the case's CNR number (16 characters, like MHPU010012342024).");

    const existing = await db.query.caseTracking.findFirst({ where: eq(caseTracking.caseId, req.params.id) });
    if (!existing) {
      // Charged to the account that owns the case, like its pages.
      const { limits } = PLANS[(await ensureSubscription(c.advocateId)).plan];
      if ((await trackedCount(c.advocateId)) + 1 > limits.trackedCases) {
        throw new HttpError(
          402,
          "plan_limit",
          "All case tracking places on the plan are in use. Stop tracking a closed case, or upgrade.",
          {
            limit: "trackedCases",
            max: limits.trackedCases,
          },
        );
      }
    }
    const fresh = { cnr, status: "PENDING", error: null, failures: 0, snapshot: null, lastCheckedAt: null, lastChangedAt: null };
    const [t] = await db.transaction(async (tx) => {
      await tx.update(cases).set({ cnrNumber: cnr }).where(eq(cases.id, req.params.id));
      // Same CNR again: keep the readings. A new CNR starts over.
      if (existing?.cnr === cnr) return [existing];
      return existing
        ? tx.update(caseTracking).set(fresh).where(eq(caseTracking.caseId, req.params.id)).returning()
        : tx
            .insert(caseTracking)
            .values({ caseId: req.params.id, enabledById: req.advocateId, ...fresh })
            .returning();
    });
    if (t.status === "PENDING") await enqueueCaseCheck(courtsQueue(), req.params.id);
    logAccess(req, "case.tracking_on", "case", req.params.id);
    return { tracking: view(t) };
  });

  app.delete("/cases/:id/tracking", { schema: { params } }, async (req, reply) => {
    await requireCaseAccess(req.advocateId, req.params.id, "write");
    await db.delete(caseTracking).where(eq(caseTracking.caseId, req.params.id));
    logAccess(req, "case.tracking_off", "case", req.params.id);
    return reply.code(204).send();
  });

  /** Ask for a fresh reading now (at most every 15 minutes per case). */
  app.post("/cases/:id/tracking/refresh", { schema: { params } }, async (req, reply) => {
    if (!courtsAvailable()) throw unavailable();
    await requireCaseAccess(req.advocateId, req.params.id, "write");
    const t = await db.query.caseTracking.findFirst({ where: eq(caseTracking.caseId, req.params.id) });
    if (!t) throw new HttpError(404, "not_found", "This case is not tracked");
    const wait = t.lastCheckedAt ? t.lastCheckedAt.getTime() + REFRESH_EVERY_MS - Date.now() : 0;
    if (wait > 0) {
      throw new HttpError(429, "too_soon", "Checked a few minutes ago. Try again a little later.", {
        retryAfterSeconds: Math.ceil(wait / 1000),
      });
    }
    await enqueueCaseCheck(courtsQueue(), req.params.id);
    return reply.code(202).send({ queued: true });
  });

  /** Court changes on the advocate's cases (own and shared) in the last few days, newest first. */
  app.get("/court-updates", { schema: { querystring: courtUpdatesQuery } }, async (req) => {
    const since = new Date(Date.now() - req.query.days * 86_400_000);
    const rows = await db.query.courtUpdates.findMany({
      where: and(
        gte(courtUpdates.createdAt, since),
        inArray(courtUpdates.caseId, db.select({ id: cases.id }).from(cases).where(visibleCase(req.advocateId))),
      ),
      orderBy: desc(courtUpdates.createdAt),
      limit: 100,
      with: { case: { columns: { id: true, title: true, caseNumber: true, court: true } } },
    });
    return {
      available: courtsAvailable(),
      updates: rows.map((u) => ({
        id: u.id,
        caseId: u.caseId,
        change: u.detail as unknown as CourtChange,
        createdAt: u.createdAt.toISOString(),
        case: u.case,
      })),
    };
  });
};
