/**
 * Sarvam Vision via Sarvam's Document Intelligence REST API (/doc-ai/v1), built for Indian languages.
 * Called with fetch directly: the official `sarvamai` SDK declares no license, which our standard bans.
 *
 * Flow: POST /doc-ai/v1/job/parse (multipart) -> poll GET /job/{id}/status -> GET /job/{id}/results.
 * The parse results give page text (Markdown) but no per-word confidence, so `confidence` is null.
 */
import { type OcrEngine, type OcrHints, type OcrResult, toJpeg } from "./types.js";

export interface SarvamConfig {
  apiKey: string;
  baseUrl?: string;
  /** BCP-47 language; Marathi is mr-IN. */
  language?: string;
  model?: string;
  pollMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const TERMINAL = new Set(["completed", "partially_completed", "failed", "rejected"]);

interface ParseResults {
  status: string;
  documents?: { pages?: { page_number?: number; content?: string }[] }[];
}

/** Markdown/HTML page content to plain text, keeping table cells apart. */
export function markdownToText(md: string): string {
  return (
    md
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
      .replace(/<\/t[dh]>/gi, " | ")
      .replace(/<[^>]+>/g, "")
      // Only spaces/tabs here: \s would also eat newlines and glue table rows together.
      .replace(/^[ \t]*\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)*\|?[ \t]*$\n?/gm, "") // table separator rows
      .replace(/^[ \t]*\|[ \t]*|[ \t]*\|[ \t]*$/gm, "") // outer pipes
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export class SarvamEngine implements OcrEngine {
  readonly name: string;
  readonly external = true;
  private readonly base: string;
  private readonly f: typeof fetch;

  constructor(private cfg: SarvamConfig) {
    this.base = (cfg.baseUrl ?? "https://api.sarvam.ai").replace(/\/$/, "");
    this.f = cfg.fetch ?? fetch;
    this.name = `sarvam-vision${cfg.model ? `:${cfg.model}` : ""}`;
  }

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.f(`${this.base}${path}`, {
      ...init,
      headers: { "api-subscription-key": this.cfg.apiKey, ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Sarvam ${init?.method ?? "GET"} ${path} failed: ${res.status} ${body.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async recognize(image: Buffer, hints: OcrHints = {}): Promise<OcrResult> {
    const { jpeg, width, height } = await toJpeg(image, 3000);

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }), "page.jpg");
    form.append("language", this.cfg.language ?? "mr-IN");
    form.append("content_type", hints.contentType ?? "mixed");
    if (this.cfg.model) form.append("model", this.cfg.model);
    const job = await this.call<{ job_id: string }>("/doc-ai/v1/job/parse", { method: "POST", body: form });

    const started = Date.now();
    const timeout = this.cfg.timeoutMs ?? 120_000;
    let status = "";
    while (!TERMINAL.has(status)) {
      if (Date.now() - started > timeout) throw new Error(`Sarvam job ${job.job_id} timed out (${status})`);
      await new Promise((r) => setTimeout(r, this.cfg.pollMs ?? 1500));
      status = (await this.call<{ status: string }>(`/doc-ai/v1/job/${encodeURIComponent(job.job_id)}/status`)).status;
    }
    if (status === "failed" || status === "rejected") throw new Error(`Sarvam job ${job.job_id} ${status}`);

    const results = await this.call<ParseResults>(`/doc-ai/v1/job/${encodeURIComponent(job.job_id)}/results?format=md`);
    const pages = (results.documents ?? []).flatMap((d) => d.pages ?? []);
    pages.sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));
    const text = markdownToText(pages.map((p) => p.content ?? "").join("\n\n")).normalize("NFC");
    return { engine: this.name, text, confidence: null, words: [], width, height };
  }

  async close() {}
}
