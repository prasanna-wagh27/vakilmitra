import { describe, expect, it } from "vitest";
import { RetryableError, type UploadItem, UploadQueue } from "../src/lib/scanner/upload-queue";

const blob = new Blob(["x"]);
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A send() we control: each call waits until the test resolves or rejects it. */
function controlled() {
  const calls: { item: UploadItem; resolve: () => void; reject: (e: Error) => void }[] = [];
  const send = (item: UploadItem) => new Promise<void>((resolve, reject) => calls.push({ item, resolve, reject }));
  return { calls, send };
}

describe("UploadQueue", () => {
  it("runs at most `concurrency` uploads at once, in page order", async () => {
    const { calls, send } = controlled();
    const q = new UploadQueue(send, { concurrency: 2 });
    for (const n of [1, 2, 3]) q.add(n, blob, "");
    expect(calls.map((c) => c.item.pageNo)).toEqual([1, 2]);
    expect(q.pending).toBe(3);
    calls[0].resolve();
    await tick();
    expect(calls.map((c) => c.item.pageNo)).toEqual([1, 2, 3]);
    calls[1].resolve();
    calls[2].resolve();
    await tick();
    expect(q.pending).toBe(0);
    expect(q.settled).toBe(true);
  });

  it("retries retryable errors with backoff, then succeeds", async () => {
    const { calls, send } = controlled();
    const timers: (() => void)[] = [];
    const delays: number[] = [];
    const q = new UploadQueue(send, {
      schedule: (fn, ms) => {
        timers.push(fn);
        delays.push(ms);
      },
    });
    q.add(1, blob, "");
    calls[0].reject(new RetryableError("offline"));
    await tick();
    // Backoff is "waiting", not "failed": the page will upload on its own, and the queue is not settled.
    expect(q.getSnapshot()[0]).toMatchObject({ status: "waiting", attempts: 1, error: "offline" });
    expect(q.settled).toBe(false);
    timers.shift()!();
    expect(calls).toHaveLength(2);
    calls[1].resolve();
    await tick();
    expect(q.getSnapshot()[0].status).toBe("done");
    expect(delays).toEqual([2000]);
  });

  it("gives up after maxAttempts and does not retry 4xx-style errors", async () => {
    const { calls, send } = controlled();
    const timers: (() => void)[] = [];
    const q = new UploadQueue(send, { maxAttempts: 2, schedule: (fn) => timers.push(fn) });
    q.add(1, blob, "");
    q.add(2, blob, "");
    calls[0].reject(new RetryableError("503"));
    calls[1].reject(new Error("Pages must be JPEG"));
    await tick();
    timers.shift()!();
    calls[2].reject(new RetryableError("503"));
    await tick();
    expect(timers).toHaveLength(0);
    expect(q.getSnapshot().map((i) => [i.status, i.attempts])).toEqual([
      ["failed", 2],
      ["failed", 1],
    ]);
    expect(q.settled).toBe(true);

    q.retry(q.getSnapshot()[1].key); // manual retry from the UI
    calls[3].resolve();
    await tick();
    expect(q.getSnapshot()[1].status).toBe("done");
  });

  it("notifies subscribers with a new snapshot on every change", () => {
    const q = new UploadQueue(() => new Promise(() => {}));
    const seen: number[] = [];
    q.subscribe(() => seen.push(q.getSnapshot().length));
    const before = q.getSnapshot();
    q.add(1, blob, "");
    expect(q.getSnapshot()).not.toBe(before);
    expect(seen.length).toBeGreaterThan(0);
  });
});
