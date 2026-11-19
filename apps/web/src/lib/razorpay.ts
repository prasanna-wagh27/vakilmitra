import type { Checkout } from "@vakilmitra/shared";

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (r: { error: { description?: string } }) => void): void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

/** Razorpay's Checkout script is loaded only when someone pays, never on other pages. */
function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load the payment window. Check the connection and try again."));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Opens Razorpay Checkout (UPI, cards, net banking) and resolves with the signed result,
 * or null if the advocate closed the window.
 */
export async function payWithRazorpay(c: Checkout, opts: { description: string; locale: string }): Promise<RazorpaySuccess | null> {
  await loadScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Payment window unavailable");
  return new Promise((resolve, reject) => {
    // A failed attempt keeps the window open so they can retry; it only counts once they close it.
    let failure: string | null = null;
    const rzp = new Razorpay({
      key: c.keyId,
      ...(c.subscriptionId ? { subscription_id: c.subscriptionId } : { order_id: c.orderId, amount: c.totalPaise, currency: "INR" }),
      name: "VakilMitra",
      description: opts.description,
      prefill: c.prefill,
      notes: { checkout: c.id },
      theme: { color: "#1c1917" },
      handler: (r: RazorpaySuccess) => resolve(r),
      modal: { ondismiss: () => (failure ? reject(new Error(failure)) : resolve(null)), confirm_close: true },
    });
    rzp.on("payment.failed", (r) => {
      failure = r.error.description ?? "Payment failed";
    });
    rzp.open();
  });
}
