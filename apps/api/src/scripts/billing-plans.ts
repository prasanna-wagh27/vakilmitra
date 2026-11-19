/**
 * Creates the three monthly plans in Razorpay (test or live, depending on the keys) and prints
 * the env lines to add. Run once per Razorpay account: pnpm --filter @vakilmitra/api billing:plans
 * Razorpay charges the plan amount as is, so it includes GST.
 */
import { GST_RATE, PAID_PLANS, PLANS } from "@vakilmitra/shared";

const id = process.env.RAZORPAY_KEY_ID;
const secret = process.env.RAZORPAY_KEY_SECRET;
if (!id || !secret) {
  console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET first.");
  process.exit(1);
}

const names = { SOLO: "VakilMitra Solo", PRO: "VakilMitra Pro", CHAMBER: "VakilMitra Chamber" } as const;

for (const plan of PAID_PLANS) {
  const base = PLANS[plan].price!.MONTHLY;
  const res = await fetch("https://api.razorpay.com/v1/plans", {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      period: "monthly",
      interval: 1,
      item: { name: names[plan], amount: base + Math.round(base * GST_RATE), currency: "INR", description: "Monthly, including 18% GST" },
      notes: { plan },
    }),
  });
  const body = (await res.json()) as { id?: string; error?: { description?: string } };
  if (!res.ok || !body.id) {
    console.error(`${plan}: ${body.error?.description ?? res.status}`);
    process.exit(1);
  }
  console.log(`RAZORPAY_PLAN_${plan}=${body.id}`);
}
