import { join } from "node:path";

import { defineConfig } from "vitest/config";
const htmlModernReporter = join(process.cwd(), "html-modern.cjs");

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "v8",
      include: ["packages/**/src/**/*.ts"],
      reporter: [
        "json",
        [
          "html-modern",
          {
            writeReportDataJson: true,
            fileTags: [
              { glob: "packages/istanbul-lib-coverage/**", tag: "lib-coverage" },
              { glob: "packages/istanbul-lib-instrument/**", tag: "lib-instrument" },
              { glob: "packages/istanbul-lib-report/**", tag: "lib-report" },
              { glob: "packages/istanbul-lib-source-maps/**", tag: "lib-source-maps" },
              { glob: "packages/istanbul-report-html-modern/**", tag: "html-modern" },
            ],
          },
        ],
      ],
    },
    projects: ["packages/*/vitest.config.*"],
  },
});
