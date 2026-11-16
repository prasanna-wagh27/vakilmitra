import { and, asc, cases, desc, eq, exists, gte, hearings, inArray, lt, not } from "@vakilmitra/db";
import { addDays, dayQuery, hearingInput, hearingUpdateInput, istDate, istDayRange, rangeQuery } from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db.js";
import { requireCaseAccess, visibleCase } from "../lib/access.js";
import { notFound } from "../lib/http.js";

const caseRef = {
  columns: { id: true, title: true, caseNumber: true, court: true, status: true },
  with: { client: { columns: { id: true, name: true, phone: true } } },
} as const;

/** Hearings on the advocate's visible cases within [start, end). */
function hearingsBetween(advocateId: string, start: Date, end: Date) {
  return db.query.hearings.findMany({
    where: and(
      gte(hearings.date, start),
      lt(hearings.date, end),
      inArray(hearings.caseId, db.select({ id: cases.id }).from(cases).where(visibleCase(advocateId))),
    ),
    orderBy: [asc(hearings.court), asc(hearings.date)],
    with: { case: caseRef },
  });
}

/** Case diary: hearing dates, next steps and the daily board. */
export const diaryRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Daily board: everything listed on one IST day, plus active cases that have no next date. */
  app.get("/diary/board", { schema: { querystring: dayQuery } }, async (req) => {
    const day = req.query.date ?? istDate();
    const { start, end } = istDayRange(day);
    const todayStart = istDayRange().start;
    const listed = await hearingsBetween(req.advocateId, start, end);

    const hearingOn = (cmp: typeof lt) =>
      exists(
        db
          .select({ id: hearings.id })
          .from(hearings)
          .where(and(eq(hearings.caseId, cases.id), cmp(hearings.date, todayStart))),
      );
    const stale = await db
      .select({ id: cases.id, title: cases.title, caseNumber: cases.caseNumber, court: cases.court })
      .from(cases)
      // Every active case with no upcoming hearing, including new cases that never had one.
      .where(and(visibleCase(req.advocateId), eq(cases.status, "ACTIVE"), not(hearingOn(gte))));
    const last = stale.length
      ? await db
          .selectDistinctOn([hearings.caseId], { caseId: hearings.caseId, date: hearings.date, purpose: hearings.purpose })
          .from(hearings)
          .where(
            inArray(
              hearings.caseId,
              stale.map((s) => s.id),
            ),
          )
          .orderBy(hearings.caseId, desc(hearings.date))
      : [];
    const lastMap = new Map(last.map((l) => [l.caseId, { date: l.date, purpose: l.purpose }]));
    return { date: day, hearings: listed, needsNextDate: stale.map((s) => ({ ...s, lastHearing: lastMap.get(s.id) ?? null })) };
  });

  /** Hearings in a date range (default: today + 13 days, inclusive), for the diary list. */
  app.get("/diary", { schema: { querystring: rangeQuery } }, async (req) => {
    const from = req.query.from ?? istDate();
    const to = req.query.to ?? addDays(from, 13);
    const list = await hearingsBetween(req.advocateId, istDayRange(from).start, istDayRange(to).end);
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    return { from, to, hearings: list };
  });

  app.post("/cases/:caseId/hearings", { schema: { params: z.object({ caseId: z.string() }), body: hearingInput } }, async (req, reply) => {
    await requireCaseAccess(req.advocateId, req.params.caseId, "write");
    const c = await db.query.cases.findFirst({ where: eq(cases.id, req.params.caseId), columns: { court: true } });
    const [hearing] = await db
      .insert(hearings)
      .values({ ...req.body, court: req.body.court ?? c?.court ?? null, caseId: req.params.caseId })
      .returning();
    await db.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, req.params.caseId));
    return reply.code(201).send({ hearing });
  });

  async function hearingWithAccess(advocateId: string, id: string) {
    const h = await db.query.hearings.findFirst({ where: eq(hearings.id, id) });
    if (!h) throw notFound("Hearing");
    await requireCaseAccess(advocateId, h.caseId, "write");
    return h;
  }

  /** Update a hearing; `next` creates the following hearing in the same transaction. */
  app.patch("/hearings/:id", { schema: { params: z.object({ id: z.string() }), body: hearingUpdateInput } }, async (req) => {
    const h = await hearingWithAccess(req.advocateId, req.params.id);
    const { next, ...data } = req.body;
    return db.transaction(async (tx) => {
      const [hearing] = Object.keys(data).length ? await tx.update(hearings).set(data).where(eq(hearings.id, h.id)).returning() : [h];
      const [nextHearing] = next
        ? await tx
            .insert(hearings)
            .values({ caseId: h.caseId, date: next.date, purpose: next.purpose ?? null, court: hearing.court })
            .returning()
        : [null];
      return { hearing, nextHearing };
    });
  });

  app.delete("/hearings/:id", { schema: { params: z.object({ id: z.string() }) } }, async (req, reply) => {
    const h = await hearingWithAccess(req.advocateId, req.params.id);
    await db.delete(hearings).where(eq(hearings.id, h.id));
    return reply.code(204).send();
  });
};
