/**
 * Scrubbing for error reports (Sentry), shared by the API, worker, web app and admin panel.
 * Error reports leave India, so they carry only what is needed to find the bug: no request
 * bodies, cookies, query strings, names, emails or console output. Case data never goes in.
 */

type Bag = Record<string, unknown>;

/** The parts of a Sentry event we touch; kept structural so this file needs no Sentry dependency. */
export interface ScrubbableEvent {
  request?: { url?: string; data?: unknown; cookies?: unknown; query_string?: unknown; headers?: Record<string, string>; env?: unknown };
  user?: Bag;
  breadcrumbs?: { category?: string; message?: string; data?: Bag }[];
}

const KEEP_HEADERS = new Set(["user-agent", "content-type", "content-length"]);

/** "https://api.x/a/b?token=1#h" -> "https://api.x/a/b" (relative paths too). */
export function stripQuery(url: string) {
  return url.split(/[?#]/)[0] ?? url;
}

export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const r = event.request;
  if (r) {
    delete r.data;
    delete r.cookies;
    delete r.query_string;
    delete r.env;
    if (r.url) r.url = stripQuery(r.url);
    if (r.headers) r.headers = Object.fromEntries(Object.entries(r.headers).filter(([k]) => KEEP_HEADERS.has(k.toLowerCase())));
  }
  // Only the opaque account id, never name, email or IP address.
  if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id };
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .filter((b) => b.category !== "console" && b.category !== "ui.input")
      .map((b) => {
        if (!b.data) return b;
        const data: Bag = {};
        for (const k of ["method", "status_code", "url", "from", "to"] as const) {
          const v = b.data[k];
          if (v !== undefined) data[k] = typeof v === "string" ? stripQuery(v) : v;
        }
        return { ...b, data };
      });
  }
  return event;
}

/** Sentry setting from the environment: a DSN turns it on; nothing is sent without one. */
export interface SentryEnv {
  dsn: string | undefined;
  environment: string;
  release: string | undefined;
  tracesSampleRate: number;
}

export function sentryEnvFrom(get: (k: string) => string | undefined, fallbackEnvironment: string): SentryEnv {
  const rate = Number(get("SENTRY_TRACES_SAMPLE_RATE") ?? 0);
  return {
    dsn: get("SENTRY_DSN") || undefined,
    environment: get("SENTRY_ENVIRONMENT") || fallbackEnvironment,
    release: get("APP_VERSION") || undefined,
    tracesSampleRate: Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0,
  };
}
