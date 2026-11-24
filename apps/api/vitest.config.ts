import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 15000,
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://vakilmitra:vakilmitra@localhost:5432/vakilmitra_test",
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret",
      API_URL: "http://localhost:4000",
      WEB_ORIGIN: "http://localhost:5173",
      RAZORPAY_KEY_ID: "rzp_test_key",
      RAZORPAY_KEY_SECRET: "test-key-secret",
      RAZORPAY_WEBHOOK_SECRET: "test-webhook-secret",
      RAZORPAY_PLAN_SOLO: "plan_solo",
      RAZORPAY_PLAN_PRO: "plan_pro",
      RAZORPAY_PLAN_CHAMBER: "plan_chamber",
      // Used only by billing-gst.test.ts, which turns GST_REGISTERED on; receipts never carry it.
      BILLING_SUPPLIER_GSTIN: "27AAAAA0000A1Z5",
      BILLING_SAC: "998314",
    },
  },
});
