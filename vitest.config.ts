import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests don't load the PWA / Tailwind plugins.
// Tests are plain logic tests (no browser): src/**/*.test.ts
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
