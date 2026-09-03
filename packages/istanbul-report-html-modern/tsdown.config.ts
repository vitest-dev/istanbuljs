import { defineConfig } from "tsdown";

/** React component library → `dist/index.js` + `dist/style.css` */
export default defineConfig({
  entry: ["src/lib/index.ts"],
  platform: "neutral",
  dts: true,
  exports: true,
  clean: true,
});
