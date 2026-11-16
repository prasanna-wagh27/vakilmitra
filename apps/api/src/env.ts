import { z } from "zod";

/** Validated at boot: the process refuses to start with missing or malformed config. */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  API_URL: z.url().default("http://localhost:4000"),
  WEB_ORIGIN: z.url().default("http://localhost:5173"),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment:", z.prettifyError(parsed.error));
  process.exit(1);
}
export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";

if (isProd && env.BETTER_AUTH_SECRET.length < 32) {
  console.error("BETTER_AUTH_SECRET must be at least 32 characters in production");
  process.exit(1);
}
