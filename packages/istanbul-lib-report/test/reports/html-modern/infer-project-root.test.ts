import { assert, describe, it } from "vitest";

import { inferProjectRoot } from "../../../src/reports/html-modern/infer-project-root";

describe("inferProjectRoot", () => {
  it("returns the common parent of coverage file directories", () => {
    assert.equal(
      inferProjectRoot([
        "/Users/me/proj/src/a.ts",
        "/Users/me/proj/src/b.ts",
        "/Users/me/proj/lib/c.ts",
      ]),
      "/Users/me/proj",
    );
  });

  it("returns the shared directory when all files share one folder", () => {
    assert.equal(
      inferProjectRoot(["/Users/me/proj/src/a.ts", "/Users/me/proj/src/b.ts"]),
      "/Users/me/proj/src",
    );
  });

  it("keeps a shallow common parent when only the top segment matches", () => {
    assert.equal(inferProjectRoot(["/Users/a/x.ts", "/Users/b/y.ts"]), "/Users");
  });

  it("returns undefined when there is no common parent", () => {
    assert.equal(inferProjectRoot(["/Users/a/x.ts", "/opt/b/y.ts"]), undefined);
    assert.equal(inferProjectRoot(["/foo.ts", "/bar.ts"]), undefined);
  });

  it("returns undefined for an empty list", () => {
    assert.equal(inferProjectRoot([]), undefined);
  });

  it("normalizes Windows separators", () => {
    assert.equal(
      inferProjectRoot(["C:\\Users\\me\\proj\\src\\a.ts", "C:\\Users\\me\\proj\\lib\\b.ts"]),
      "C:/Users/me/proj",
    );
  });
});
