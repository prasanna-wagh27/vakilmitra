/**
 * Background page uploads while the advocate keeps scanning.
 * Framework-free (React reads it through useSyncExternalStore), so it can be unit-tested.
 * Retries network errors, timeouts, 429 and 5xx with backoff; other errors fail fast.
 */
/** waiting = a retry is scheduled after a recoverable error; failed = gave up (the advocate can retry). */
export type UploadStatus = "queued" | "uploading" | "waiting" | "done" | "failed";

export interface UploadItem {
  key: string;
  pageNo: number;
  blob: Blob;
  thumbUrl: string;
  status: UploadStatus;
  attempts: number;
  error?: string;
}

export class RetryableError extends Error {}

export interface UploadQueueOptions {
  concurrency?: number;
  maxAttempts?: number;
  backoffMs?: (attempt: number) => number;
  /** For tests: replaces setTimeout. */
  schedule?: (fn: () => void, ms: number) => void;
}

export class UploadQueue {
  private items: UploadItem[] = [];
  private listeners = new Set<() => void>();
  private active = 0;
  private seq = 0;
  private readonly concurrency: number;
  private readonly maxAttempts: number;
  private readonly backoffMs: (attempt: number) => number;
  private readonly schedule: (fn: () => void, ms: number) => void;

  constructor(
    private send: (item: UploadItem) => Promise<void>,
    opts: UploadQueueOptions = {},
  ) {
    this.concurrency = opts.concurrency ?? 2;
    this.maxAttempts = opts.maxAttempts ?? 5;
    this.backoffMs = opts.backoffMs ?? ((n) => Math.min(1000 * 2 ** n, 15_000));
    this.schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.items;

  /** Pages not yet safely on the server. */
  get pending() {
    return this.items.filter((i) => i.status !== "done").length;
  }

  /** Nothing in flight or scheduled: every page is either uploaded or has given up. */
  get settled() {
    return this.items.every((i) => i.status === "done" || i.status === "failed");
  }

  add(pageNo: number, blob: Blob, thumbUrl: string) {
    this.items = [...this.items, { key: `u${++this.seq}`, pageNo, blob, thumbUrl, status: "queued", attempts: 0 }];
    this.emit();
    this.pump();
  }

  retry(key: string) {
    this.patch(key, { status: "queued", attempts: 0, error: undefined });
    this.pump();
  }

  private patch(key: string, p: Partial<UploadItem>) {
    this.items = this.items.map((i) => (i.key === key ? { ...i, ...p } : i));
    this.emit();
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  private pump() {
    while (this.active < this.concurrency) {
      const next = this.items.find((i) => i.status === "queued");
      if (!next) return;
      this.active++;
      this.patch(next.key, { status: "uploading" });
      void this.run(next.key);
    }
  }

  private async run(key: string) {
    const item = this.items.find((i) => i.key === key)!;
    try {
      await this.send(item);
      this.patch(key, { status: "done", error: undefined });
    } catch (e) {
      const attempts = item.attempts + 1;
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof RetryableError && attempts < this.maxAttempts) {
        // Free the slot while waiting, then re-queue.
        this.patch(key, { status: "waiting", attempts, error: message });
        this.schedule(() => {
          if (this.items.find((i) => i.key === key)?.status === "waiting") this.retryAfterBackoff(key, attempts);
        }, this.backoffMs(attempts));
      } else {
        this.patch(key, { status: "failed", attempts, error: message });
      }
    } finally {
      this.active--;
      this.pump();
    }
  }

  private retryAfterBackoff(key: string, attempts: number) {
    this.patch(key, { status: "queued", attempts });
    this.pump();
  }
}
