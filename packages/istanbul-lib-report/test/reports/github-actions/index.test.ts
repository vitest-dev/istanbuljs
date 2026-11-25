import { createCoverageMap } from "@vitest/istanbul-lib-coverage";
import type { FileCoverageData } from "@vitest/istanbul-lib-coverage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { create, createContext, FileWriter } from "../../../src/index";
import type { GithubActionsOptions } from "../../../src/index";

const range = (line: number) => ({ start: { line, column: 0 }, end: { line, column: 10 } });

function fileCoverage(path: string, overrides: Partial<FileCoverageData>): FileCoverageData {
  return { path, statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {}, ...overrides };
}

function report(...files: FileCoverageData[]): string {
  return reportWith({}, ...files);
}

function reportWith(opts: GithubActionsOptions, ...files: FileCoverageData[]): string {
  const coverageMap = createCoverageMap({});
  for (const file of files) coverageMap.addFileCoverage(file);
  create("github-actions", opts).execute(createContext({ coverageMap }));
  return FileWriter.getOutput();
}

describe("github-actions report", () => {
  beforeAll(() => FileWriter.startCapture());
  afterAll(() => FileWriter.stopCapture());
  beforeEach(() => FileWriter.resetOutput());

  it("annotates each file at its first uncovered line and lists the rest as ranges", () => {
    const output = report(
      fileCoverage("/repo/src/render.ts", {
        statementMap: { 0: range(12), 1: range(40), 2: range(41), 3: range(42), 4: range(55) },
        s: { 0: 3, 1: 0, 2: 0, 3: 0, 4: 0 },
      }),
      fileCoverage("/repo/src/parse.ts", {
        statementMap: { 0: range(7) },
        s: { 0: 0 },
      }),
    );

    expect(output.trim().split("\n").sort()).toEqual([
      "::warning file=/repo/src/parse.ts,line=7,title=Uncovered code::Uncovered line 7",
      "::warning file=/repo/src/render.ts,line=40,title=Uncovered code::Uncovered lines 40-42, 55",
    ]);
  });

  it("counts uncovered functions and branch paths whose statements ran", () => {
    const output = report(
      fileCoverage("/repo/src/branch.ts", {
        statementMap: { 0: range(3) },
        s: { 0: 1 },
        fnMap: { 0: { name: "unused", decl: range(20), loc: range(21), line: 21 } },
        f: { 0: 0 },
        branchMap: {
          0: { type: "if", line: 4, loc: range(4), locations: [range(5), range(9)] },
        },
        b: { 0: [2, 0] },
      }),
    );

    expect(output).toContain("::Uncovered lines 9, 21");
  });

  it("anchors an uncovered implicit else at its if statement", () => {
    const implicitElse = { start: {}, end: {} } as ReturnType<typeof range>;
    const output = report(
      fileCoverage("/repo/src/guard.ts", {
        statementMap: { 0: range(30) },
        s: { 0: 1 },
        branchMap: {
          0: { type: "if", line: 31, loc: range(31), locations: [range(32), implicitElse] },
        },
        b: { 0: [4, 0] },
      }),
    );

    expect(output).toContain("::Uncovered line 31");
  });

  it("uses the configured annotation level", () => {
    const output = reportWith(
      { level: "error" },
      fileCoverage("/repo/src/gate.ts", { statementMap: { 0: range(8) }, s: { 0: 0 } }),
    );

    expect(output).toMatch(/^::error file=\/repo\/src\/gate.ts,line=8,/);
  });

  it("prints nothing for fully covered files", () => {
    const output = report(
      fileCoverage("/repo/src/covered.ts", { statementMap: { 0: range(1) }, s: { 0: 1 } }),
    );

    expect(output).toBe("");
  });

  it("escapes workflow command separators in the file path", () => {
    const output = report(
      fileCoverage("C:\\repo\\a,b%.ts", { statementMap: { 0: range(2) }, s: { 0: 0 } }),
    );

    expect(output).toContain("file=C%3A\\repo\\a%2Cb%25.ts,line=2");
  });
});
