import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: ["@e18e/eslint-plugin"],

  rules: {
    "e18e/ban-dependencies": "error",

    // TODO: Remove these and fix source code
    "no-unused-vars": "off",
    "unicorn/no-new-array": "off",
  },

  overrides: [
    {
      files: ["**/test/**"],
      rules: {
        "no-eval": "off",
      },
    },
  ],
  ignorePatterns: ["**/vendor/**"],
});
