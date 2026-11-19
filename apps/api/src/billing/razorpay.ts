import { createHmac, timingSafeEqual } from "node:crypto";

/** The few Razorpay calls we use. Plain REST over fetch; tests swap in a fake. */
export interface RazorpayLike {
  createOrder(p: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  createSubscription(p: { planId: string; notes: Record<string, string> }): Promise<{ id: string }>;
  cancelSubscription(id: string, atCycleEnd: boolean): Promise<void>;
  refundPayment(paymentId: string): Promise<{ id: string }>;
}

export class RazorpayClient implements RazorpayLike {
  constructor(
    private keyId: string,
    private keySecret: string,
    private base = "https://api.razorpay.com/v1",
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } };
    if (!res.ok) throw new Error(`Razorpay ${method} ${path} failed (${res.status}): ${data.error?.description ?? "unknown"}`);
    return data as T;
  }

  createOrder(p: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
    return this.call<{ id: string }>("POST", "/orders", { amount: p.amountPaise, currency: "INR", receipt: p.receipt, notes: p.notes });
  }

  createSubscription(p: { planId: string; notes: Record<string, string> }) {
    // 120 monthly cycles = 10 years; customers cancel any time.
    return this.call<{ id: string }>("POST", "/subscriptions", { plan_id: p.planId, total_count: 120, customer_notify: 1, notes: p.notes });
  }

  async cancelSubscription(id: string, atCycleEnd: boolean) {
    await this.call("POST", `/subscriptions/${id}/cancel`, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 });
  }

  refundPayment(paymentId: string) {
    return this.call<{ id: string }>("POST", `/payments/${paymentId}/refund`, {});
  }
}

const hmac = (secret: string, data: string | Buffer) => createHmac("sha256", secret).update(data).digest("hex");

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Checkout success signature: order_id|payment_id for orders, payment_id|subscription_id for subscriptions. */
export function checkoutSignatureValid(
  keySecret: string,
  p: { paymentId: string; signature: string; orderId?: string; subscriptionId?: string },
) {
  const payload = p.orderId ? `${p.orderId}|${p.paymentId}` : p.subscriptionId ? `${p.paymentId}|${p.subscriptionId}` : null;
  return payload !== null && safeEqual(hmac(keySecret, payload), p.signature);
}

export function webhookSignatureValid(webhookSecret: string, rawBody: Buffer, signature: string | undefined) {
  return !!signature && safeEqual(hmac(webhookSecret, rawBody), signature);
}

export { hmac as razorpayHmac };
