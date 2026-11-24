import { scrubEvent, sentryEnvFrom } from "@vakilmitra/shared";
import { describe, expect, it } from "vitest";

describe("error report scrubbing", () => {
  it("drops bodies, cookies, query strings, personal details and console output", () => {
    const e = scrubEvent({
      request: {
        url: "https://api.example.in/api/cases/abc?search=Patil#x",
        data: { name: "Client name" },
        cookies: { session: "s" },
        query_string: "search=Patil",
        headers: { "User-Agent": "UA", Cookie: "session=s", Authorization: "Bearer t" },
      },
      user: { id: "adv_1", email: "a@example.com", ip_address: "1.2.3.4" },
      breadcrumbs: [
        { category: "console", message: "Client: Patil" },
        { category: "ui.input", message: "input#name" },
        { category: "fetch", data: { method: "GET", url: "/api/search?q=Patil", status_code: 200, request_body: "x" } },
      ],
    });
    expect(e.request).toEqual({ url: "https://api.example.in/api/cases/abc", headers: { "User-Agent": "UA" } });
    expect(e.user).toEqual({ id: "adv_1" });
    expect(e.breadcrumbs).toEqual([{ category: "fetch", data: { method: "GET", url: "/api/search", status_code: 200 } }]);
  });

  it("is off without a DSN and rejects a bad sample rate", () => {
    expect(sentryEnvFrom(() => undefined, "production")).toEqual({
      dsn: undefined,
      environment: "production",
      release: undefined,
      tracesSampleRate: 0,
    });
    const env: Record<string, string> = { SENTRY_DSN: "https://k@o1.ingest.de.sentry.io/1", SENTRY_TRACES_SAMPLE_RATE: "5" };
    expect(sentryEnvFrom((k) => env[k], "production")).toMatchObject({ dsn: env.SENTRY_DSN, tracesSampleRate: 0 });
  });
});
