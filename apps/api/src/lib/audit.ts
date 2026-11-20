/**
 * The audit trail, written in one place: every API request by a signed-in advocate leaves one
 * access_log row, written just before its response is sent (views, lists, searches, changes, exports, refused
 * attempts). Routes may name the action more precisely with logAccess(); access checks note the
 * case. Client content never goes in: ids, the route pattern, which fields were sent, the result.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { accessLogs, advocates, eq } from "@vakilmitra/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db.js";

export interface AuditInfo {
  action?: string;
  entityType?: string;
  entityId?: string | null;
  caseId?: string;
  /** Set for sign-in events, where the request has no session yet. */
  advocateId?: string | null;
  actor?: "advocate" | "anonymous";
  details?: Record<string, unknown>;
  /** The id of what a POST created, read from the response. */
  createdId?: string;
  skip?: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    audit: AuditInfo;
  }
}

const store = new AsyncLocalStorage<AuditInfo>();

/** The current request's audit entry (for code that has no request object, e.g. auth callbacks). */
export const currentAudit = () => store.getStore();

/** Called by the case access checks: the request concerns this case. */
export function noteCase(caseId: string) {
  const a = store.getStore();
  if (a && !a.caseId) a.caseId = caseId;
}

// ---------- Naming the action from the route ----------

const VERB: Record<string, string> = { GET: "view", PATCH: "update", PUT: "update", DELETE: "delete", POST: "update" };
/** Path words that name one thing under its parent, not a list. */
const SINGLE = new Set(["report", "details", "summary", "board", "image"]);
const ALIAS: Record<string, string> = { me: "account", image: "page", agreement: "fee_agreement", grant: "case_access" };

const singular = (w: string) => {
  const s = w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.endsWith("s") ? w.slice(0, -1) : w;
  return ALIAS[s] ?? s;
};
const isParam = (s: string | undefined) => !!s?.startsWith(":");
const isList = (s: string) => s.endsWith("s") && !SINGLE.has(s);

/**
 * "/api/cases/:id" GET -> case.view; "/api/cases" POST -> case.create;
 * "/api/documents/:id/extract" POST -> document.extract; "/api/cases/:caseId/hearings" GET -> hearing.list.
 */
export function describeRoute(route: string, method: string, params: Record<string, string>) {
  const segs = route
    .replace(/^\/api\//, "")
    .split("/")
    .filter(Boolean);
  const value = (seg: string | undefined) => (seg && isParam(seg) ? (params[seg.slice(1)] ?? null) : null);
  let caseId: string | undefined;
  for (let i = 0; i < segs.length - 1; i++) if (segs[i] === "cases" && isParam(segs[i + 1])) caseId = value(segs[i + 1]) ?? undefined;
  const nearestId = () => value([...segs].reverse().find(isParam));

  const last = segs.at(-1) ?? "";
  const prev = segs.at(-2);
  let entityType: string;
  let entityId: string | null = null;
  let verb: string;
  if (isParam(last)) {
    entityType = singular(prev ?? "item");
    entityId = value(last);
    verb = VERB[method] ?? "update";
  } else if (isList(last)) {
    entityType = singular(last);
    verb = method === "GET" ? "list" : method === "POST" ? "create" : (VERB[method] ?? "update");
  } else if (SINGLE.has(last) || !prev) {
    entityType = singular(last);
    entityId = isParam(prev) ? value(prev) : null;
    verb = VERB[method] ?? "update";
  } else {
    // An action word: /documents/:id/extract, /properties/:id/check, /report/approve.
    entityType = singular(isParam(prev) ? (segs.at(-3) ?? "item") : prev);
    entityId = nearestId();
    verb = last.replace(/-/g, "_");
  }
  if (entityType === "case" && entityId && !caseId) caseId = entityId;
  return { action: `${entityType}.${verb}`, entityType, entityId, caseId };
}

// ---------- What goes in details ----------

/** Free text the advocate typed (search terms) is client data: keep only its length. */
const FREE_TEXT = new Set(["q", "query", "search", "text"]);

function safeQuery(query: unknown) {
  if (!query || typeof query !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(query as Record<string, unknown>)) {
    out[k] = FREE_TEXT.has(k) && typeof v === "string" ? `[${v.length} characters]` : v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The names of the fields a change sent (never their values). */
function fieldNames(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const names = Object.keys(body as object).filter((k) => !/password|token|secret/i.test(k));
  return names.length ? names : undefined;
}

// ---------- Repeat views ----------

/** Screens refresh while pages are read: the same view by the same person counts once per 10 minutes. */
const REPEAT_MS = 10 * 60_000;
const recent = new Map<string, number>();
function seenRecently(key: string, now: number) {
  const last = recent.get(key);
  if (last !== undefined && now - last < REPEAT_MS) return true;
  recent.set(key, now);
  if (recent.size > 50_000) for (const [k, t] of recent) if (now - t >= REPEAT_MS) recent.delete(k);
  return false;
}
/** Tests: forget recent views. */
export const resetAuditRepeats = () => recent.clear();

// ---------- Writing ----------

/** Paths with their own trail (staff_audit, billing) or nothing to record. */
const SKIP = /^\/api\/(health|docs|admin|webhooks)(\/|$)/;

async function write(req: FastifyRequest, reply: FastifyReply) {
  const a = req.audit;
  const route = req.routeOptions.url;
  if (!a || a.skip || !route || req.method === "OPTIONS" || req.method === "HEAD" || SKIP.test(route)) return;
  const isAuth = route.startsWith("/api/auth/");
  if (isAuth && !a.action) return; // only the sign-in events auth.ts names
  const advocateId = a.advocateId !== undefined ? a.advocateId : req.advocateId || null;
  if (!advocateId && !isAuth) return; // refused before sign-in: no one to attribute it to

  const d = isAuth ? null : describeRoute(route, req.method, (req.params ?? {}) as Record<string, string>);
  const action = a.action ?? d!.action;
  const entityId = a.entityId !== undefined ? a.entityId : (d?.entityId ?? a.createdId ?? null);
  const caseId = a.caseId ?? d?.caseId ?? (a.entityType === "case" || d?.entityType === "case" ? (entityId ?? undefined) : undefined);
  const status = reply.statusCode;

  if (req.method === "GET" && status < 400 && advocateId) {
    const key = `${advocateId}|${action}|${entityId}|${JSON.stringify(req.query ?? {})}`;
    if (seenRecently(key, Date.now())) return;
  }
  const details = {
    ...a.details,
    ...(isAuth ? {} : { query: safeQuery(req.query), fields: req.method === "GET" ? undefined : fieldNames(req.body) }),
  };
  await db.insert(accessLogs).values({
    advocateId,
    actor: a.actor ?? (advocateId ? "advocate" : "anonymous"),
    action,
    entityType: a.entityType ?? d?.entityType ?? null,
    entityId,
    caseId: caseId ?? null,
    method: req.method,
    route,
    status,
    details: Object.values(details).some((v) => v !== undefined) ? details : null,
    ip: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 300) ?? null,
  });
}

/** Register on the root app, before the routes. */
export function auditTrail(app: FastifyInstance) {
  app.decorateRequest("audit", null as unknown as AuditInfo);
  // run() (not enterWith) so every later hook and the handler see this request's entry.
  app.addHook("onRequest", (req, _reply, done) => {
    const a: AuditInfo = {};
    req.audit = a;
    store.run(a, done);
  });
  // What a POST created: the first object with an id in the answer.
  app.addHook("onSend", async (req, reply, payload) => {
    if (req.method === "POST" && reply.statusCode < 300 && typeof payload === "string" && payload.startsWith("{")) {
      try {
        const body = JSON.parse(payload) as Record<string, unknown>;
        const first = Object.values(body).find((v) => v && typeof v === "object" && "id" in (v as object)) as { id?: unknown } | undefined;
        if (typeof first?.id === "string") req.audit.createdId = first.id;
      } catch {}
    }
    // Written before the answer goes out, so a view is on record by the time it is seen.
    try {
      await write(req, reply);
    } catch (err) {
      req.log.error({ err }, "audit write failed");
    }
    return payload;
  });
}

/** The account (if any) that an email address belongs to, for failed sign-ins and reset requests. */
export async function advocateIdByEmail(email: unknown) {
  if (typeof email !== "string" || !email) return null;
  const [a] = await db.select({ id: advocates.id }).from(advocates).where(eq(advocates.email, email.trim().toLowerCase())).limit(1);
  return a?.id ?? null;
}
