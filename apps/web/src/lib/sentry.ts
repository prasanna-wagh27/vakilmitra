/**
 * Error reporting (Sentry) in the browser. Off unless VITE_SENTRY_DSN is set at build time.
 * Reports are scrubbed (no form input, query strings, console output or personal details), and
 * expected errors such as "not found" or a failed form check are never sent.
 */
import * as Sentry from "@sentry/react";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { scrubEvent } from "@vakilmitra/shared";
import { ApiError } from "./api";

/** Errors the app already handles and shows: 4xx answers, router redirects and not-found. */
function expected(err: unknown) {
  return (err instanceof ApiError && err.status < 500) || isRedirect(err) || isNotFound(err);
}

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ?? import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: (event, hint) => (expected(hint.originalException) ? null : scrubEvent(event)),
  });
}

/** For React's root error callbacks: uncaught and boundary-caught render errors, still logged to the console. */
export const reactErrorHandler = Sentry.reactErrorHandler((error) => console.error(error));
