/// <reference types="vitest/config" />
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(packageRoot, "../..");
const monacoCss = join(
  dirname(require.resolve("monaco-editor")),
  "../../min/vs/editor/editor.main.css",
);

/** UI playground (consumes the public library API). */
export default defineConfig({
  root: join(packageRoot, "playground"),
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@vitest/istanbul-report-html-modern/style.css",
        replacement: join(packageRoot, "src/lib/index.css"),
      },
      {
        find: "@vitest/istanbul-report-html-modern",
        replacement: join(packageRoot, "src/lib/index.ts"),
      },
      {
        find: "@repo/fixtures",
        replacement: join(repoRoot, "coverage"),
      },
      {
        find: "monaco-editor-css",
        replacement: monacoCss,
      },
    ],
  },
  optimizeDeps: {
    include: [
      "@ant-design/icons",
      "antd",
      "monaco-editor/editor/editor.api",
      "monaco-editor/editor/contrib/hover/browser/hoverContribution",
      "monaco-editor/languages/definitions/javascript/register",
      "monaco-editor/languages/definitions/typescript/register",
      "react-dom/server",
      "react-highlight-words",
    ],
  },
  server: {
    port: 30614,
  },
});
