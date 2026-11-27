/**
 * Which court-data service to read from, from settings:
 *   COURTS_PROVIDER=ecourtsindia   COURTS_API_KEY=...   (COURTS_API_URL to point elsewhere)
 *   COURTS_PROVIDER=demo           made-up records, for development and staging only
 * Unset: case tracking is off and the app says so.
 */
import { z } from "zod";
import { DemoCourtProvider } from "./demo.js";
import { EcourtsIndiaProvider } from "./ecourtsindia.js";
import { type CourtProvider, CourtsConfigError } from "./types.js";

export const COURT_PROVIDERS = ["ecourtsindia", "demo"] as const;
export type CourtProviderId = (typeof COURT_PROVIDERS)[number];

const blank = (v: unknown) => (v === "" ? undefined : v);
const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  COURTS_PROVIDER: z.preprocess(blank, z.enum(COURT_PROVIDERS).optional()),
  COURTS_API_KEY: z.preprocess(blank, z.string().min(1).optional()),
  COURTS_API_URL: z.preprocess(blank, z.url().optional()),
});

export interface CourtsConfig {
  provider: CourtProviderId | null;
  apiKey?: string;
  apiUrl?: string;
}

/** Reads and checks the settings. Throws CourtsConfigError for a setup that would fail later. */
export function courtsConfigFromEnv(env: Record<string, string | undefined>): CourtsConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new CourtsConfigError(
      `Court tracking settings: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
    );
  }
  const e = parsed.data;
  if (!e.COURTS_PROVIDER) return { provider: null };
  if (e.COURTS_PROVIDER === "demo" && e.NODE_ENV === "production") {
    throw new CourtsConfigError("COURTS_PROVIDER=demo gives made-up court dates and is refused in production");
  }
  if (e.COURTS_PROVIDER !== "demo" && !e.COURTS_API_KEY)
    throw new CourtsConfigError(`COURTS_PROVIDER=${e.COURTS_PROVIDER} needs COURTS_API_KEY`);
  return { provider: e.COURTS_PROVIDER, apiKey: e.COURTS_API_KEY, apiUrl: e.COURTS_API_URL };
}

/** The provider for these settings, or null when tracking is off. */
export function createCourtProvider(cfg: CourtsConfig): CourtProvider | null {
  switch (cfg.provider) {
    case null:
      return null;
    case "demo":
      return new DemoCourtProvider();
    case "ecourtsindia":
      return new EcourtsIndiaProvider({ apiKey: cfg.apiKey!, baseUrl: cfg.apiUrl });
  }
}
