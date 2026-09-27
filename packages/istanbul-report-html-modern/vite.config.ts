import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

import { reportDataDevPlugin } from "./vite-plugin-report-data-dev.js";

const packageRoot = dirname(fileURLToPath(import.meta.url));

function libAliases(mode: string) {
  const production = mode === "production";
  return [
    {
      find: "@vitest/istanbul-report-html-modern/style.css",
      replacement: join(packageRoot, production ? "dist/style.css" : "src/index.css"),
    },
    {
      find: "@vitest/istanbul-report-html-modern",
      replacement: join(packageRoot, production ? "dist/index.js" : "src/index.ts"),
    },
  ] as const;
}

/** Single-file HTML report page → `dist/page/index.html` */
export default defineConfig(({ mode }) => ({
  root: join(packageRoot, "src/page"),
  plugins: [preact(), reportDataDevPlugin(), viteSingleFile()],
  resolve: {
    alias: [
      ...libAliases(mode),
      {
        find: "@repo/fixtures",
        replacement: join(packageRoot, "coverage"),
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
