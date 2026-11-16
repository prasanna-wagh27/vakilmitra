import { accessLogs, and, caseAccess, cases, clients, eq, inArray, or } from "@vakilmitra/db";
import type { CaseAccessLevel } from "@vakilmitra/shared";
import type { FastifyRequest } from "fastify";
import { db } from "../db.js";
import { forbidden, notFound } from "./http.js";

/**
 * Per-advocate access: the owner has full access; juniors see only cases explicitly shared
 * with them. Returns the access level, or 404 (we never reveal that someone else's case exists).
 */
export async function requireCaseAccess(advocateId: string, caseId: string, need: "read" | "write" = "read"): Promise<CaseAccessLevel> {
  const c = await db.query.cases.findFirst({
    where: eq(cases.id, caseId),
    columns: { advocateId: true },
    with: { grants: { where: eq(caseAccess.advocateId, advocateId), columns: { role: true } } },
  });
  if (!c) throw notFound("Case");
  if (c.advocateId === advocateId) return "OWNER";
  const grant = c.grants[0];
  if (!grant) throw notFound("Case");
  if (need === "write" && grant.role !== "EDITOR") throw forbidden();
  return grant.role;
}

export async function requireCaseOwner(advocateId: string, caseId: string) {
  if ((await requireCaseAccess(advocateId, caseId, "write")) !== "OWNER") throw forbidden("Only the owning advocate can do this");
}

/** SQL condition: case is owned by, or shared with, this advocate. */
export function visibleCase(advocateId: string) {
  return or(
    eq(cases.advocateId, advocateId),
    inArray(cases.id, db.select({ id: caseAccess.caseId }).from(caseAccess).where(eq(caseAccess.advocateId, advocateId))),
  )!;
}

/** Access log on every sensitive view, share, export and delete. */
export async function logAccess(req: FastifyRequest, action: string, entityType: string, entityId: string) {
  await db.insert(accessLogs).values({ advocateId: req.advocateId, action, entityType, entityId, ip: req.ip });
}

/** The client must belong to this advocate. Returns it, or 404 (never reveals another advocate's client). */
export async function requireOwnClient(advocateId: string, clientId: string) {
  const c = await db.query.clients.findFirst({ where: and(eq(clients.id, clientId), eq(clients.advocateId, advocateId)) });
  if (!c) throw notFound("Client");
  return c;
}
