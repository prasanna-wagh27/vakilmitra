import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import { PAGE_UPLOAD } from "@vakilmitra/shared";
import { fromNodeHeaders } from "better-auth/node";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { auth } from "./auth.js";
import { env, isProd } from "./env.js";
import { HttpError } from "./lib/http.js";
import { accountRoutes } from "./routes/account.js";
import { caseRoutes } from "./routes/cases.js";
import { clientRoutes } from "./routes/clients.js";
import { diaryRoutes } from "./routes/diary.js";
import { documentRoutes } from "./routes/documents.js";
import { factRoutes } from "./routes/facts.js";
import { feeRoutes } from "./routes/fees.js";
import { landRoutes } from "./routes/land.js";
import { reportRoutes } from "./routes/report.js";

declare module "fastify" {
  interface FastifyRequest {
    advocateId: string;
  }
}

export type App = FastifyInstance;

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

  await app.register(helmet, { global: true });
  await app.register(cors, { origin: env.WEB_ORIGIN, credentials: true, methods: ["GET", "POST", "PATCH", "PUT", "DELETE"] });
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
      const request = new Request(url, {
        method: req.method,
        headers: fromNodeHeaders(req.headers),
        body: req.method === "GET" || req.body == null ? undefined : JSON.stringify(req.body),
      });
      const res = await auth.handler(request);
      reply.status(res.status);
      res.headers.forEach((value, key) => {
        if (key !== "set-cookie") reply.header(key, value);
      });
      const cookies = res.headers.getSetCookie();
      if (cookies.length) reply.header("set-cookie", cookies);
      return reply.send(res.body ? await res.text() : null);
    },
  });

  // Everything else needs a signed-in advocate.
  await app.register(async (authed) => {
    authed.addHook("preHandler", async (req) => {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) throw new HttpError(401, "unauthenticated", "Please sign in");
      req.advocateId = session.user.id;
    });
    await authed.register(accountRoutes, { prefix: "/api/me" });
    await authed.register(clientRoutes, { prefix: "/api/clients" });
    await authed.register(caseRoutes, { prefix: "/api/cases" });
    await authed.register(diaryRoutes, { prefix: "/api" });
    await authed.register(feeRoutes, { prefix: "/api/fees" });
    await authed.register(landRoutes, { prefix: "/api" });
    await authed.register(reportRoutes, { prefix: "/api" });
    await authed.register(documentRoutes, { prefix: "/api" });
    await authed.register(factRoutes, { prefix: "/api" });
  });

  app.setNotFoundHandler((_req, reply) => reply.code(404).send({ error: "not_found", message: "No such endpoint" }));
  return app;
}
