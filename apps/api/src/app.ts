import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import * as Sentry from "@sentry/node";
import { PAGE_UPLOAD } from "@vakilmitra/shared";
import { fromNodeHeaders } from "better-auth/node";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { auth } from "./auth.js";
import { effectiveAccess } from "./billing/service.js";
import { env, isProd } from "./env.js";
import { advocateIdByEmail, auditTrail } from "./lib/audit.js";
import { HttpError } from "./lib/http.js";
import { accountRoutes } from "./routes/account.js";
import { activityRoutes } from "./routes/activity.js";
import { adminRoutes } from "./routes/admin.js";
import { aiRoutes } from "./routes/ai.js";
import { billingRoutes, razorpayWebhook } from "./routes/billing.js";
import { caseRoutes } from "./routes/cases.js";
import { clientRoutes } from "./routes/clients.js";
import { diaryRoutes } from "./routes/diary.js";
import { documentRoutes } from "./routes/documents.js";
import { draftRoutes } from "./routes/drafts.js";
import { factRoutes } from "./routes/facts.js";
import { feeRoutes } from "./routes/fees.js";
import { landRoutes } from "./routes/land.js";
import { reportRoutes } from "./routes/report.js";
import { trackingRoutes } from "./routes/tracking.js";

declare module "fastify" {
  interface FastifyRequest {
    advocateId: string;
  }
}

export type App = FastifyInstance;

/** Better Auth endpoints used while signed in, and the audit action each records. */
const AUTH_SESSION_EVENTS: Record<string, string> = {
  "sign-out": "auth.sign_out",
  "change-password": "auth.password_change",
  "change-email": "auth.email_change",
  "update-user": "account.update",
  "revoke-session": "auth.session_revoke",
  "revoke-sessions": "auth.session_revoke",
  "revoke-other-sessions": "auth.session_revoke",
  "send-verification-email": "auth.verification_sent",
};

/** Sign-in, sign-up, password reset and email verification, named for the audit trail. */
async function auditAuthEvent(req: FastifyRequest, name: string, status: number, text: string | null) {
  const a = req.audit;
  const ok = status < 400;
  const body = (req.body ?? {}) as { email?: unknown };
  const userId = () => {
    try {
      return (JSON.parse(text ?? "{}") as { user?: { id?: string } }).user?.id ?? null;
    } catch {
      return null;
    }
  };
  if (name === "sign-in/email") {
    if (ok) Object.assign(a, { action: "auth.sign_in", advocateId: userId() });
    else {
      const advocateId = await advocateIdByEmail(body.email);
      Object.assign(a, { action: "auth.sign_in_failed", advocateId, actor: "anonymous" });
      // An address with no account is kept so repeated guessing shows up.
      if (!advocateId && typeof body.email === "string") a.details = { email: body.email.slice(0, 200) };
    }
  } else if (name === "sign-up/email" && ok) Object.assign(a, { action: "account.create", advocateId: userId() });
  else if (name === "request-password-reset")
    Object.assign(a, { action: "auth.password_reset_requested", advocateId: await advocateIdByEmail(body.email), actor: "anonymous" });
  else if (name === "reset-password")
    Object.assign(a, { action: ok ? "auth.password_reset" : "auth.password_reset_failed", advocateId: a.advocateId ?? null });
  else if (name === "verify-email")
    Object.assign(a, { action: ok ? "auth.email_verified" : "auth.email_verify_failed", advocateId: a.advocateId ?? null });
}

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "test"
        ? false
        : {
            level: env.LOG_LEVEL,
            transport: isProd ? undefined : { target: "pino-pretty" },
            redact: ["req.headers.cookie", "req.headers.authorization"],
          },
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorateRequest("advocateId", "");
  auditTrail(app);

  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: [env.WEB_ORIGIN, env.ADMIN_ORIGIN],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  });
  await app.register(multipart, { limits: { fileSize: PAGE_UPLOAD.maxBytes, files: 1 } });
  await app.register(swagger, {
    openapi: { info: { title: "VakilMitra API", version: "0.1.0" }, components: {} },
    transform: jsonSchemaTransform,
  });
  // API docs UI is a dev tool only (and a devDependency), so it is never part of the shipped tree.
  if (!isProd) await app.register((await import("@fastify/swagger-ui")).default, { routePrefix: "/api/docs" });

  app.setErrorHandler((err: FastifyError | HttpError, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send({
        error: "invalid_input",
        message: "Invalid input",
        details: err.validation.map((v) => ({ path: v.instancePath.replace(/^\//, "").replaceAll("/", "."), message: v.message })),
      });
    }
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: err.code, message: err.message, details: err.details });
    const pgCode = (err as { cause?: { code?: string } }).cause?.code;
    if (pgCode === "23505") return reply.code(409).send({ error: "conflict", message: "Already exists" });
    if ((err as FastifyError).statusCode && (err as FastifyError).statusCode! < 500) {
      return reply.code((err as FastifyError).statusCode!).send({ error: "bad_request", message: err.message });
    }
    req.log.error(err);
    // Only unexpected failures are reported; the route pattern, not the URL, names the place.
    Sentry.withScope((scope) => {
      scope.setTag("route", req.routeOptions.url ?? "unknown");
      if (req.advocateId) scope.setUser({ id: req.advocateId });
      Sentry.captureException(err);
    });
    return reply.code(500).send({ error: "internal", message: "Something went wrong" });
  });

  app.get("/api/health", { schema: { hide: true } }, async () => ({ ok: true }));

  // Better Auth handles /api/auth/* (sign-up, sign-in, sign-out, session).
  app.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    schema: { hide: true },
    async handler(req, reply) {
      const url = new URL(req.url, env.API_URL);
      // Account deletion must go through DELETE /api/me, which always requires the password.
      // Checked on the normalised path, so "/api/auth/x/../delete-user" cannot slip past.
      if (url.pathname.toLowerCase().split("/").includes("delete-user")) {
        return reply.code(404).send({ error: "not_found", message: "Use DELETE /api/me" });
      }
      // Account changes made through Better Auth: note who, before the session may end.
      const name = url.pathname.replace(/^\/api\/auth\//, "");
      const sessionEvent = AUTH_SESSION_EVENTS[name];
      if (sessionEvent) {
        const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
        Object.assign(req.audit, { action: sessionEvent, advocateId: s?.user.id ?? null });
      }
      const request = new Request(url, {
        method: req.method,
        headers: fromNodeHeaders(req.headers),
        body: req.method === "GET" || req.body == null ? undefined : JSON.stringify(req.body),
      });
      const res = await auth.handler(request);
      const text = res.body ? await res.text() : null;
      await auditAuthEvent(req, name, res.status, text);
      reply.status(res.status);
      res.headers.forEach((value, key) => {
        if (key !== "set-cookie") reply.header(key, value);
      });
      const cookies = res.headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      return reply.send(text);
    },
  });

  // Razorpay calls this; it is verified by signature, not by session.
  await app.register(razorpayWebhook, { prefix: "/api/webhooks" });

  // Staff panel: its own sign-in, separate from advocates.
  await app.register(adminRoutes, { prefix: "/api/admin" });

  // Everything else needs a signed-in advocate.
  await app.register(async (authed) => {
    authed.addHook("preHandler", async (req) => {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) throw new HttpError(401, "unauthenticated", "Please sign in");
      req.advocateId = session.user.id;
      // Once a trial or plan has run out (after grace), the account is read-only: everything
      // stays visible and exportable, but nothing new can be added until a plan is chosen.
      if (req.method !== "GET" && req.method !== "HEAD" && !/^\/api\/(billing|me)(\/|\?|$)/.test(req.url)) {
        const { state } = await effectiveAccess(req.advocateId);
        if (state === "READ_ONLY") {
          throw new HttpError(
            402,
            "read_only",
            "Your plan has ended. Choose a plan to add or change work; your files stay available to read and export.",
          );
        }
      }
    });
    await authed.register(billingRoutes, { prefix: "/api/billing" });
    await authed.register(accountRoutes, { prefix: "/api/me" });
    await authed.register(aiRoutes, { prefix: "/api/ai" });
    await authed.register(draftRoutes, { prefix: "/api" });
    await authed.register(activityRoutes, { prefix: "/api/activity" });
    await authed.register(clientRoutes, { prefix: "/api/clients" });
    await authed.register(caseRoutes, { prefix: "/api/cases" });
    await authed.register(diaryRoutes, { prefix: "/api" });
    await authed.register(trackingRoutes, { prefix: "/api" });
    await authed.register(feeRoutes, { prefix: "/api/fees" });
    await authed.register(landRoutes, { prefix: "/api" });
    await authed.register(reportRoutes, { prefix: "/api" });
    await authed.register(documentRoutes, { prefix: "/api" });
    await authed.register(factRoutes, { prefix: "/api" });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "not_found", message: "No such endpoint" }));
  return app;
}
