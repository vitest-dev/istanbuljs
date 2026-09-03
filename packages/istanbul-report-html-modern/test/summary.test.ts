import { assert, describe, it } from "vitest";

import { buildReportFiles } from "../src/lib/helpers/build-report-files";
import { deriveSummaryViews } from "../src/lib/helpers/derive-views";
import { computeLineHits } from "../src/lib/helpers/line-hits";
import {
  buildSummaryTree,
  fileCoverageToSummary,
  filesToDataSource,
  percent,
} from "../src/lib/helpers/summary";
import type { FileCoverageData } from "../src/lib/types";

function makeFile(path: string, statementHits: number[]): FileCoverageData {
  const statementMap: FileCoverageData["statementMap"] = {};
  const s: Record<string, number> = {};
  statementHits.forEach((hits, index) => {
    const id = String(index);
    statementMap[id] = {
      start: { line: index + 1, column: 0 },
      end: { line: index + 1, column: 1 },
    };
    s[id] = hits;
  });
  return {
    path,
    statementMap,
    fnMap: {},
    branchMap: {},
    s,
    f: {},
    b: {},
  };
}

describe("percent / filesToDataSource", () => {
  it("computes rounded coverage percent", () => {
    assert.equal(percent(1, 2), 50);
    assert.equal(percent(0, 0), 100);
  });

  it("maps files to summary rows", () => {
    const rows = filesToDataSource([makeFile("src/a.ts", [1, 0])]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.path, "src/a.ts");
    assert.equal(rows[0]!.statements.total, 2);
    assert.equal(rows[0]!.statements.covered, 1);
    assert.equal(rows[0]!.lines.total, 2);
  });
});

describe("buildSummaryTree", () => {
  it("groups children under the current path", () => {
    const tree = buildSummaryTree("", [
      { path: "src/a.ts", ...fileCoverageToSummary(makeFile("src/a.ts", [1])) },
      { path: "src/b.ts", ...fileCoverageToSummary(makeFile("src/b.ts", [0])) },
      { path: "lib/c.ts", ...fileCoverageToSummary(makeFile("lib/c.ts", [1])) },
    ]);

    assert.equal(tree.path, "");
    assert.deepEqual(
      tree.children.map((child) => child.path),
      ["lib", "src"],
    );
  });
});

describe("deriveSummaryViews", () => {
  it("filters by keywords and current path", () => {
    const dataSource = [
      { path: "src/a.ts", ...fileCoverageToSummary(makeFile("src/a.ts", [1])) },
      { path: "src/util/b.ts", ...fileCoverageToSummary(makeFile("src/util/b.ts", [1])) },
      { path: "lib/c.ts", ...fileCoverageToSummary(makeFile("lib/c.ts", [1])) },
    ];

    const views = deriveSummaryViews({
      dataSource,
      filenameKeywords: "util",
      value: "src",
    });

    assert.deepEqual(
      views.listDataSource.map((item) => item.path),
      ["src/util/b.ts"],
    );
  });
});

describe("computeLineHits", () => {
  it("maps statement hits onto source lines", () => {
    const coverage = makeFile("a.ts", [3, 0]);
    const result = computeLineHits(coverage, "line1\nline2\nline3");
    assert.equal(result.lines[0]!.executionNumber, 3);
    assert.equal(result.lines[1]!.executionNumber, 0);
    assert.equal(result.lines[2]!.executionNumber, -1);
  });
});

describe("buildReportFiles", () => {
  it("attaches sources and keeps absolute coverage paths", () => {
    const { files, projectRoot, name } = buildReportFiles({
      projectRoot: "/proj",
      coverage: {
        "/proj/src/a.ts": makeFile("/proj/src/a.ts", [1]),
      },
      sources: {
        "/proj/src/a.ts": "export {}",
      },
    });

    assert.equal(projectRoot, "/proj");
    assert.equal(name, "proj");
    assert.equal(files.length, 1);
    assert.equal(files[0]!.path, "/proj/src/a.ts");
    assert.equal(files[0]!.source, "export {}");
  });
});
