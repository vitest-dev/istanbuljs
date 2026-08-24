import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["packages/**/src/**/*.ts"],
    },
    projects: ["packages/*/vitest.config.*"],
  },
});
