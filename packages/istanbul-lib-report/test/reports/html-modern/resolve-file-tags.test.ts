import { assert, describe, it } from "vitest";

import {
  collectAvailableTags,
  resolveFileTags,
} from "../../../src/reports/html-modern/resolve-file-tags";

describe("collectAvailableTags", () => {
  it("returns unique tags in config order", () => {
    assert.deepEqual(
      collectAvailableTags([
        { glob: "src/a/**", tag: "team-a" },
        { glob: "src/b/**", tag: "team-b" },
        { glob: "src/c/**", tag: "team-a" },
      ]),
      ["team-a", "team-b"],
    );
  });
});

describe("resolveFileTags", () => {
  it("assigns multiple tags to one file", () => {
    const tags = resolveFileTags(
      ["src/payments/api.ts"],
      [
        { glob: "src/payments/**", tag: "payments" },
        { glob: "**/*.ts", tag: "typescript" },
      ],
    );

    assert.deepEqual(tags["src/payments/api.ts"], ["payments", "typescript"]);
  });

  it("omits files with no matching tags", () => {
    const tags = resolveFileTags(
      ["src/auth/login.ts"],
      [{ glob: "src/payments/**", tag: "payments" }],
    );
    assert.deepEqual(tags, {});
  });

  it("normalizes backslashes before matching", () => {
    const tags = resolveFileTags(
      ["src\\payments\\api.ts"],
      [{ glob: "src/payments/**", tag: "payments" }],
    );
    assert.deepEqual(tags["src/payments/api.ts"], ["payments"]);
  });
});
