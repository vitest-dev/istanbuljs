import { configDefaults, defineProject } from "vitest/config";

import pkg from "./package.json" with { type: "json" };

export default defineProject({
  test: {
    name: { label: pkg.name, color: "blue" },
    /* browser-mode tests run in the separate project of vitest.config.browser.ts */
    exclude: [...configDefaults.exclude, "test/browser/**"],
  },
});
