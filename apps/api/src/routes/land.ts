import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { notFound, parse } from "../lib/http.js";
import { requireCaseAccess } from "../lib/access.js";
import { runRules, type ChainEvent } from "../land/rules.js";

/** Properties, their ownership chain, and the deterministic red-flag check. */
export const landRouter = Router();

const propertySchema = z.object({
  surveyNo: z.string().trim().max(40).nullable().optional(),
  gatNo: z.string().trim().max(40).nullable().optional(),
  hissaNo: z.string().trim().max(40).nullable().optional(),
  village: z.string().trim().max(120).nullable().optional(),
  taluka: z.string().trim().max(120).nullable().optional(),
  district: z.string().trim().max(120).nullable().optional(),
});

const names = z.array(z.string().trim().min(1).max(200)).max(100).default([]);

const eventSchema = z.object({
  kind: z.enum(["RECORD_SNAPSHOT", "DEED", "MUTATION"]),
  date: z.coerce.date(),
  subtype: z.string().trim().toUpperCase().max(40).nullable().optional(),
  ferfarNo: z.string().trim().max(40).nullable().optional(),
  deedRegNo: z.string().trim().max(60).nullable().optional(),
  refDeedRegNo: z.string().trim().max(60).nullable().optional(),
  fromParties: names,
  toParties: names,
  owners: names,
  areaSqm: z.number().nonnegative().nullable().optional(),
  landClass: z.string().trim().max(40).nullable().optional(),
  otherRights: z.array(z.string().trim().max(500)).max(50).default([]),
  section155: z.boolean().default(false),
  factIds: z.array(z.string()).max(200).default([]),
  notes: z.string().max(2000).nullable().optional(),
});

async function propertyInCase(caseId: string, propertyId: string) {
  const p = await prisma.property.findFirst({ where: { id: propertyId, caseId } });
  if (!p) throw notFound("Property");
  return p;
}

landRouter.post("/cases/:caseId/properties", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  const property = await prisma.property.create({ data: { ...parse(propertySchema, req.body), caseId: req.params.caseId } });
  res.status(201).json({ property });
});

landRouter.get("/cases/:caseId/properties/:propertyId", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId);
  await propertyInCase(req.params.caseId, req.params.propertyId);
  const property = await prisma.property.findUniqueOrThrow({
    where: { id: req.params.propertyId },
    include: {
      events: { orderBy: { date: "asc" } },
      flags: { orderBy: [{ resolved: "asc" }, { createdAt: "asc" }] },
    },
  });
  res.json({ property });
});

landRouter.patch("/cases/:caseId/properties/:propertyId", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  await propertyInCase(req.params.caseId, req.params.propertyId);
  const property = await prisma.property.update({ where: { id: req.params.propertyId }, data: parse(propertySchema.partial(), req.body) });
  res.json({ property });
});

landRouter.delete("/cases/:caseId/properties/:propertyId", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  await propertyInCase(req.params.caseId, req.params.propertyId);
  await prisma.property.delete({ where: { id: req.params.propertyId } });
  res.status(204).end();
});

landRouter.post("/cases/:caseId/properties/:propertyId/events", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  await propertyInCase(req.params.caseId, req.params.propertyId);
  const event = await prisma.ownershipEvent.create({ data: { ...parse(eventSchema, req.body), propertyId: req.params.propertyId } });
  res.status(201).json({ event });
});

landRouter.patch("/cases/:caseId/properties/:propertyId/events/:eventId", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  await propertyInCase(req.params.caseId, req.params.propertyId);
  const { count } = await prisma.ownershipEvent.updateMany({
    where: { id: req.params.eventId, propertyId: req.params.propertyId },
    data: parse(eventSchema.partial(), req.body),
  });
  if (!count) throw notFound("Event");
  res.json({ event: await prisma.ownershipEvent.findUnique({ where: { id: req.params.eventId } }) });
});

landRouter.delete("/cases/:caseId/properties/:propertyId/events/:eventId", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  const { count } = await prisma.ownershipEvent.deleteMany({ where: { id: req.params.eventId, propertyId: req.params.propertyId } });
  if (!count) throw notFound("Event");
  res.status(204).end();
});

/**
 * Run the rules over the property's chain. Open flags are replaced with the fresh result;
 * flags the advocate already resolved stay resolved if the same rule fires on the same events.
 */
landRouter.post("/cases/:caseId/properties/:propertyId/check", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  await propertyInCase(req.params.caseId, req.params.propertyId);
  const locale = req.query.lang === "en" ? "en" : "mr";
  const events = await prisma.ownershipEvent.findMany({ where: { propertyId: req.params.propertyId } });
  const results = runRules(events as ChainEvent[], { asOf: new Date() });

  const sig = (rule: string, eventIds: string[]) => `${rule}|${[...eventIds].sort().join(",")}`;
  const resolved = await prisma.flag.findMany({ where: { propertyId: req.params.propertyId, resolved: true } });
  const resolvedSigs = new Set(resolved.map((f) => sig(f.rule, f.eventIds)));

  const flags = await prisma.$transaction(async (tx) => {
    await tx.flag.deleteMany({ where: { propertyId: req.params.propertyId, resolved: false } });
    const fresh = results.filter((r) => !resolvedSigs.has(sig(r.rule, r.eventIds)));
    await tx.flag.createMany({
      data: fresh.map((r) => ({
        caseId: req.params.caseId,
        propertyId: req.params.propertyId,
        rule: r.rule,
        severity: r.severity,
        message: r.message[locale],
        eventIds: r.eventIds,
        factIds: r.factIds,
      })),
    });
    return tx.flag.findMany({ where: { propertyId: req.params.propertyId }, orderBy: [{ resolved: "asc" }, { createdAt: "asc" }] });
  });
  res.json({ flags, ranAt: new Date(), eventCount: events.length });
});

landRouter.patch("/cases/:caseId/flags/:flagId", async (req, res) => {
  await requireCaseAccess(req.advocateId!, req.params.caseId, "write");
  const body = parse(z.object({ resolved: z.boolean(), resolution: z.string().trim().max(2000).nullable().optional() }), req.body);
  const { count } = await prisma.flag.updateMany({ where: { id: req.params.flagId, caseId: req.params.caseId }, data: body });
  if (!count) throw notFound("Flag");
  res.json({ flag: await prisma.flag.findUnique({ where: { id: req.params.flagId } }) });
});
