import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Routes are split as in the build, so rendering one page (test/prerender.test.tsx) loads only it.
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true })],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  test: { include: ["test/**/*.test.{ts,tsx}"], environment: "node" },
});
