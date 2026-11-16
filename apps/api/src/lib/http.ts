export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what = "Resource") => new HttpError(404, "not_found", `${what} not found`);
export const forbidden = (message = "You do not have access to this") => new HttpError(403, "forbidden", message);

/** Escape LIKE wildcards in user search text. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
