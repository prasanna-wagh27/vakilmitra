import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError, notFound, parse } from "../lib/http.js";
import { accessibleCaseIds, requireCaseAccess } from "../lib/access.js";
import { addDays, istDate, istDayRange } from "../lib/time.js";

/** Case diary: hearing dates, next steps and the daily board. */
export const diaryRouter = Router();

const caseSummary = {
  select: { id: true, title: true, caseNumber: true, court: true, status: true, client: { select: { id: true, name: true, phone: true } } },
} as const;

function dayParam(v: unknown, fallback: string): string {
  if (typeof v !== "string" || !v) return fallback;
  try {
    istDayRange(v);
    return v;
  } catch {
    throw new HttpError(400, "invalid_input", "Dates must be YYYY-MM-DD");
  }
}

/** Daily board: everything listed on one IST day, grouped by court. */
diaryRouter.get("/board", async (req, res) => {
  const day = dayParam(req.query.date, istDate());
  const { start, end } = istDayRange(day);
  const ids = await accessibleCaseIds(req.advocateId!);
  const hearings = await prisma.hearing.findMany({
    where: { caseId: { in: ids }, date: { gte: start, lt: end } },
    orderBy: [{ court: "asc" }, { date: "asc" }],
    include: { case: caseSummary },
  });
  // Cases whose last hearing is past with no next date set: the "missed date" risk list.
  const stale = await prisma.caseFile.findMany({
    where: {
      id: { in: ids },
      status: "ACTIVE",
      hearings: { some: { date: { lt: istDayRange().start } }, none: { date: { gte: istDayRange().start } } },
    },
    select: { ...caseSummary.select, hearings: { orderBy: { date: "desc" }, take: 1, select: { date: true, purpose: true } } },
  });
  res.json({ date: day, hearings, needsNextDate: stale.map(({ hearings: h, ...c }) => ({ ...c, lastHearing: h[0] ?? null })) });
});

/** Hearings in a date range (default: today + 14 days), for the diary list/calendar. */
diaryRouter.get("/", async (req, res) => {
  const from = dayParam(req.query.from, istDate());
  const to = dayParam(req.query.to, addDays(from, 14));
  const ids = await accessibleCaseIds(req.advocateId!);
  const hearings = await prisma.hearing.findMany({
    where: { caseId: { in: ids }, date: { gte: istDayRange(from).start, lt: istDayRange(to).end } },
    orderBy: { date: "asc" },
    include: { case: caseSummary },
  });
  res.json({ from, to, hearings });
});

const hearingSchema = z.object({
  date: z.coerce.date(),
  court: z.string().trim().max(200).nullable().optional(),
  purpose: z.string().trim().max(200).nullable().optional(),
  nextStep: z.string().trim().max(2000).nullable().optional(),
  outcome: z.string().trim().max(2000).nullable().optional(),
});

export const hearingsRouter = Router();

hearingsRouter.post("/cases/:caseId/hearings", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  const data = parse(hearingSchema, req.body);
  const c = await prisma.caseFile.findUniqueOrThrow({ where: { id: req.params.caseId }, select: { court: true } });
  const hearing = await prisma.hearing.create({ data: { ...data, court: data.court ?? c.court, caseId: req.params.caseId } });
  await prisma.caseFile.update({ where: { id: req.params.caseId }, data: { updatedAt: new Date() } });
  res.status(201).json({ hearing });
});

async function hearingWithAccess(advocateId: string, id: string) {
  const h = await prisma.hearing.findUnique({ where: { id } });
  if (!h) throw notFound("Hearing");
  await requireCaseAccess(advocateId, h.caseId, "write");
  return h;
}

/**
 * Update a hearing. Recording what happened usually means setting the next date too,
 * so `next` creates the following hearing in the same call.
 */
hearingsRouter.patch("/hearings/:id", async (req, res) => {
  const h = await hearingWithAccess(req.advocateId!, req.params.id);
  const body = parse(hearingSchema.partial().extend({ next: hearingSchema.pick({ date: true, purpose: true }).optional() }), req.body);
  const { next, ...data } = body;
  const [hearing, nextHearing] = await prisma.$transaction(async (tx) => {
    const updated = await tx.hearing.update({ where: { id: h.id }, data });
    const created = next
      ? await tx.hearing.create({ data: { caseId: h.caseId, date: next.date, purpose: next.purpose ?? null, court: updated.court } })
      : null;
    return [updated, created] as const;
  });
  res.json({ hearing, nextHearing });
});

hearingsRouter.delete("/hearings/:id", async (req, res) => {
  const h = await hearingWithAccess(req.advocateId!, req.params.id);
  await prisma.hearing.delete({ where: { id: h.id } });
  res.status(204).end();
});
