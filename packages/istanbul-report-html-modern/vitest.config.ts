import { join } from "node:path";

import { defineConfig } from "vitest/config";

const htmlModernReporter = join(process.cwd(), "../../html-modern.cjs");

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      reportsDirectory: "./coverage/raw",
      reporter: [
        [
          htmlModernReporter,
          {
            writeReportDataJson: true,
            fileTags: [
              { glob: "src/page/**", tag: "page" },
              { glob: "src/components/**", tag: "components" },
              { glob: "src/helpers/**", tag: "helpers" },
              { glob: "src/*.{ts,tsx}", tag: "core" },
            ],
          },
        ],
      ],
      watermarks: {
        lines: [80, 95],
        functions: [80, 95],
        branches: [80, 95],
        statements: [80, 95],
      },
    },
  },
});
