import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

import { reportDataDevPlugin } from "./vite-plugin-report-data-dev.js";

const require = createRequire(import.meta.url);
const packageRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(packageRoot, "../..");
const monacoCss = join(
  dirname(require.resolve("monaco-editor")),
  "../../min/vs/editor/editor.main.css",
);

function libAliases(mode: string) {
  const production = mode === "production";
  return [
    {
      find: "@vitest/istanbul-report-html-modern/style.css",
      replacement: join(packageRoot, production ? "dist/style.css" : "src/lib/index.css"),
    },
    {
      find: "@vitest/istanbul-report-html-modern",
      replacement: join(packageRoot, production ? "dist/index.js" : "src/lib/index.ts"),
    },
  ] as const;
}

/** Single-file HTML report page → `dist/page/index.html` */
export default defineConfig(({ mode }) => ({
  root: join(packageRoot, "src/page"),
  plugins: [react(), reportDataDevPlugin(), viteSingleFile()],
  resolve: {
    alias: [
      ...libAliases(mode),
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
  build: {
    outDir: join(packageRoot, "dist/page"),
    emptyOutDir: true,
  },
  server: {
    port: 51025,
  },
}));
