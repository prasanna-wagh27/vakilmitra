import { and, asc, cases, clients, count, eq, ilike, inArray, or } from "@vakilmitra/db";
import { clientInput, searchQuery } from "@vakilmitra/shared";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { db } from "../db.js";
import { likePattern, notFound } from "../lib/http.js";
import { feeTotalsByClient } from "./fees.js";

const idParams = z.object({ id: z.string() });

async function ownClient(advocateId: string, id: string) {
  const c = await db.query.clients.findFirst({ where: and(eq(clients.id, id), eq(clients.advocateId, advocateId)) });
  if (!c) throw notFound("Client");
  return c;
}

export const clientRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", { schema: { querystring: searchQuery } }, async (req) => {
    const q = req.query.q;
    const rows = await db.query.clients.findMany({
      where: and(
        eq(clients.advocateId, req.advocateId),
        q ? or(ilike(clients.name, likePattern(q)), ilike(clients.phone, likePattern(q))) : undefined,
      ),
      orderBy: asc(clients.name),
    });
    const ids = rows.map((c) => c.id);
    const caseCounts = ids.length
      ? await db.select({ clientId: cases.clientId, n: count() }).from(cases).where(inArray(cases.clientId, ids)).groupBy(cases.clientId)
      : [];
    const countMap = new Map(caseCounts.map((r) => [r.clientId, r.n]));
    const totals = await feeTotalsByClient(req.advocateId);
    return {
      clients: rows.map((c) => ({ ...c, caseCount: countMap.get(c.id) ?? 0, outstandingPaise: totals.get(c.id)?.outstandingPaise ?? 0 })),
    };
  });

  app.post("/", { schema: { body: clientInput } }, async (req, reply) => {
    const [client] = await db
      .insert(clients)
      .values({ ...req.body, advocateId: req.advocateId })
      .returning();
    return reply.code(201).send({ client });
  });

  app.get("/:id", { schema: { params: idParams } }, async (req) => {
    await ownClient(req.advocateId, req.params.id);
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, req.params.id),
      with: {
        cases: { orderBy: (c, { desc }) => desc(c.updatedAt) },
        feeAgreements: { with: { payments: true, installments: true }, orderBy: (f, { desc }) => desc(f.createdAt) },
      },
    });
    const totals = (await feeTotalsByClient(req.advocateId)).get(req.params.id);
    return { client, totals: totals ?? { totalPaise: 0, paidPaise: 0, outstandingPaise: 0, overduePaise: 0 } };
  });

  app.patch("/:id", { schema: { params: idParams, body: clientInput.partial() } }, async (req) => {
    await ownClient(req.advocateId, req.params.id);
    const [client] = await db.update(clients).set(req.body).where(eq(clients.id, req.params.id)).returning();
    return { client };
  });

  app.delete("/:id", { schema: { params: idParams } }, async (req, reply) => {
    await ownClient(req.advocateId, req.params.id);
    await db.delete(clients).where(eq(clients.id, req.params.id));
    return reply.code(204).send();
  });
};
