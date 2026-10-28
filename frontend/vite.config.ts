/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on the LAN too, so a phone on the same Wi-Fi can open the dev site.
    host: true,
    proxy: { "/api": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    // e2e/ is Playwright's (npm run e2e), not Vitest's.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
