import { defineConfig } from "tsdown";

export default defineConfig([
  {
    name: "node",
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["esm"],
    tsconfig: "./tsconfig.json",
    target: "esnext",
    clean: true,
    unbundle: true,

    minify: {
      codegen: { removeWhitespace: false },
      compress: true,
      mangle: { keepNames: true },
    },
    outputOptions: { comments: false },

    dts: true,

    /* static assets the html report copies next to its generated pages */
    copy: [{ from: "src/reports/html/assets", to: "dist/reports/html" }],
  },
  {
    /*
     * The html-spa report's browser bundle: a plain IIFE script loaded by
     * the generated report page after `window.data` is set, so it must stay
     * a single self-contained `bundle.js`.
     */
    name: "html-spa",
    entry: { bundle: "src/reports/html-spa/src/index.tsx" },
    outDir: "dist/reports/html-spa/assets",
    format: "iife",
    platform: "browser",
    target: "es2020",
    minify: true,
    dts: false,
    /* the shared clean of the "node" config already wipes `dist` */
    clean: false,
    /* keep the historical `bundle.js` name instead of tsdown's `bundle.iife.js` */
    outputOptions: { entryFileNames: "bundle.js" },

    /* the report's static assets, copied next to the bundle */
    copy: [{ from: "src/reports/html-spa/assets", to: "dist/reports/html-spa" }],
  },
]);
