import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { notFound, parse, toPaise } from "../lib/http.js";
import { requireCaseAccess } from "../lib/access.js";

export const feesRouter = Router();

export interface ClientTotals {
  clientId: string;
  clientName: string;
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  /** Installments already due minus everything paid (never negative). */
  overduePaise: number;
  nextDue: { date: Date; amountPaise: number } | null;
}

/** Fee position per client, computed from agreements, installments and payments. */
export async function outstandingByClient(advocateId: string, asOf = new Date()): Promise<Map<string, ClientTotals>> {
  const agreements = await prisma.feeAgreement.findMany({
    where: { client: { advocateId } },
    include: { client: { select: { name: true } }, payments: { select: { amountPaise: true } }, installments: true },
  });
  const map = new Map<string, ClientTotals>();
  for (const a of agreements) {
    const t =
      map.get(a.clientId) ??
      { clientId: a.clientId, clientName: a.client.name, totalPaise: 0, paidPaise: 0, outstandingPaise: 0, overduePaise: 0, nextDue: null };
    const paid = a.payments.reduce((s, p) => s + p.amountPaise, 0);
    const dueSoFar = a.installments.filter((i) => i.dueDate <= asOf).reduce((s, i) => s + i.amountPaise, 0);
    t.totalPaise += a.totalPaise;
    t.paidPaise += paid;
    t.overduePaise += Math.max(0, dueSoFar - paid);
    // Next unpaid installment: walk installments in date order, consuming payments.
    let remaining = paid;
    for (const i of [...a.installments].sort((x, y) => x.dueDate.getTime() - y.dueDate.getTime())) {
      const left = i.amountPaise - Math.min(remaining, i.amountPaise);
      remaining = Math.max(0, remaining - i.amountPaise);
      if (left > 0 && i.dueDate > asOf) {
        if (!t.nextDue || i.dueDate < t.nextDue.date) t.nextDue = { date: i.dueDate, amountPaise: left };
        break;
      }
    }
    t.outstandingPaise = Math.max(0, t.totalPaise - t.paidPaise);
    map.set(a.clientId, t);
  }
  return map;
}

/** One screen: total outstanding per client (spec acceptance for Fees). */
feesRouter.get("/summary", async (req, res) => {
  const rows = [...(await outstandingByClient(req.advocateId!)).values()].sort((a, b) => b.outstandingPaise - a.outstandingPaise);
  const totals = rows.reduce(
    (s, r) => ({ totalPaise: s.totalPaise + r.totalPaise, paidPaise: s.paidPaise + r.paidPaise, outstandingPaise: s.outstandingPaise + r.outstandingPaise, overduePaise: s.overduePaise + r.overduePaise }),
    { totalPaise: 0, paidPaise: 0, outstandingPaise: 0, overduePaise: 0 },
  );
  res.json({ clients: rows, totals });
});

const agreementSchema = z.object({
  clientId: z.string(),
  caseId: z.string().nullable().optional(),
  description: z.string().trim().min(1).max(300),
  totalRupees: z.number().positive().max(1e9),
  installments: z
    .array(z.object({ dueDate: z.coerce.date(), amountRupees: z.number().positive(), note: z.string().max(200).optional() }))
    .optional(),
});

feesRouter.post("/agreements", async (req, res) => {
  const body = parse(agreementSchema, req.body);
  const client = await prisma.client.findFirst({ where: { id: body.clientId, advocateId: req.advocateId } });
  if (!client) throw notFound("Client");
  if (body.caseId) await requireCaseAccess(req.advocateId!, body.caseId, "write");
  const agreement = await prisma.feeAgreement.create({
    data: {
      clientId: body.clientId,
      caseId: body.caseId ?? null,
      description: body.description,
      totalPaise: toPaise(body.totalRupees),
      installments: { create: (body.installments ?? []).map((i) => ({ dueDate: i.dueDate, amountPaise: toPaise(i.amountRupees), note: i.note })) },
    },
    include: { installments: true, payments: true },
  });
  res.status(201).json({ agreement });
});

async function ownAgreement(advocateId: string, id: string) {
  const a = await prisma.feeAgreement.findFirst({
    where: { id, client: { advocateId } },
    include: { client: true, case: { select: { id: true, title: true, caseNumber: true, court: true } }, installments: { orderBy: { dueDate: "asc" } }, payments: { orderBy: { paidOn: "asc" } } },
  });
  if (!a) throw notFound("Fee agreement");
  return a;
}

feesRouter.get("/agreements/:id", async (req, res) => {
  res.json({ agreement: await ownAgreement(req.advocateId!, req.params.id) });
});

feesRouter.delete("/agreements/:id", async (req, res) => {
  await ownAgreement(req.advocateId!, req.params.id);
  await prisma.feeAgreement.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

const paymentSchema = z.object({
  amountRupees: z.number().positive().max(1e9),
  paidOn: z.coerce.date(),
  mode: z.enum(["cash", "upi", "cheque", "bank"]).optional(),
  reference: z.string().trim().max(100).optional(),
});

feesRouter.post("/agreements/:id/payments", async (req, res) => {
  await ownAgreement(req.advocateId!, req.params.id);
  const b = parse(paymentSchema, req.body);
  const payment = await prisma.payment.create({
    data: { agreementId: req.params.id, amountPaise: toPaise(b.amountRupees), paidOn: b.paidOn, mode: b.mode, reference: b.reference },
  });
  res.status(201).json({ payment });
});

feesRouter.delete("/payments/:id", async (req, res) => {
  const p = await prisma.payment.findFirst({ where: { id: req.params.id, agreement: { client: { advocateId: req.advocateId } } } });
  if (!p) throw notFound("Payment");
  await prisma.payment.delete({ where: { id: p.id } });
  res.status(204).end();
});

/** Simple invoice for one client: all agreements, payments and the balance. */
feesRouter.get("/invoice/:clientId", async (req, res) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.clientId, advocateId: req.advocateId },
    include: {
      feeAgreements: {
        include: { case: { select: { title: true, caseNumber: true, court: true } }, payments: { orderBy: { paidOn: "asc" } }, installments: { orderBy: { dueDate: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!client) throw notFound("Client");
  const advocate = await prisma.advocate.findUniqueOrThrow({
    where: { id: req.advocateId },
    select: { name: true, email: true, phone: true, barCouncilNo: true },
  });
  const totals = (await outstandingByClient(req.advocateId!)).get(client.id) ?? null;
  res.json({ advocate, client, totals, issuedOn: new Date() });
});
