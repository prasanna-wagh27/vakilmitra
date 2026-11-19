export const API_BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Calls /api/admin/*. The staff session is an HttpOnly cookie on the API. */
export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
): Promise<T> {
  const qs = init.query ? new URLSearchParams(Object.entries(init.query).filter((e): e is [string, string] => !!e[1])).toString() : "";
  const res = await fetch(`${API_BASE}/api/admin${path}${qs ? `?${qs}` : ""}`, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "include",
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "error", data.message ?? res.statusText);
  return data as T;
}
