import { assert, describe, it } from "vitest";

import {
  projectRootBaseName,
  resolveSource,
  toAbsolutePath,
  toRelativePath,
} from "../src/lib/paths";

describe("toRelativePath", () => {
  it("strips the projectRoot prefix", () => {
    assert.equal(toRelativePath("/proj/src/a.ts", "/proj"), "src/a.ts");
  });

  it("returns empty string when path equals projectRoot", () => {
    assert.equal(toRelativePath("/proj", "/proj"), "");
  });

  it("returns the original path when prefix does not match", () => {
    assert.equal(toRelativePath("/other/a.ts", "/proj"), "/other/a.ts");
  });

  it("normalizes Windows separators", () => {
    assert.equal(toRelativePath("C:\\proj\\src\\a.ts", "C:\\proj"), "src/a.ts");
  });

  it("returns the absolute path when projectRoot is empty", () => {
    assert.equal(toRelativePath("/proj/a.ts", ""), "/proj/a.ts");
  });
});

describe("toAbsolutePath", () => {
  it("joins projectRoot and a relative path", () => {
    assert.equal(toAbsolutePath("src/a.ts", "/proj"), "/proj/src/a.ts");
  });

  it("returns projectRoot when relative path is empty", () => {
    assert.equal(toAbsolutePath("", "/proj"), "/proj");
  });

  it("handles filesystem root as projectRoot", () => {
    assert.equal(toAbsolutePath("a.ts", "/"), "/a.ts");
  });
});

describe("projectRootBaseName", () => {
  it("returns the last path segment", () => {
    assert.equal(projectRootBaseName("/Users/me/istanbuljs"), "istanbuljs");
  });

  it("returns Coverage for empty or root paths", () => {
    assert.equal(projectRootBaseName(""), "Coverage");
    assert.equal(projectRootBaseName("/"), "Coverage");
  });
});

describe("resolveSource", () => {
  const sources = {
    "/proj/src/a.ts": "consola",
    "/proj/src/b.ts": "export {}",
  };

  it("resolves by absolute path", () => {
    assert.equal(resolveSource(sources, "src/a.ts", "/proj"), "consola");
  });

  it("falls back to suffix matching", () => {
    assert.equal(resolveSource({ "/abs/deep/src/c.ts": "c" }, "src/c.ts", "/other"), "c");
  });

  it("returns empty string when not found", () => {
    assert.equal(resolveSource(sources, "missing.ts", "/proj"), "");
  });
});
