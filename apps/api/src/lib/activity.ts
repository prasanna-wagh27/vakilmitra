import { accessLogs, advocates, and, cases, desc, eq, inArray, like, lt, or, type SQL, sql } from "@vakilmitra/db";
import { z } from "zod";
import { db } from "../db.js";

export const ACTIVITY_KINDS = ["view", "change", "signin"] as const;

export const activityQuery = z.object({
  caseId: z.string().optional(),
  kind: z.enum(ACTIVITY_KINDS).optional(),
  /** Cursor: "<ISO time>|<id>" of the last row already shown. */
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
export type ActivityQuery = z.infer<typeof activityQuery>;

const KIND: Record<(typeof ACTIVITY_KINDS)[number], SQL> = {
  view: sql`${accessLogs.method} = 'GET'`,
  change: sql`${accessLogs.method} <> 'GET' and ${accessLogs.action} not like 'auth.%'`,
  signin: or(like(accessLogs.action, "auth.%"), eq(accessLogs.action, "account.create"))!,
};

/**
 * Audit rows about one advocate's account: what they did anywhere, and what anyone (their
 * juniors included) did on cases they own. Newest first.
 */
export async function activityFor(advocateId: string, q: ActivityQuery) {
  const owned = db.select({ id: cases.id }).from(cases).where(eq(cases.advocateId, advocateId));
  let cursor: SQL | undefined;
  if (q.before) {
    const [at, id] = q.before.split("|");
    const t = new Date(at);
    if (!Number.isNaN(t.getTime())) cursor = or(lt(accessLogs.at, t), and(eq(accessLogs.at, t), lt(accessLogs.id, id ?? "")));
  }
  const rows = await db
    .select({
      id: accessLogs.id,
      at: accessLogs.at,
      action: accessLogs.action,
      entityType: accessLogs.entityType,
      entityId: accessLogs.entityId,
      caseId: accessLogs.caseId,
      method: accessLogs.method,
      status: accessLogs.status,
      details: accessLogs.details,
      ip: accessLogs.ip,
      userAgent: accessLogs.userAgent,
      actorId: accessLogs.advocateId,
      actorKind: accessLogs.actor,
      actorName: advocates.name,
    })
    .from(accessLogs)
    .leftJoin(advocates, eq(advocates.id, accessLogs.advocateId))
    .where(
      and(
        or(eq(accessLogs.advocateId, advocateId), inArray(accessLogs.caseId, owned)),
        q.caseId ? eq(accessLogs.caseId, q.caseId) : undefined,
        q.kind ? KIND[q.kind] : undefined,
        cursor,
      ),
    )
    .orderBy(desc(accessLogs.at), desc(accessLogs.id))
    .limit(q.limit + 1);
  const hasMore = rows.length > q.limit;
  return { rows: rows.slice(0, q.limit), hasMore };
}
