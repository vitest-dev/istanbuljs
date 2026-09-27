import { defineConfig } from "tsdown";

/** Preact component library → `dist/index.js` + `dist/style.css` */
export default defineConfig({
  entry: ["src/index.ts"],
  platform: "neutral",
  dts: true,
  exports: true,
  clean: true,
});
