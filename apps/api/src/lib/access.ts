import type { Request } from "express";
import { prisma } from "../db.js";
import { forbidden, notFound } from "./http.js";

export type CaseAccessLevel = "OWNER" | "EDITOR" | "VIEWER";

/**
 * Per-advocate access: the owner has full access; chamber juniors only see cases
 * explicitly granted to them. Returns the access level or throws 404/403.
 */
export async function requireCaseAccess(advocateId: string, caseId: string, need: "read" | "write" = "read"): Promise<CaseAccessLevel> {
  const c = await prisma.caseFile.findUnique({
    where: { id: caseId },
    select: { advocateId: true, grants: { where: { advocateId }, select: { role: true } } },
  });
  if (!c) throw notFound("Case");
  if (c.advocateId === advocateId) return "OWNER";
  const grant = c.grants[0];
  if (!grant) throw notFound("Case"); // do not reveal existence
  if (need === "write" && grant.role !== "EDITOR") throw forbidden();
  return grant.role;
}

/** Case ids this advocate can see: owned plus granted. */
export async function accessibleCaseIds(advocateId: string): Promise<string[]> {
  const [owned, granted] = await Promise.all([
    prisma.caseFile.findMany({ where: { advocateId }, select: { id: true } }),
    prisma.caseAccess.findMany({ where: { advocateId }, select: { caseId: true } }),
  ]);
  return [...owned.map((c) => c.id), ...granted.map((g) => g.caseId)];
}

/** Access log on every sensitive view and export (spec: Security and DPDP). */
export async function logAccess(req: Request, action: string, entityType: string, entityId: string) {
  await prisma.accessLog.create({
    data: { advocateId: req.advocateId ?? null, action, entityType, entityId, ip: req.ip ?? null },
  });
}
