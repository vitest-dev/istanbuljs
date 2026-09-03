import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

import { REPORT_DATA_PLACEHOLDER } from "./report-data-placeholder.js";

const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(packageRoot, "../..");
const mockPath = join(repoRoot, "coverage/report-data.json");

/** In dev, neutralize the production placeholder so inline HTML stays valid JS. */
export function reportDataDevPlugin(): Plugin {
  return {
    name: "report-data-dev",
    apply: "serve",
    transformIndexHtml(html) {
      if (!html.includes(REPORT_DATA_PLACEHOLDER)) {
        return html;
      }

      if (!fs.existsSync(mockPath)) {
        console.warn(
          `[report-data-dev] ${mockPath} not found; run repo tests once to generate it, or use pnpm play`,
        );
      }

      return html.replace(REPORT_DATA_PLACEHOLDER, "undefined");
    },
  };
}
