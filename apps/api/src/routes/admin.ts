/**
 * /api/admin: the staff panel's API. Separate from advocates' sign-in: its own cookie,
 * password + authenticator code, and an audit row for every sign-in and change.
 * Staff see accounts, plans, payments and usage counts, never clients, cases or documents.
 */
import {
  advocates,
  and,
  backupRuns,
  cases,
  clients,
  count,
  desc,
  documents,
  eq,
  gte,
  ilike,
  inArray,
  invoices,
  or,
  pages,
  sessions,
  sql,
  staff,
  staffAudit,
  staffSessions,
  subscriptions,
  sum,
} from "@vakilmitra/db";
import { GRACE_DAYS, PAID_PLANS, PLANS } from "@vakilmitra/shared";
import { addDays } from "date-fns";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod, ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { hashToken, matchTotp, newSessionToken, openSecret, verifyPassword } from "../admin/security.js";
import { accessState, billingStatus } from "../billing/service.js";
import { db } from "../db.js";
import { env, isProd } from "../env.js";
import { activityFor, activityQuery } from "../lib/activity.js";
import { describeRoute } from "../lib/audit.js";
import { HttpError, likePattern, notFound } from "../lib/http.js";
import { getServices } from "../services.js";

type Staff = { id: string; name: string; email: string; role: "OWNER" | "SUPPORT" };

declare module "fastify" {
  interface FastifyRequest {
    staff: Staff | null;
    staffAudited: boolean;
  }
}

const COOKIE = isProd ? "__Host-vm_admin" : "vm_admin";
const SESSION_HOURS = 12;
const DAY = 86_400_000;

function readCookie(req: FastifyRequest, name: string) {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function setSessionCookie(reply: FastifyReply, token: string, maxAge: number) {
  // __Host- cookies need Path=/ and Secure; SameSite=Strict keeps other sites from using it.
  const attrs = [`${COOKIE}=${token}`, "Path=/", `Max-Age=${maxAge}`, "HttpOnly", "SameSite=Strict"];
  if (isProd) attrs.push("Secure");
  reply.header("set-cookie", attrs.join("; "));
}

async function audit(req: FastifyRequest, action: string, target?: { type: string; id: string }, details?: Record<string, unknown>) {
  req.staffAudited = true;
  await db.insert(staffAudit).values({
    staffId: req.staff?.id ?? null,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    details: details ?? null,
    ip: req.ip,
  });
}

// Failed sign-ins per IP, kept in memory (one API instance). 5 failures lock that IP for 15 minutes.
const failures = new Map<string, { n: number; until: number }>();
const LOCK_MS = 15 * 60_000;

/** SQL: when the account's trial or paid period ends. */
const periodEndSql = sql`case when ${subscriptions.plan} = 'TRIAL' or ${subscriptions.paidUntil} is null then ${subscriptions.trialEndsAt} else ${subscriptions.paidUntil} end`;
const STATES = ["TRIAL", "ACTIVE", "GRACE", "READ_ONLY"] as const;
function stateSql(state: (typeof STATES)[number]) {
  const grace = sql`(${periodEndSql}) + make_interval(days => ${GRACE_DAYS})`;
  switch (state) {
    case "TRIAL":
      return sql`${subscriptions.plan} = 'TRIAL' and (${periodEndSql}) > now()`;
    case "ACTIVE":
      return sql`${subscriptions.plan} <> 'TRIAL' and (${periodEndSql}) > now()`;
    case "GRACE":
      return sql`(${periodEndSql}) <= now() and ${grace} > now()`;
    case "READ_ONLY":
      return sql`${grace} <= now()`;
  }
}

/** Monthly recurring revenue in paise, excluding GST: yearly plans count as a twelfth. */
function mrrOf(subs: (typeof subscriptions.$inferSelect)[], now: Date) {
  let mrr = 0;
  for (const s of subs) {
    if (s.plan === "TRIAL" || s.complimentary || !s.interval || accessState(s, now) !== "ACTIVE") continue;
    const price = PLANS[s.plan].price!;
    mrr += s.interval === "MONTHLY" ? price.MONTHLY : Math.round(price.YEARLY / 12);
  }
  return mrr;
}

export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.decorateRequest("staff", null);
  app.decorateRequest("staffAudited", false);

  // Every staff request is in the trail, not only changes: lists and pages viewed too. Requests
  // that wrote their own row (sign-in, account views, changes) are not written twice.
  app.addHook("onResponse", async (req, reply) => {
    const route = req.routeOptions.url;
    if (!req.staff || req.staffAudited || !route || req.method === "OPTIONS" || /\/(me|health)$/.test(route)) return;
    const d = describeRoute(route.replace(/^\/api\/admin\//, "/api/"), req.method, (req.params ?? {}) as Record<string, string>);
    await db
      .insert(staffAudit)
      .values({
        staffId: req.staff.id,
        action: d.action,
        targetType: d.entityType,
        targetId: d.entityId,
        details: { route, status: reply.statusCode, query: req.query && Object.keys(req.query).length ? req.query : undefined },
        ip: req.ip,
      })
      .catch((err) => req.log.error({ err }, "staff audit write failed"));
  });

  // Cookie auth needs a CSRF guard: changes are accepted only from the admin site itself.
  app.addHook("onRequest", async (req) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.headers.origin !== env.ADMIN_ORIGIN) {
      throw new HttpError(403, "forbidden", "Bad origin");
    }
  });

  app.post(
    "/login",
    { schema: { body: z.object({ email: z.email().toLowerCase(), password: z.string().min(1).max(200), code: z.string().trim() }) } },
    async (req, reply) => {
      const key = req.ip;
      const f = failures.get(key);
      if (f && f.n >= 5 && f.until > Date.now())
        throw new HttpError(429, "too_many_attempts", "Too many attempts. Try again in 15 minutes.");

      const s = await db.query.staff.findFirst({ where: eq(staff.email, req.body.email) });
      const step =
        s && !s.disabled && verifyPassword(req.body.password, s.passwordHash) ? matchTotp(openSecret(s.totpSecret), req.body.code) : null;
      if (!s || step === null || (s.totpLastStep !== null && step <= s.totpLastStep)) {
        const n = (f && f.until > Date.now() ? f.n : 0) + 1;
        failures.set(key, { n, until: Date.now() + LOCK_MS });
        await db
          .insert(staffAudit)
          .values({ staffId: s?.id ?? null, action: "login.failed", details: { email: req.body.email }, ip: req.ip });
        throw new HttpError(401, "invalid_credentials", "Email, password or code is wrong");
      }
      failures.delete(key);

      const token = newSessionToken();
      await db.insert(staffSessions).values({
        staffId: s.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000),
        ip: req.ip,
        userAgent: req.headers["user-agent"] ?? null,
      });
      await db.update(staff).set({ lastLoginAt: new Date(), totpLastStep: step }).where(eq(staff.id, s.id));
      req.staff = { id: s.id, name: s.name, email: s.email, role: s.role };
      await audit(req, "login");
      setSessionCookie(reply, token, SESSION_HOURS * 3600);
      return { staff: req.staff };
    },
  );

  // Everything below needs a staff session.
  await app.register(async (inner) => {
    const authed = inner.withTypeProvider<ZodTypeProvider>();
    authed.addHook("preHandler", async (req) => {
      const token = readCookie(req, COOKIE);
      if (!token) throw new HttpError(401, "unauthenticated", "Please sign in");
      const row = await db
        .select({
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          disabled: staff.disabled,
          expiresAt: staffSessions.expiresAt,
        })
        .from(staffSessions)
        .innerJoin(staff, eq(staff.id, staffSessions.staffId))
        .where(eq(staffSessions.tokenHash, hashToken(token)));
      const s = row[0];
      if (!s || s.disabled || s.expiresAt < new Date()) throw new HttpError(401, "unauthenticated", "Please sign in");
      req.staff = { id: s.id, name: s.name, email: s.email, role: s.role };
    });

    const ownerOnly = (req: FastifyRequest) => {
      if (req.staff?.role !== "OWNER") throw new HttpError(403, "forbidden", "Only an owner can do this");
    };

    authed.get("/me", async (req) => ({ staff: req.staff }));

    authed.post("/logout", async (req, reply) => {
      const token = readCookie(req, COOKIE);
      if (token) await db.delete(staffSessions).where(eq(staffSessions.tokenHash, hashToken(token)));
      await audit(req, "logout");
      setSessionCookie(reply, "", 0);
      return reply.code(204).send();
    });

    authed.get("/dashboard", async () => {
      const now = new Date();
      const since30 = new Date(now.getTime() - 30 * DAY);
      const subs = await db.select().from(subscriptions);
      const byState = { TRIAL: 0, ACTIVE: 0, GRACE: 0, READ_ONLY: 0 };
      const paidByPlan = { SOLO: 0, PRO: 0, CHAMBER: 0 };
      let complimentary = 0;
      let paymentFailing = 0;
      for (const s of subs) {
        const st = accessState(s, now);
        byState[st]++;
        if (s.plan !== "TRIAL" && st === "ACTIVE") {
          if (s.complimentary) complimentary++;
          else paidByPlan[s.plan]++;
        }
        if (s.paymentFailing && st !== "READ_ONLY") paymentFailing++;
      }

      const signups = await db
        .select({ day: sql<string>`to_char(${advocates.createdAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`, n: count() })
        .from(advocates)
        .where(gte(advocates.createdAt, since30))
        .groupBy(sql`1`)
        .orderBy(sql`1`);

      // Conversion: of the accounts whose trial has ended, how many have ever paid.
      const [conv] = await db
        .select({
          ended: count(),
          paid: sql<number>`count(*) filter (where exists (select 1 from ${invoices} where ${invoices.advocateId} = ${subscriptions.advocateId}))`.mapWith(
            Number,
          ),
        })
        .from(subscriptions)
        .where(sql`${subscriptions.trialEndsAt} < now()`);

      const [revenue] = await db
        .select({ total: sum(invoices.totalPaise), net: sum(invoices.amountPaise), n: count() })
        .from(invoices)
        .where(and(eq(invoices.status, "PAID"), gte(invoices.createdAt, since30)));

      const pageRoutes = await db
        .select({ route: sql<string>`coalesce(${pages.ocrRoute}, 'pending')`, n: count() })
        .from(pages)
        .where(gte(pages.createdAt, since30))
        .groupBy(sql`1`);
      const [store] = await db.select({ bytes: sum(pages.byteSize) }).from(pages);
      const [failed] = await db
        .select({ n: count() })
        .from(pages)
        .where(and(eq(pages.ocrStatus, "FAILED"), gte(pages.createdAt, new Date(now.getTime() - 7 * DAY))));
      const [totals] = await db.select({ n: count() }).from(advocates);

      return {
        accounts: { total: totals?.n ?? 0, byState, paidByPlan, complimentary, paymentFailing },
        mrrPaise: mrrOf(subs, now),
        revenue30d: { totalPaise: Number(revenue?.total ?? 0), netPaise: Number(revenue?.net ?? 0), payments: revenue?.n ?? 0 },
        conversion: { trialsEnded: conv?.ended ?? 0, paid: conv?.paid ?? 0 },
        signups30d: signups,
        pages30d: pageRoutes,
        storageBytes: Number(store?.bytes ?? 0),
        ocrFailed7d: failed?.n ?? 0,
      };
    });

    authed.get(
      "/accounts",
      {
        schema: {
          querystring: z.object({
            q: z.string().trim().max(100).optional(),
            state: z.enum(STATES).optional(),
            plan: z.enum(["TRIAL", ...PAID_PLANS]).optional(),
            page: z.coerce.number().int().min(1).default(1),
          }),
        },
      },
      async (req) => {
        const { q, state, plan, page } = req.query;
        const PAGE = 50;
        const where = and(
          q ? or(ilike(advocates.name, likePattern(q)), ilike(advocates.email, likePattern(q))) : undefined,
          state ? stateSql(state) : undefined,
          plan ? eq(subscriptions.plan, plan) : undefined,
        );
        const rows = await db
          .select({
            id: advocates.id,
            name: advocates.name,
            email: advocates.email,
            createdAt: advocates.createdAt,
            sub: subscriptions,
          })
          .from(advocates)
          .innerJoin(subscriptions, eq(subscriptions.advocateId, advocates.id))
          .where(where)
          .orderBy(desc(advocates.createdAt))
          .limit(PAGE + 1)
          .offset((page - 1) * PAGE);
        const ids = rows.slice(0, PAGE).map((r) => r.id);
        const caseCounts = ids.length
          ? await db
              .select({ id: cases.advocateId, n: count() })
              .from(cases)
              .where(inArray(cases.advocateId, ids))
              .groupBy(cases.advocateId)
          : [];
        const pageCounts = ids.length
          ? await db
              .select({ id: cases.advocateId, n: count(), bytes: sum(pages.byteSize) })
              .from(pages)
              .innerJoin(documents, eq(documents.id, pages.documentId))
              .innerJoin(cases, eq(cases.id, documents.caseId))
              .where(inArray(cases.advocateId, ids))
              .groupBy(cases.advocateId)
          : [];
        const now = new Date();
        return {
          accounts: rows.slice(0, PAGE).map((r) => {
            const p = pageCounts.find((x) => x.id === r.id);
            const end = r.sub.plan === "TRIAL" || !r.sub.paidUntil ? r.sub.trialEndsAt : r.sub.paidUntil;
            return {
              id: r.id,
              name: r.name,
              email: r.email,
              createdAt: r.createdAt,
              plan: r.sub.plan,
              interval: r.sub.interval,
              state: accessState(r.sub, now),
              endsAt: end,
              complimentary: r.sub.complimentary,
              paymentFailing: r.sub.paymentFailing,
              cases: caseCounts.find((x) => x.id === r.id)?.n ?? 0,
              pages: p?.n ?? 0,
              storageBytes: Number(p?.bytes ?? 0),
            };
          }),
          hasMore: rows.length > PAGE,
        };
      },
    );

    const idParams = z.object({ id: z.string() });

    // The account's audit trail, for support and disputes. Ids only: staff never see case names.
    authed.get("/accounts/:id/activity", { schema: { params: idParams, querystring: activityQuery } }, async (req) => {
      const { rows, hasMore } = await activityFor(req.params.id, req.query);
      await audit(req, "account.activity.view", { type: "advocate", id: req.params.id });
      return {
        entries: rows.map(({ details, userAgent, ...r }) => ({
          ...r,
          device: userAgent,
          fields: Array.isArray(details?.fields) ? details.fields : null,
        })),
        hasMore,
      };
    });

    authed.get("/accounts/:id", { schema: { params: idParams } }, async (req) => {
      const a = await db.query.advocates.findFirst({
        where: eq(advocates.id, req.params.id),
        columns: { id: true, name: true, email: true, phone: true, barCouncilNo: true, emailVerified: true, locale: true, createdAt: true },
      });
      if (!a) throw notFound("Account");
      const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
      const [caseN, clientN, docN, lastSeen] = await Promise.all([
        n(db.select({ n: count() }).from(cases).where(eq(cases.advocateId, a.id))),
        n(db.select({ n: count() }).from(clients).where(eq(clients.advocateId, a.id))),
        n(db.select({ n: count() }).from(documents).innerJoin(cases, eq(cases.id, documents.caseId)).where(eq(cases.advocateId, a.id))),
        db
          .select({ at: sql<string | null>`max(${sessions.updatedAt})` })
          .from(sessions)
          .where(eq(sessions.userId, a.id)),
      ]);
      await audit(req, "account.view", { type: "advocate", id: a.id });
      return {
        account: a,
        billing: await billingStatus(a.id),
        counts: { cases: caseN, clients: clientN, documents: docN },
        lastSeenAt: lastSeen[0]?.at ?? null,
        invoices: await db.query.invoices.findMany({ where: eq(invoices.advocateId, a.id), orderBy: desc(invoices.createdAt) }),
        history: await db
          .select({ id: staffAudit.id, action: staffAudit.action, details: staffAudit.details, at: staffAudit.at, staffName: staff.name })
          .from(staffAudit)
          .leftJoin(staff, eq(staff.id, staffAudit.staffId))
          .where(and(eq(staffAudit.targetType, "advocate"), eq(staffAudit.targetId, a.id), sql`${staffAudit.action} <> 'account.view'`))
          .orderBy(desc(staffAudit.at))
          .limit(50),
      };
    });

    const requireSub = async (id: string) => {
      const s = await db.query.subscriptions.findFirst({ where: eq(subscriptions.advocateId, id) });
      if (!s) throw notFound("Account");
      return s;
    };

    authed.post(
      "/accounts/:id/trial",
      {
        schema: {
          params: idParams,
          body: z.object({ days: z.number().int().min(1).max(90), note: z.string().trim().max(300).optional() }),
        },
      },
      async (req) => {
        const s = await requireSub(req.params.id);
        if (s.plan !== "TRIAL") throw new HttpError(409, "conflict", "This account is on a plan, not a trial");
        const from = s.trialEndsAt > new Date() ? s.trialEndsAt : new Date();
        const trialEndsAt = addDays(from, req.body.days);
        await db.update(subscriptions).set({ trialEndsAt }).where(eq(subscriptions.advocateId, s.advocateId));
        await audit(
          req,
          "trial.extend",
          { type: "advocate", id: s.advocateId },
          { days: req.body.days, until: trialEndsAt, note: req.body.note },
        );
        return { billing: await billingStatus(s.advocateId) };
      },
    );

    authed.post(
      "/accounts/:id/comp",
      {
        schema: {
          params: idParams,
          body: z.object({
            plan: z.enum(PAID_PLANS),
            until: z.iso.date(),
            note: z.string().trim().min(3).max(300),
          }),
        },
      },
      async (req) => {
        ownerOnly(req);
        const s = await requireSub(req.params.id);
        if (s.razorpaySubscriptionId && !s.cancelAtPeriodEnd && accessState(s) === "ACTIVE") {
          throw new HttpError(409, "conflict", "This account pays monthly. Cancel its subscription before giving a free plan.");
        }
        const paidUntil = new Date(`${req.body.until}T23:59:59+05:30`);
        if (paidUntil <= new Date()) throw new HttpError(400, "invalid_input", "Pick a date in the future");
        await db
          .update(subscriptions)
          .set({ plan: req.body.plan, interval: null, paidUntil, complimentary: true, paymentFailing: false, cancelAtPeriodEnd: false })
          .where(eq(subscriptions.advocateId, s.advocateId));
        await audit(
          req,
          "plan.comp",
          { type: "advocate", id: s.advocateId },
          { plan: req.body.plan, until: req.body.until, note: req.body.note },
        );
        return { billing: await billingStatus(s.advocateId) };
      },
    );

    authed.get("/invoices", { schema: { querystring: z.object({ page: z.coerce.number().int().min(1).default(1) }) } }, async (req) => {
      const PAGE = 50;
      const rows = await db.query.invoices.findMany({
        orderBy: desc(invoices.createdAt),
        limit: PAGE + 1,
        offset: (req.query.page - 1) * PAGE,
      });
      return { invoices: rows.slice(0, PAGE), hasMore: rows.length > PAGE };
    });

    authed.post(
      "/invoices/:id/refund",
      { schema: { params: idParams, body: z.object({ note: z.string().trim().min(3).max(300) }) } },
      async (req) => {
        ownerOnly(req);
        const inv = await db.query.invoices.findFirst({ where: eq(invoices.id, req.params.id) });
        if (!inv) throw notFound("Invoice");
        if (inv.status !== "PAID") throw new HttpError(409, "conflict", "Already refunded");
        const rp = getServices().razorpay;
        if (!rp) throw new HttpError(503, "billing_unavailable", "Razorpay is not set up");
        const refund = await rp.refundPayment(inv.razorpayPaymentId);
        await db.update(invoices).set({ status: "REFUNDED" }).where(eq(invoices.id, inv.id));
        await audit(
          req,
          "invoice.refund",
          { type: "advocate", id: inv.advocateId ?? "" },
          { invoice: inv.number, refundId: refund.id, note: req.body.note },
        );
        return { ok: true };
      },
    );

    authed.get("/audit", async () => ({
      entries: await db
        .select({
          id: staffAudit.id,
          action: staffAudit.action,
          targetType: staffAudit.targetType,
          targetId: staffAudit.targetId,
          details: staffAudit.details,
          ip: staffAudit.ip,
          at: staffAudit.at,
          staffName: staff.name,
        })
        .from(staffAudit)
        .leftJoin(staff, eq(staff.id, staffAudit.staffId))
        .where(sql`${staffAudit.action} <> 'account.view'`)
        .orderBy(desc(staffAudit.at))
        .limit(200),
    }));

    authed.get("/health", async () => {
      const t0 = Date.now();
      await db.execute(sql`select 1`);
      const dbMs = Date.now() - t0;
      const q = getServices().ocrQueue as { getJobCounts?: (...s: string[]) => Promise<Record<string, number>> };
      const queue = q.getJobCounts ? await q.getJobCounts("waiting", "active", "failed", "delayed").catch(() => null) : null;
      const [stuck] = await db
        .select({ n: count() })
        .from(pages)
        .where(and(inArray(pages.ocrStatus, ["PENDING", "PROCESSING"]), sql`${pages.createdAt} < now() - interval '1 hour'`));
      const [lastOk] = await db
        .select({ id: backupRuns.id, at: backupRuns.finishedAt, checkedAt: backupRuns.checkedAt, checkOk: backupRuns.checkOk })
        .from(backupRuns)
        .where(eq(backupRuns.status, "OK"))
        .orderBy(desc(backupRuns.startedAt))
        .limit(1);
      const [lastFailed] = await db
        .select({ at: backupRuns.startedAt, error: backupRuns.error })
        .from(backupRuns)
        .where(eq(backupRuns.status, "FAILED"))
        .orderBy(desc(backupRuns.startedAt))
        .limit(1);
      return {
        db: { ok: true, ms: dbMs },
        ocrQueue: queue,
        pagesStuck: stuck?.n ?? 0,
        razorpay: !!getServices().razorpay,
        backup: { lastOk: lastOk ?? null, lastFailed: lastFailed ?? null },
      };
    });
  });
};

/** Clears sign-in lockouts (tests). */
export const resetLoginFailures = () => failures.clear();
