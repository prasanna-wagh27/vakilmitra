import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { notFound, parse } from "../lib/http.js";
import { outstandingByClient } from "./fees.js";

export const clientsRouter = Router();

const clientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(20).nullable().optional(),
  email: z.email().nullable().optional().or(z.literal("").transform(() => null)),
  address: z.string().trim().max(500).nullable().optional(),
  whatsappOptIn: z.boolean().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

async function ownClient(advocateId: string, id: string) {
  const c = await prisma.client.findFirst({ where: { id, advocateId } });
  if (!c) throw notFound("Client");
  return c;
}

clientsRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const clients = await prisma.client.findMany({
    where: {
      advocateId: req.advocateId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
    },
    orderBy: { name: "asc" },
    include: { _count: { select: { cases: true } } },
  });
  const outstanding = await outstandingByClient(req.advocateId!);
  res.json({
    clients: clients.map((c) => ({ ...c, outstandingPaise: outstanding.get(c.id)?.outstandingPaise ?? 0 })),
  });
});

clientsRouter.post("/", async (req, res) => {
  const data = parse(clientSchema, req.body);
  const client = await prisma.client.create({ data: { ...data, advocateId: req.advocateId! } });
  res.status(201).json({ client });
});

clientsRouter.get("/:id", async (req, res) => {
  await ownClient(req.advocateId!, req.params.id);
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: req.params.id },
    include: {
      cases: { orderBy: { updatedAt: "desc" } },
      feeAgreements: { include: { payments: true, installments: true }, orderBy: { createdAt: "desc" } },
    },
  });
  const outstanding = (await outstandingByClient(req.advocateId!)).get(client.id);
  res.json({ client, totals: outstanding ?? { totalPaise: 0, paidPaise: 0, outstandingPaise: 0 } });
});

clientsRouter.patch("/:id", async (req, res) => {
  await ownClient(req.advocateId!, req.params.id);
  const data = parse(clientSchema.partial(), req.body);
  const client = await prisma.client.update({ where: { id: req.params.id }, data });
  res.json({ client });
});

clientsRouter.delete("/:id", async (req, res) => {
  await ownClient(req.advocateId!, req.params.id);
  await prisma.client.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
