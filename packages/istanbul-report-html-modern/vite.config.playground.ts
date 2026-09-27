import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const packageRoot = dirname(fileURLToPath(import.meta.url));

/** UI playground (consumes the public library API). */
export default defineConfig({
  root: join(packageRoot, "playground"),
  plugins: [preact()],
  resolve: {
    alias: [
      {
        find: "@vitest/istanbul-report-html-modern/style.css",
        replacement: join(packageRoot, "src/index.css"),
      },
      {
        find: "@vitest/istanbul-report-html-modern",
        replacement: join(packageRoot, "src/index.ts"),
      },
      {
        find: "@repo/fixtures",
        replacement: join(packageRoot, "coverage"),
      },
    ],
  },
  server: {
    port: 30614,
  },
});
