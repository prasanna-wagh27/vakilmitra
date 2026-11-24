import { AI_TASKS, Ai, AiConfigError, aiConfigFromEnv } from "@vakilmitra/ai";
import { GST_REGISTERED } from "@vakilmitra/shared";
import { z } from "zod";

/** Optional setting; an empty value (as copied from .env.example) counts as not set. */
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional());

/** Validated at boot: the process refuses to start with missing or malformed config. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  API_URL: z.url().default("http://localhost:4000"),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  // The staff admin panel (a separate site).
  ADMIN_ORIGIN: z.url().default("http://localhost:5174"),
  PORT: z.coerce.number().int().positive().default(4000),
  VALKEY_URL: z.url().default("redis://localhost:6379"),
  // Razorpay (billing). Without the keys, checkout answers 503 and everyone stays on their trial dates.
  RAZORPAY_KEY_ID: optional,
  RAZORPAY_KEY_SECRET: optional,
  RAZORPAY_WEBHOOK_SECRET: optional,
  // Razorpay plan ids for the monthly subscriptions (create them with `pnpm --filter @vakilmitra/api billing:plans`).
  RAZORPAY_PLAN_SOLO: optional,
  RAZORPAY_PLAN_PRO: optional,
  RAZORPAY_PLAN_CHAMBER: optional,
  // Seller details printed on receipts and invoices. GSTIN and SAC are needed only once GST_REGISTERED is true.
  BILLING_SUPPLIER_NAME: z.string().default("Outgrid Labs"),
  BILLING_SUPPLIER_ADDRESS: optional,
  BILLING_SUPPLIER_GSTIN: optional,
  BILLING_SAC: optional,
  // Outgoing email over SMTP, e.g. smtps://user:pass@email-smtp.ap-south-1.amazonaws.com:465. Unset: printed to the log in dev.
  SMTP_URL: optional,
  MAIL_FROM: z.string().default("VakilMitra <no-reply@vakilmitra.in>"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", z.prettifyError(parsed.error));
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
if (isProd && !env.SMTP_URL) console.warn("SMTP_URL is not set: password resets and receipts will not be emailed");

if (GST_REGISTERED && !env.BILLING_SUPPLIER_GSTIN) {
  console.error("GST_REGISTERED is true, so BILLING_SUPPLIER_GSTIN must be set to issue tax invoices");
  process.exit(1);
}

if (isProd && env.BETTER_AUTH_SECRET.length < 32) {
  console.error("BETTER_AUTH_SECRET must be at least 32 characters in production");
  process.exit(1);
}

// AI models per task: a wrong provider, a missing key or a model outside India under
// AI_INDIA_ONLY stops the start, rather than failing on the first request.
try {
  const ai = new Ai(aiConfigFromEnv(process.env));
  if (env.NODE_ENV !== "test") {
    for (const task of AI_TASKS) {
      const models = ai.models(task);
      console.info(`AI ${task}: ${models.length ? models.map((m) => `${m.id} (${m.dataLocation})`).join(", ") : "off"}`);
    }
  }
} catch (err) {
  if (!(err instanceof AiConfigError)) throw err;
  console.error(err.message);
  process.exit(1);
}
