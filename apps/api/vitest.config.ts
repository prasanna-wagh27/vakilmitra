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
    },
  },
});
