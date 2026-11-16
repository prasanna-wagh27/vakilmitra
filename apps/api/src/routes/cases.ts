import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError, notFound, parse } from "../lib/http.js";
import { accessibleCaseIds, logAccess, requireCaseAccess } from "../lib/access.js";
import { startOfTodayIst } from "../lib/time.js";

export const casesRouter = Router();

const KINDS = ["CIVIL", "LAND_PROPERTY", "TITLE_SEARCH", "CRIMINAL", "FAMILY", "REVENUE", "OTHER"] as const;
const STATUSES = ["ACTIVE", "DISPOSED", "ON_HOLD", "CLOSED"] as const;
const PARTY_ROLES = ["PETITIONER", "RESPONDENT", "PLAINTIFF", "DEFENDANT", "APPLICANT", "OPPONENT", "APPELLANT", "OTHER"] as const;

const caseSchema = z.object({
  title: z.string().trim().min(1).max(300),
  kind: z.enum(KINDS).optional(),
  clientId: z.string().nullable().optional(),
  caseNumber: z.string().trim().max(80).nullable().optional(),
  court: z.string().trim().max(200).nullable().optional(),
  cnrNumber: z.string().trim().max(32).nullable().optional(),
  status: z.enum(STATUSES).optional(),
  filedOn: z.coerce.date().nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
});

async function assertOwnClient(advocateId: string, clientId?: string | null) {
  if (!clientId) return;
  const c = await prisma.client.findFirst({ where: { id: clientId, advocateId } });
  if (!c) throw notFound("Client");
}

casesRouter.get("/", async (req, res) => {
  const ids = await accessibleCaseIds(req.advocateId!);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const status = typeof req.query.status === "string" && (STATUSES as readonly string[]).includes(req.query.status) ? (req.query.status as (typeof STATUSES)[number]) : undefined;
  const cases = await prisma.caseFile.findMany({
    where: {
      id: { in: ids },
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { caseNumber: { contains: q, mode: "insensitive" } },
              { court: { contains: q, mode: "insensitive" } },
              { client: { name: { contains: q, mode: "insensitive" } } },
              { parties: { some: { name: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      hearings: { where: { date: { gte: startOfTodayIst() } }, orderBy: { date: "asc" }, take: 1 },
      _count: { select: { flags: { where: { resolved: false } } } },
    },
  });
  res.json({
    cases: cases.map(({ hearings, advocateId, ...c }) => ({ ...c, nextHearing: hearings[0] ?? null, shared: advocateId !== req.advocateId })),
  });
});

casesRouter.post("/", async (req, res) => {
  const data = parse(caseSchema, req.body);
  await assertOwnClient(req.advocateId!, data.clientId);
  const caseFile = await prisma.caseFile.create({ data: { ...data, advocateId: req.advocateId! } });
  res.status(201).json({ case: caseFile });
});

casesRouter.get("/:id", async (req, res) => {
  const access = await requireCaseAccess(req.advocateId!, req.params.id);
  const caseFile = await prisma.caseFile.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      client: true,
      parties: { orderBy: { createdAt: "asc" } },
      properties: { orderBy: { createdAt: "asc" }, include: { _count: { select: { events: true } } } },
      hearings: { orderBy: { date: "desc" } },
      flags: { where: { resolved: false }, orderBy: { createdAt: "asc" } },
      drafts: { orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true, language: true, updatedAt: true } },
      feeAgreements: { include: { payments: true, installments: true } },
      grants: access === "OWNER" ? { include: { advocate: { select: { id: true, name: true, email: true } } } } : false,
    },
  });
  await logAccess(req, "case.view", "case", caseFile.id);
  res.json({ case: caseFile, access });
});

casesRouter.patch("/:id", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.id, "write");
  const data = parse(caseSchema.partial(), req.body);
  await assertOwnClient(req.advocateId!, data.clientId);
  const caseFile = await prisma.caseFile.update({ where: { id: req.params.id }, data });
  res.json({ case: caseFile });
});

/** One-tap delete of a case and everything in it. Owner only. */
casesRouter.delete("/:id", async (req, res) => {
  const access = await requireCaseAccess(req.advocateId!, req.params.id, "write");
  if (access !== "OWNER") throw new HttpError(403, "forbidden", "Only the owning advocate can delete a case");
  await prisma.caseFile.delete({ where: { id: req.params.id } });
  await logAccess(req, "case.delete", "case", req.params.id);
  res.status(204).end();
});

// ---------- Parties ----------

const partySchema = z.object({
  name: z.string().trim().min(1).max(200),
  role: z.enum(PARTY_ROLES),
  isOurClient: z.boolean().optional(),
  opposingCounsel: z.string().trim().max(200).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
});

casesRouter.post("/:id/parties", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.id, "write");
  const party = await prisma.party.create({ data: { ...parse(partySchema, req.body), caseId: req.params.id } });
  res.status(201).json({ party });
});

casesRouter.patch("/:id/parties/:partyId", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.id, "write");
  const { count } = await prisma.party.updateMany({ where: { id: req.params.partyId, caseId: req.params.id }, data: parse(partySchema.partial(), req.body) });
  if (!count) throw notFound("Party");
  res.json({ party: await prisma.party.findUnique({ where: { id: req.params.partyId } }) });
});

casesRouter.delete("/:id/parties/:partyId", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.id, "write");
  const { count } = await prisma.party.deleteMany({ where: { id: req.params.partyId, caseId: req.params.id } });
  if (!count) throw notFound("Party");
  res.status(204).end();
});

// ---------- Sharing with juniors (case by case) ----------

casesRouter.post("/:id/grants", async (req, res) => {
  const access = await requireCaseAccess(req.advocateId!, req.params.id, "write");
  if (access !== "OWNER") throw new HttpError(403, "forbidden", "Only the owning advocate can share a case");
  const body = parse(z.object({ email: z.email().transform((e) => e.toLowerCase()), role: z.enum(["EDITOR", "VIEWER"]).default("VIEWER") }), req.body);
  const junior = await prisma.advocate.findUnique({ where: { email: body.email } });
  if (!junior) throw notFound("Advocate with that email");
  if (junior.id === req.advocateId) throw new HttpError(400, "invalid_input", "You already own this case");
  const grant = await prisma.caseAccess.upsert({
    where: { caseId_advocateId: { caseId: req.params.id, advocateId: junior.id } },
    create: { caseId: req.params.id, advocateId: junior.id, role: body.role },
    update: { role: body.role },
  });
  await logAccess(req, "case.share", "case", req.params.id);
  res.status(201).json({ grant });
});

casesRouter.delete("/:id/grants/:grantId", async (req, res) => {
  const access = await requireCaseAccess(req.advocateId!, req.params.id, "write");
  if (access !== "OWNER") throw new HttpError(403, "forbidden", "Only the owning advocate can change sharing");
  const { count } = await prisma.caseAccess.deleteMany({ where: { id: req.params.grantId, caseId: req.params.id } });
  if (!count) throw notFound("Grant");
  res.status(204).end();
});
