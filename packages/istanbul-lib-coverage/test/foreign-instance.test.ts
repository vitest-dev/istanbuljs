import { describe, it, expect } from "vitest";

import { CoverageMap } from "../src/coverage-map";
import { CoverageSummary } from "../src/coverage-summary";
import { FileCoverage } from "../src/file-coverage";
import * as index from "../src/index";

// Load second, independent copies of the modules. This simulates a duplicate
// install of `@vitest/istanbul-lib-coverage`, where objects created by one copy
// are passed to the other and `instanceof` checks fail.
async function loadForeign<T>(path: string): Promise<T> {
  return (await import(/* @vite-ignore */ `${path}?foreign`)) as T;
}

const foreign = {
  CoverageMap: (await loadForeign<typeof import("../src/coverage-map")>("../src/coverage-map"))
    .CoverageMap,
  CoverageSummary: (
    await loadForeign<typeof import("../src/coverage-summary")>("../src/coverage-summary")
  ).CoverageSummary,
  FileCoverage: (await loadForeign<typeof import("../src/file-coverage")>("../src/file-coverage"))
    .FileCoverage,
};

describe("instances from a duplicate copy of the package", () => {
  it("test setup produces distinct classes", () => {
    expect(foreign.CoverageMap).not.toBe(CoverageMap);
    expect(foreign.CoverageSummary).not.toBe(CoverageSummary);
    expect(foreign.FileCoverage).not.toBe(FileCoverage);
    expect(new foreign.CoverageMap()).not.toBeInstanceOf(CoverageMap);
  });

  it("merges a foreign coverage map", () => {
    const local = new CoverageMap({ "foo.js": new FileCoverage("foo.js") });
    const other = new foreign.CoverageMap({
      "foo.js": new foreign.FileCoverage("foo.js"),
      "bar.js": new foreign.FileCoverage("bar.js"),
    });

    expect(() => local.merge(other)).not.toThrow();
    expect(local.files().sort()).toEqual(["bar.js", "foo.js"]);
    expect(local.fileCoverageFor("bar.js")).toBeInstanceOf(FileCoverage);
  });

  it("constructs from a foreign coverage map", () => {
    const other = new foreign.CoverageMap({ "foo.js": new foreign.FileCoverage("foo.js") });

    const local = new CoverageMap(other);
    expect(local.files()).toEqual(["foo.js"]);
    expect(local.fileCoverageFor("foo.js")).toBeInstanceOf(FileCoverage);
    expect(index.createCoverageMap(other)).toBeInstanceOf(CoverageMap);
  });

  it("constructs from and merges a foreign file coverage", () => {
    const other = new foreign.FileCoverage("foo.js");
    other.data.statementMap["0"] = {
      start: { line: 1, column: 0 },
      end: { line: 1, column: 10 },
    };
    other.data.s["0"] = 3;

    const local = new FileCoverage(other);
    expect(local).toBeInstanceOf(FileCoverage);
    expect(local.data).toBe(other.data);
    expect(index.createFileCoverage(other)).toBeInstanceOf(FileCoverage);

    const map = new CoverageMap();
    map.addFileCoverage(other);
    expect(map.fileCoverageFor("foo.js").s).toEqual({ "0": 3 });
    map.addFileCoverage(other);
    expect(map.fileCoverageFor("foo.js").s).toEqual({ "0": 6 });
  });

  it("constructs from and merges a foreign coverage summary", () => {
    const other = new foreign.CoverageSummary();
    other.lines.total = 10;
    other.lines.covered = 5;

    const local = new CoverageSummary(other);
    expect(local).toBeInstanceOf(CoverageSummary);
    expect(local.data).toBe(other.data);
    expect(index.createCoverageSummary(other)).toBeInstanceOf(CoverageSummary);

    const merged = new CoverageSummary().merge(other);
    expect(merged.lines.total).toBe(10);
    expect(merged.lines.pct).toBe(50);
  });

  it("still treats raw data objects as data", () => {
    const map = new CoverageMap({ "foo.js": new FileCoverage("foo.js").data });
    expect(map.fileCoverageFor("foo.js")).toBeInstanceOf(FileCoverage);
    expect(new CoverageSummary(new CoverageSummary().data).isEmpty()).toBe(true);
  });
});
