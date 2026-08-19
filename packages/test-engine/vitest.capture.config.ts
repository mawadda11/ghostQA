import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["integration/**/*.integration.ts"],
    testTimeout: 60_000,
  },
});

