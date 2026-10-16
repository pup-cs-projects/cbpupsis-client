import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // One port per portal (student 3000, faculty 3001, admin 3002, superadmin 3003), so all
    // four run side by side; the API's dev stack allows exactly these origins.
    port: 3003,
    strictPort: true,
    // File events do not cross a Docker bind mount on Windows or macOS; the API repo's
    // `make up` sets this for the client containers.
    watch: process.env.VITE_WATCH_POLLING ? { usePolling: true, interval: 300 } : undefined,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/test/**", "src/**/*.test.{ts,tsx}"],
    },
  },
});
