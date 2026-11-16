import { and, asc, clients, eq, feeAgreements, installments, payments } from "@vakilmitra/db";
import { type ClientTotals, feeAgreementInput, paymentInput, toPaise } from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db.js";
import { requireCaseOwner, requireOwnClient } from "../lib/access.js";
import { notFound } from "../lib/http.js";

type Totals = Omit<ClientTotals, "nextDue"> & { nextDue: { date: Date; amountPaise: number } | null };

/** Fee position per client, from agreements, installments and payments. */
export async function feeTotalsByClient(advocateId: string, opts: { asOf?: Date; clientId?: string } = {}): Promise<Map<string, Totals>> {
  const asOf = opts.asOf ?? new Date();
  const rows = await db.query.feeAgreements.findMany({
    with: {
      client: { columns: { name: true, advocateId: true } },
      payments: { columns: { amountPaise: true } },
      installments: { orderBy: asc(installments.dueDate) },
    },
    where: (f, { and, eq: eqf, inArray }) =>
      and(
        inArray(f.clientId, db.select({ id: clients.id }).from(clients).where(eq(clients.advocateId, advocateId))),
        opts.clientId ? eqf(f.clientId, opts.clientId) : undefined,
      ),
  });
  const map = new Map<string, Totals>();
  for (const a of rows) {
    const t = map.get(a.clientId) ?? {
      clientId: a.clientId,
      clientName: a.client.name,
      totalPaise: 0,
      paidPaise: 0,
      outstandingPaise: 0,
      overduePaise: 0,
      nextDue: null,
    };
    const paid = a.payments.reduce((s, p) => s + p.amountPaise, 0);
    const dueSoFar = a.installments.filter((i) => i.dueDate <= asOf).reduce((s, i) => s + i.amountPaise, 0);
    t.totalPaise += a.totalPaise;
    t.paidPaise += paid;
    t.overduePaise += Math.max(0, dueSoFar - paid);
    t.outstandingPaise = Math.max(0, t.totalPaise - t.paidPaise);
    // Next unpaid future installment: walk installments in date order, consuming payments.
    let remaining = paid;
    for (const i of a.installments) {
      const left = i.amountPaise - Math.min(remaining, i.amountPaise);
      remaining = Math.max(0, remaining - i.amountPaise);
      if (left > 0 && i.dueDate > asOf) {
        if (!t.nextDue || i.dueDate < t.nextDue.date) t.nextDue = { date: i.dueDate, amountPaise: left };
        break;
      }
    }
    map.set(a.clientId, t);
  }
  return map;
}

async function ownAgreement(advocateId: string, id: string) {
  const a = await db.query.feeAgreements.findFirst({
    where: eq(feeAgreements.id, id),
    with: {
      client: true,
      case: { columns: { id: true, title: true, caseNumber: true, court: true } },
      installments: { orderBy: asc(installments.dueDate) },
      payments: { orderBy: asc(payments.paidOn) },
    },
  });
  if (!a || a.client.advocateId !== advocateId) throw notFound("Fee agreement");
  return a;
}

const idParams = z.object({ id: z.string() });

export const feeRoutes: FastifyPluginAsyncZod = async (app) => {
  /** One screen: total outstanding per client (spec acceptance for Fees). */
  app.get("/summary", async (req) => {
    const rows = [...(await feeTotalsByClient(req.advocateId)).values()].sort((a, b) => b.outstandingPaise - a.outstandingPaise);
    const totals = rows.reduce(
      (s, r) => ({
        totalPaise: s.totalPaise + r.totalPaise,
        paidPaise: s.paidPaise + r.paidPaise,
        outstandingPaise: s.outstandingPaise + r.outstandingPaise,
        overduePaise: s.overduePaise + r.overduePaise,
      }),
      { totalPaise: 0, paidPaise: 0, outstandingPaise: 0, overduePaise: 0 },
    );
    return { clients: rows, totals };
  });

  app.post("/agreements", { schema: { body: feeAgreementInput } }, async (req, reply) => {
    const b = req.body;
    await requireOwnClient(req.advocateId, b.clientId);
    // Only the case owner bills on a case: juniors' clients never attach to someone else's case.
    if (b.caseId) await requireCaseOwner(req.advocateId, b.caseId);
    const id = await db.transaction(async (tx) => {
      const [a] = await tx
        .insert(feeAgreements)
        .values({ clientId: b.clientId, caseId: b.caseId ?? null, description: b.description, totalPaise: toPaise(b.totalRupees) })
        .returning({ id: feeAgreements.id });
      if (b.installments?.length) {
        await tx
          .insert(installments)
          .values(
            b.installments.map((i) => ({ agreementId: a.id, dueDate: i.dueDate, amountPaise: toPaise(i.amountRupees), note: i.note })),
          );
      }
      return a.id;
    });
    return reply.code(201).send({ agreement: await ownAgreement(req.advocateId, id) });
  });

  app.get("/agreements/:id", { schema: { params: idParams } }, async (req) => ({
    agreement: await ownAgreement(req.advocateId, req.params.id),
  }));

  app.delete("/agreements/:id", { schema: { params: idParams } }, async (req, reply) => {
    await ownAgreement(req.advocateId, req.params.id);
    await db.delete(feeAgreements).where(eq(feeAgreements.id, req.params.id));
    return reply.code(204).send();
  });

  app.post("/agreements/:id/payments", { schema: { params: idParams, body: paymentInput } }, async (req, reply) => {
    await ownAgreement(req.advocateId, req.params.id);
    const b = req.body;
    const [payment] = await db
      .insert(payments)
      .values({ agreementId: req.params.id, amountPaise: toPaise(b.amountRupees), paidOn: b.paidOn, mode: b.mode, reference: b.reference })
      .returning();
    return reply.code(201).send({ payment });
  });

  app.delete("/payments/:id", { schema: { params: idParams } }, async (req, reply) => {
    const p = await db.query.payments.findFirst({
      where: eq(payments.id, req.params.id),
      with: { agreement: { with: { client: { columns: { advocateId: true } } } } },
    });
    if (!p || p.agreement.client.advocateId !== req.advocateId) throw notFound("Payment");
    await db.delete(payments).where(eq(payments.id, p.id));
    return reply.code(204).send();
  });

  /** Simple invoice for one client: all agreements, payments and the balance. */
  app.get("/invoice/:clientId", { schema: { params: z.object({ clientId: z.string() }) } }, async (req) => {
    const client = await db.query.clients.findFirst({
      where: and(eq(clients.id, req.params.clientId), eq(clients.advocateId, req.advocateId)),
      with: {
        feeAgreements: {
          orderBy: asc(feeAgreements.createdAt),
          with: {
            case: { columns: { id: true, title: true, caseNumber: true, court: true } },
            payments: { orderBy: asc(payments.paidOn) },
            installments: { orderBy: asc(installments.dueDate) },
          },
        },
      },
    });
    if (!client) throw notFound("Client");
    const advocate = await db.query.advocates.findFirst({
      where: (a, { eq }) => eq(a.id, req.advocateId),
      columns: { name: true, email: true, phone: true, barCouncilNo: true },
    });
    const totals = (await feeTotalsByClient(req.advocateId, { clientId: client.id })).get(client.id) ?? null;
    return { advocate, client, totals, issuedOn: new Date() };
  });
};
