import { join } from "node:path";

import { defineConfig } from "vitest/config";
const htmlModernReporter = join(process.cwd(), "html-modern.cjs");

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["packages/**/src/**/*.ts"],
      reporter: ["json", [htmlModernReporter, { writeReportDataJson: true }]],
    },
    projects: ["packages/*/vitest.config.*"],
  },
});
