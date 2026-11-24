/**
 * Error reporting (Sentry). Loaded before the app with `node --import ./dist/instrument.js`, so
 * that tracing, when turned on, can hook into Fastify and Postgres. Off unless SENTRY_DSN is set.
 */
import * as Sentry from "@sentry/node";
import { scrubEvent, sentryEnvFrom } from "@vakilmitra/shared";

const cfg = sentryEnvFrom((k) => process.env[k], process.env.NODE_ENV ?? "development");
if (cfg.dsn) {
  Sentry.init({
    dsn: cfg.dsn,
    environment: cfg.environment,
    release: cfg.release,
    serverName: "api",
    sendDefaultPii: false,
    tracesSampleRate: cfg.tracesSampleRate,
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubEvent(event),
  });
}
