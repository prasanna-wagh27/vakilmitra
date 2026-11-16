import { API_BASE, ApiError } from "../api";
import { RetryableError } from "./upload-queue";

/** POST one page. Network errors, timeouts, 429 and 5xx are retryable; other 4xx are not. */
export async function uploadPage(documentId: string, pageNo: number, blob: Blob): Promise<void> {
  const body = new FormData();
  body.append("page", blob, `page-${pageNo}.jpg`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/documents/${documentId}/pages?pageNo=${pageNo}`, {
      method: "POST",
      body,
      credentials: "include",
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new RetryableError(e instanceof Error ? e.message : "Network error");
  }
  if (res.ok) return;
  const data = await res.json().catch(() => ({}));
  const message = data.message ?? res.statusText;
  if (res.status === 408 || res.status === 429 || res.status >= 500) throw new RetryableError(message);
  throw new ApiError(res.status, data.error ?? "error", message);
}
