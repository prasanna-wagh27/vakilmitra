import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60_000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://vakilmitra:vakilmitra@localhost:5432/vakilmitra_test" },
  },
});
