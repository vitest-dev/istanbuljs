import { playwright } from "@vitest/browser-playwright";
import { defineProject } from "vitest/config";

import pkg from "./package.json" with { type: "json" };

export default defineProject({
  test: {
    name: { label: `${pkg.name} (browser)`, color: "magenta" },
    include: ["test/browser/**/*.test.tsx"],
    browser: {
      enabled: true,
      headless: true,
      screenshotFailures: false,
      provider: playwright({
        launchOptions: process.env.GITHUB_ACTIONS ? { channel: "chrome" } : {},
      }),
      instances: [{ browser: "chromium" }],
    },
  },
});
