import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  // Pre-bundle the scanner's lazy dependencies so the dev server never reloads mid-scan.
  optimizeDeps: { include: ["pdfjs-dist"] },
  server: {
    port: 5173,
    // Same-origin proxy in development so the Better Auth session cookie just works.
    proxy: { "/api": process.env.API_URL ?? "http://localhost:4000" },
  },
});
