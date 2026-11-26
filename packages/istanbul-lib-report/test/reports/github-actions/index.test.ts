import { createCoverageMap } from "@vitest/istanbul-lib-coverage";
import type { FileCoverageData } from "@vitest/istanbul-lib-coverage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { create, createContext, FileWriter } from "../../../src/index";
import type { GithubActionsOptions } from "../../../src/index";

const range = (line: number) => ({ start: { line, column: 0 }, end: { line, column: 10 } });

function fileCoverage(path: string, overrides: Partial<FileCoverageData>): FileCoverageData {
  return { path, statementMap: {}, fnMap: {}, branchMap: {}, s: {}, f: {}, b: {}, ...overrides };
}

function report(files: FileCoverageData[], opts: GithubActionsOptions = {}): string {
  const coverageMap = createCoverageMap({});
  for (const file of files) coverageMap.addFileCoverage(file);
  create("github-actions", opts).execute(createContext({ coverageMap }));
  return FileWriter.getOutput();
}

describe("github-actions report", () => {
  beforeAll(() => FileWriter.startCapture());
  afterAll(() => FileWriter.stopCapture());
  beforeEach(() => FileWriter.resetOutput());

  it("annotates each run of uncovered lines, spanning lines without statements", () => {
    const output = report([
      fileCoverage("/repo/src/render.ts", {
        statementMap: { 0: range(12), 1: range(40), 2: range(42), 3: range(50), 4: range(55) },
        s: { 0: 3, 1: 0, 2: 0, 3: 2, 4: 0 },
      }),
      fileCoverage("/repo/src/parse.ts", {
        statementMap: { 0: range(7) },
        s: { 0: 0 },
      }),
    ]);

    expect(output.trim().split("\n").sort()).toEqual([
      "::warning file=/repo/src/parse.ts,line=7,endLine=7,title=Uncovered code::Uncovered line 7",
      "::warning file=/repo/src/render.ts,line=40,endLine=42,title=Uncovered code::Uncovered lines 40-42",
      "::warning file=/repo/src/render.ts,line=55,endLine=55,title=Uncovered code::Uncovered line 55",
    ]);
  });

  it("counts partially covered branches and functions whose lines ran", () => {
    const output = report([
      fileCoverage("/repo/src/branch.ts", {
        statementMap: { 0: range(4), 1: range(10), 2: range(21) },
        s: { 0: 1, 1: 1, 2: 1 },
        fnMap: { 0: { name: "unused", decl: range(20), loc: range(21), line: 21 } },
        f: { 0: 0 },
        branchMap: {
          0: { type: "if", line: 4, loc: range(4), locations: [range(5), range(9)] },
        },
        b: { 0: [2, 0] },
      }),
    ]);

    expect(output).toContain("line=4,endLine=4,");
    expect(output).toContain("line=21,endLine=21,");
  });

  it("uses the configured annotation level", () => {
    const output = report(
      [fileCoverage("/repo/src/gate.ts", { statementMap: { 0: range(8) }, s: { 0: 0 } })],
      { level: "error" },
    );

    expect(output).toMatch(/^::error file=\/repo\/src\/gate.ts,line=8,/);
  });

  it("prints nothing for fully covered files", () => {
    const output = report([
      fileCoverage("/repo/src/covered.ts", { statementMap: { 0: range(1) }, s: { 0: 1 } }),
    ]);

    expect(output).toBe("");
  });

  it("escapes workflow command separators in the file path", () => {
    const output = report([
      fileCoverage("C:\\repo\\a,b%\r\n.ts", { statementMap: { 0: range(2) }, s: { 0: 0 } }),
    ]);

    expect(output).toContain("file=C%3A\\repo\\a%2Cb%25%0D%0A.ts,line=2");
  });
});
