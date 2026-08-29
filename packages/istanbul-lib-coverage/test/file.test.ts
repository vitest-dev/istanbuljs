import { describe, it, expect, assert } from "vitest";

import { CoverageSummary } from "../src/coverage-summary";
import type { CoverageSummaryData } from "../src/coverage-summary";
import {
  FileCoverage,
  addHits,
  findNearestContainer,
  addNearestContainerHits,
} from "../src/file-coverage";
import type { FileCoverageData, Range } from "../src/file-coverage";

describe("coverage summary", () => {
  it("allows a noop constructor", () => {
    const cs = new CoverageSummary();
    assert(cs.statements);
    assert(cs.lines);
    assert(cs.functions);
    assert(cs.branches);
    assert(cs.branchesTrue);
  });

  it("allows another summary in constructor", () => {
    const cs1 = new CoverageSummary();
    expect(() => {
      new CoverageSummary(cs1);
    }).not.toThrow();
  });

  it("allows summary data in constructor", () => {
    const cs1 = new CoverageSummary();
    expect(() => {
      new CoverageSummary(cs1.data);
    }).not.toThrow();
  });

  it("can be initialized with non-zero totals", () => {
    const cs = new CoverageSummary().data;
    cs.statements.total = 5;
    cs.statements.covered = 4;
    cs.statements.skipped = 0;
    cs.statements.pct = 80;
    const cs2 = new CoverageSummary(cs);
    expect(cs2.statements).toEqual({
      total: 5,
      covered: 4,
      skipped: 0,
      pct: 80,
    });
  });

  it("cannot be initialized with an object with missing keys", () => {
    expect(() => {
      new CoverageSummary({ statements: {} } as unknown as CoverageSummaryData);
    }).toThrow();
  });

  it("merges summaries correctly", () => {
    const basic = function () {
      return {
        total: 5,
        covered: 4,
        skipped: 0,
        pct: 80,
      };
    };
    const empty = function () {
      return {
        total: 0,
        covered: 0,
        skipped: 0,
        pct: 100,
      };
    };
    const cs1 = new CoverageSummary({
      statements: basic(),
      functions: basic(),
      lines: basic(),
      branches: empty(),
      branchesTrue: empty(),
    });
    const cs2 = new CoverageSummary({
      statements: basic(),
      functions: basic(),
      lines: basic(),
      branches: empty(),
      branchesTrue: empty(),
    });
    cs2.statements.covered = 5;
    cs1.merge(cs2);
    expect(cs1.statements).toEqual({
      total: 10,
      covered: 9,
      skipped: 0,
      pct: 90,
    });
    expect(cs1.branches.pct).toBe(100);
    expect(cs1.branchesTrue!.pct).toBe(100);
    const data = JSON.parse(JSON.stringify(cs1));
    expect(data.statements).toEqual({
      total: 10,
      covered: 9,
      skipped: 0,
      pct: 90,
    });
    expect(data.branches.pct).toBe(100);
    expect(data.branchesTrue.pct).toBe(100);
  });

  it("isEmpty() by default", () => {
    const cs = new CoverageSummary();
    expect(cs.isEmpty()).toBe(true);
  });
});

describe("base coverage", () => {
  it("does not allow a noop/ invalid constructor", () => {
    expect(() => {
      new FileCoverage();
    }).toThrow();
    expect(() => {
      new FileCoverage(10 as unknown as string);
    }).toThrow();
  });

  it("allows a path in constructor", () => {
    let bc: FileCoverage | null = null;
    expect(() => {
      bc = new FileCoverage("/path/to/file");
    }).not.toThrow();
    assert(bc!.statementMap);
    assert(bc!.fnMap);
    assert(bc!.branchMap);
    assert(bc!.s);
    assert(bc!.f);
    assert(bc!.b);
    assert(bc!.getLineCoverage());
    expect(bc!.path).toBe("/path/to/file");
  });

  it("allows another object in constructor, produces JSON", () => {
    const bc1 = new FileCoverage("/path/to/file");
    const bc2 = new FileCoverage(bc1);
    expect(bc2.path).toBe("/path/to/file");

    const bc3 = new FileCoverage(bc1.data);
    expect(bc3.path).toBe("/path/to/file");
    expect(bc1.data).toEqual(JSON.parse(JSON.stringify(bc3)));

    delete (bc3.data as Partial<FileCoverageData>).s;
    expect(() => {
      new FileCoverage(bc3.data);
    }).toThrow();
  });

  it("merges another file coverage correctly", () => {
    const loc = function (sl: number, sc: number, el: number, ec: number): Range {
      return {
        start: { line: sl, column: sc },
        end: { line: el, column: ec },
      };
    };
    const template = new FileCoverage({
      path: "/path/to/file",
      statementMap: {
        0: loc(1, 1, 1, 100),
        1: loc(2, 1, 2, 50),
        2: loc(2, 51, 2, 100),
        3: loc(2, 101, 3, 100),
      },
      fnMap: {
        0: {
          name: "foobar",
          line: 1,
          loc: loc(1, 1, 1, 50),
        },
      },
      branchMap: {
        0: {
          type: "if",
          line: 2,
          locations: [loc(2, 1, 2, 20), loc(2, 50, 2, 100)],
        },
      },
      s: {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
      },
      f: {
        0: 0,
      },
      b: {
        0: [0, 0],
      },
    } as unknown as FileCoverageData);
    const clone = function <T>(obj: T): T {
      return JSON.parse(JSON.stringify(obj));
    };
    const c1 = new FileCoverage(clone(template));
    const c2 = new FileCoverage(clone(template));
    let summary;

    c1.s[0] = 1;
    c1.f[0] = 1;
    c1.b[0][0] = 1;

    c2.s[1] = 1;
    c2.f[0] = 1;
    c2.b[0][1] = 2;
    summary = c1.toSummary();
    expect(summary).toBeInstanceOf(CoverageSummary);
    expect(summary.statements).toEqual({
      total: 4,
      covered: 1,
      skipped: 0,
      pct: 25,
    });
    expect(summary.lines).toEqual({
      total: 2,
      covered: 1,
      skipped: 0,
      pct: 50,
    });
    expect(summary.functions).toEqual({
      total: 1,
      covered: 1,
      skipped: 0,
      pct: 100,
    });
    expect(summary.branches).toEqual({
      total: 2,
      covered: 1,
      skipped: 0,
      pct: 50,
    });

    c1.merge(c2);
    summary = c1.toSummary();
    expect(summary.statements).toEqual({
      total: 4,
      covered: 2,
      skipped: 0,
      pct: 50,
    });
    expect(summary.lines).toEqual({
      total: 2,
      covered: 2,
      skipped: 0,
      pct: 100,
    });
    expect(summary.functions).toEqual({
      total: 1,
      covered: 1,
      skipped: 0,
      pct: 100,
    });
    expect(summary.branches).toEqual({
      total: 2,
      covered: 2,
      skipped: 0,
      pct: 100,
    });

    expect(c1.s[0]).toBe(1);
    expect(c1.s[1]).toBe(1);
    expect(c1.f[0]).toBe(2);
    expect(c1.b[0][0]).toBe(1);
    expect(c1.b[0][1]).toBe(2);
  });

  it("merges another file coverage with different starting indices", () => {
    const loc = function (sl: number, sc: number, el: number, ec: number): Range {
      return {
        start: { line: sl, column: sc },
        end: { line: el, column: ec },
      };
    };
    const template1 = new FileCoverage({
      path: "/path/to/file",
      statementMap: {
        0: loc(1, 1, 1, 100),
        1: loc(2, 1, 2, 50),
        2: loc(2, 51, 2, 100),
        3: loc(2, 101, 3, 100),
      },
      fnMap: {
        0: {
          name: "foobar",
          line: 1,
          loc: loc(1, 1, 1, 50),
        },
      },
      branchMap: {
        0: {
          type: "if",
          line: 2,
          locations: [loc(2, 1, 2, 20), loc(2, 50, 2, 100)],
        },
      },
      s: {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
      },
      f: {
        0: 0,
      },
      b: {
        0: [0, 0],
      },
    } as unknown as FileCoverageData);
    const template2 = new FileCoverage({
      path: "/path/to/file",
      statementMap: {
        1: loc(1, 1, 1, 100),
        2: loc(2, 1, 2, 50),
        3: loc(2, 51, 2, 100),
        4: loc(2, 101, 3, 100),
      },
      fnMap: {
        1: {
          name: "foobar",
          line: 1,
          loc: loc(1, 1, 1, 50),
        },
      },
      branchMap: {
        1: {
          type: "if",
          line: 2,
          locations: [loc(2, 1, 2, 20), loc(2, 50, 2, 100)],
        },
      },
      s: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
      },
      f: {
        1: 0,
      },
      b: {
        1: [0, 0],
      },
    } as unknown as FileCoverageData);
    const clone = function <T>(obj: T): T {
      return JSON.parse(JSON.stringify(obj));
    };
    const c1 = new FileCoverage(clone(template1));
    const c2 = new FileCoverage(clone(template2));
    let summary;

    c1.s[0] = 1;
    c1.f[0] = 1;
    c1.b[0][0] = 1;

    c2.s[2] = 1;
    c2.f[1] = 1;
    c2.b[1][1] = 2;
    summary = c1.toSummary();
    expect(summary).toBeInstanceOf(CoverageSummary);
    expect(summary.statements).toEqual({
      total: 4,
      covered: 1,
      skipped: 0,
      pct: 25,
    });
    expect(summary.lines).toEqual({
      total: 2,
      covered: 1,
      skipped: 0,
      pct: 50,
    });
    expect(summary.functions).toEqual({
      total: 1,
      covered: 1,
      skipped: 0,
      pct: 100,
    });
    expect(summary.branches).toEqual({
      total: 2,
      covered: 1,
      skipped: 0,
      pct: 50,
    });

    c1.merge(c2);
    summary = c1.toSummary();
    expect(summary.statements).toEqual({
      total: 4,
      covered: 2,
      skipped: 0,
      pct: 50,
    });
    expect(summary.lines).toEqual({
      total: 2,
      covered: 2,
      skipped: 0,
      pct: 100,
    });
    expect(summary.functions).toEqual({
      total: 1,
      covered: 1,
      skipped: 0,
      pct: 100,
    });
    expect(summary.branches).toEqual({
      total: 2,
      covered: 2,
      skipped: 0,
      pct: 100,
    });

    expect(c1.s[0]).toBe(1);
    expect(c1.s[1]).toBe(1);
    expect(c1.f[0]).toBe(2);
    expect(c1.b[0][0]).toBe(1);
    expect(c1.b[0][1]).toBe(2);
  });

  it("drops all data during merges", () => {
    const loc = function (sl: number, sc: number, el: number, ec: number): Range {
      return {
        start: { line: sl, column: sc },
        end: { line: el, column: ec },
      };
    };
    const template = new FileCoverage({
      path: "/path/to/file",
      statementMap: {
        1: loc(1, 1, 1, 100),
        2: loc(2, 1, 2, 50),
        3: loc(2, 51, 2, 100),
        4: loc(2, 101, 3, 100),
      },
      fnMap: {
        1: {
          name: "foobar",
          line: 1,
          loc: loc(1, 1, 1, 50),
        },
      },
      branchMap: {
        1: {
          type: "if",
          line: 2,
          locations: [loc(2, 1, 2, 20), loc(2, 50, 2, 100)],
        },
      },
      s: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
      },
      f: {
        1: 0,
      },
      b: {
        1: [0, 0],
      },
    } as unknown as FileCoverageData);
    const clone = function <T>(obj: T): T {
      return JSON.parse(JSON.stringify(obj));
    };
    const createCoverage = (all?: boolean) => {
      const data = clone(template) as unknown as FileCoverageData;
      if (all) {
        data.all = true;
      } else {
        data.s[1] = 1;
        data.f[1] = 1;
        data.b[1][0] = 1;
      }

      return new FileCoverage(data);
    };

    const expected = createCoverage().data;
    // Get non-all data regardless of merge order
    let cov = createCoverage(true);
    cov.merge(createCoverage());
    expect(cov.data).toEqual(expected);
    cov = createCoverage();
    cov.merge(createCoverage(true));
    expect(cov.data).toEqual(expected);
  });

  it("merges another file coverage that tracks logical truthiness", () => {
    const loc = function (sl: number, sc: number, el: number, ec: number): Range {
      return {
        start: { line: sl, column: sc },
        end: { line: el, column: ec },
      };
    };
    const template = new FileCoverage({
      path: "/path/to/file",
      statementMap: {
        0: loc(1, 1, 1, 100),
        1: loc(2, 1, 2, 50),
        2: loc(2, 51, 2, 100),
        3: loc(2, 101, 3, 100),
      },
      fnMap: {
        0: {
          name: "foobar",
          line: 1,
          loc: loc(1, 1, 1, 50),
        },
      },
      branchMap: {
        0: {
          type: "if",
          line: 2,
          locations: [loc(2, 1, 2, 20), loc(2, 50, 2, 100)],
        },
      },
      s: {
        0: 0,
        1: 0,
        2: 0,
        3: 0,
      },
      f: {
        0: 0,
      },
      b: {
        0: [0, 0],
      },
      bT: {
        0: [0, 0],
      },
    } as unknown as FileCoverageData);
    const clone = function <T>(obj: T): T {
      return JSON.parse(JSON.stringify(obj));
    };
    const c1 = new FileCoverage(clone(template));
    const c2 = new FileCoverage(clone(template));
    let summary;

    c1.s[0] = 1;
    c1.f[0] = 1;
    c1.b[0][0] = 1;
    c1.bT![0][0] = 1;

    c2.s[1] = 1;
    c2.f[0] = 1;
    c2.b[0][1] = 2;
    c2.bT![0][1] = 2;
    summary = c1.toSummary();
    expect(summary).toBeInstanceOf(CoverageSummary);
    expect(summary.statements).toEqual({
      total: 4,
      covered: 1,
      skipped: 0,
      pct: 25,
    });
    expect(summary.lines).toEqual({
      total: 2,
      covered: 1,
      skipped: 0,
      pct: 50,
    });
    expect(summary.functions).toEqual({
      total: 1,
      covered: 1,
      skipped: 0,
      pct: 100,
    });
    expect(summary.branches).toEqual({
      total: 2,
      covered: 1,
      skipped: 0,
      pct: 50,
    });

    c1.merge(c2);
    summary = c1.toSummary();
    expect(summary.statements).toEqual({
      total: 4,
      covered: 2,
      skipped: 0,
      pct: 50,
    });
    expect(summary.lines).toEqual({
      total: 2,
      covered: 2,
      skipped: 0,
      pct: 100,
    });
    expect(summary.functions).toEqual({
      total: 1,
      covered: 1,
      skipped: 0,
      pct: 100,
    });
    expect(summary.branches).toEqual({
      total: 2,
      covered: 2,
      skipped: 0,
      pct: 100,
    });

    expect(c1.s[0]).toBe(1);
    expect(c1.s[1]).toBe(1);
    expect(c1.f[0]).toBe(2);
    expect(c1.b[0][0]).toBe(1);
    expect(c1.b[0][1]).toBe(2);
    expect(c1.bT![0][0]).toBe(1);
    expect(c1.bT![0][1]).toBe(2);
  });

  it("merges another file with non-overlapping branch misses", () => {
    const clone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

    const c2data = {
      path: "/c8-merge-issue/src/index.ts",
      all: false,
      statementMap: {
        0: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 32 },
        },
        1: {
          start: { line: 2, column: 0 },
          end: { line: 2, column: 46 },
        },
        2: {
          start: { line: 3, column: 0 },
          end: { line: 3, column: 24 },
        },
        3: {
          start: { line: 4, column: 0 },
          end: { line: 4, column: 36 },
        },
        4: {
          start: { line: 5, column: 0 },
          end: { line: 5, column: 19 },
        },
        5: {
          start: { line: 6, column: 0 },
          end: { line: 6, column: 35 },
        },
        6: {
          start: { line: 7, column: 0 },
          end: { line: 7, column: 29 },
        },
        7: {
          start: { line: 8, column: 0 },
          end: { line: 8, column: 28 },
        },
        8: {
          start: { line: 9, column: 0 },
          end: { line: 9, column: 10 },
        },
        9: {
          start: { line: 10, column: 0 },
          end: { line: 10, column: 29 },
        },
        10: {
          start: { line: 11, column: 0 },
          end: { line: 11, column: 3 },
        },
        11: {
          start: { line: 12, column: 0 },
          end: { line: 12, column: 34 },
        },
        12: {
          start: { line: 13, column: 0 },
          end: { line: 13, column: 10 },
        },
        13: {
          start: { line: 14, column: 0 },
          end: { line: 14, column: 1 },
        },
        14: {
          start: { line: 15, column: 0 },
          end: { line: 15, column: 30 },
        },
      },
      s: {
        0: 1,
        1: 1,
        2: 1,
        3: 1,
        4: 1,
        5: 1,
        6: 0,
        7: 0,
        8: 1,
        9: 1,
        10: 1,
        11: 1,
        12: 1,
        13: 1,
        14: 1,
      },
      branchMap: {
        0: {
          type: "branch",
          line: 3,
          loc: {
            start: { line: 3, column: 17 },
            end: { line: 14, column: 1 },
          },
          locations: [
            {
              start: { line: 3, column: 17 },
              end: { line: 14, column: 1 },
            },
          ],
        },
        1: {
          type: "branch",
          line: 6,
          loc: {
            start: { line: 6, column: 34 },
            end: { line: 9, column: 9 },
          },
          locations: [
            {
              start: { line: 6, column: 34 },
              end: { line: 9, column: 9 },
            },
          ],
        },
      },
      b: { 0: [1], 1: [0] },
      fnMap: {
        0: {
          name: "x",
          decl: {
            start: { line: 3, column: 17 },
            end: { line: 14, column: 1 },
          },
          loc: {
            start: { line: 3, column: 17 },
            end: { line: 14, column: 1 },
          },
          line: 3,
        },
      },
      f: { 0: 1 },
    };

    const c1data = {
      // gathered experimentally, see:
      // https://github.com/istanbuljs/v8-to-istanbul/issues/233
      path: "/c8-merge-issue/src/index.ts",
      all: false,
      statementMap: {
        0: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 32 },
        },
        1: {
          start: { line: 2, column: 0 },
          end: { line: 2, column: 46 },
        },
        2: {
          start: { line: 3, column: 0 },
          end: { line: 3, column: 24 },
        },
        3: {
          start: { line: 4, column: 0 },
          end: { line: 4, column: 36 },
        },
        4: {
          start: { line: 5, column: 0 },
          end: { line: 5, column: 19 },
        },
        5: {
          start: { line: 6, column: 0 },
          end: { line: 6, column: 35 },
        },
        6: {
          start: { line: 7, column: 0 },
          end: { line: 7, column: 29 },
        },
        7: {
          start: { line: 8, column: 0 },
          end: { line: 8, column: 28 },
        },
        8: {
          start: { line: 9, column: 0 },
          end: { line: 9, column: 10 },
        },
        9: {
          start: { line: 10, column: 0 },
          end: { line: 10, column: 29 },
        },
        10: {
          start: { line: 11, column: 0 },
          end: { line: 11, column: 3 },
        },
        11: {
          start: { line: 12, column: 0 },
          end: { line: 12, column: 34 },
        },
        12: {
          start: { line: 13, column: 0 },
          end: { line: 13, column: 10 },
        },
        13: {
          start: { line: 14, column: 0 },
          end: { line: 14, column: 1 },
        },
        14: {
          start: { line: 15, column: 0 },
          end: { line: 15, column: 30 },
        },
      },
      s: {
        0: 1,
        1: 1,
        2: 1,
        3: 1,
        4: 1,
        5: 1,
        6: 1,
        7: 1,
        8: 1,
        9: 0,
        10: 0,
        11: 1,
        12: 1,
        13: 1,
        14: 1,
      },
      branchMap: {
        0: {
          type: "branch",
          line: 3,
          loc: {
            start: { line: 3, column: 17 },
            end: { line: 14, column: 1 },
          },
          locations: [
            {
              start: { line: 3, column: 17 },
              end: { line: 14, column: 1 },
            },
          ],
        },
        1: {
          type: "branch",
          line: 9,
          loc: {
            start: { line: 9, column: 3 },
            end: { line: 11, column: 3 },
          },
          locations: [
            {
              start: { line: 9, column: 3 },
              end: { line: 11, column: 3 },
            },
          ],
        },
      },
      b: { 0: [1], 1: [0] },
      fnMap: {
        0: {
          name: "x",
          decl: {
            start: { line: 3, column: 17 },
            end: { line: 14, column: 1 },
          },
          loc: {
            start: { line: 3, column: 17 },
            end: { line: 14, column: 1 },
          },
          line: 3,
        },
      },
      f: { 0: 1 },
    };

    const c1 = new FileCoverage(clone(c1data));
    const c2 = new FileCoverage(clone(c2data));

    c1.merge(c2);
    c1.merge(new FileCoverage(clone(c1data)));
    c1.merge(new FileCoverage(clone(c2data)));
    expect(c1.toSummary().data).toEqual({
      lines: { total: 15, covered: 15, skipped: 0, pct: 100 },
      functions: { total: 1, covered: 1, skipped: 0, pct: 100 },
      statements: { total: 15, covered: 15, skipped: 0, pct: 100 },
      branches: { total: 3, covered: 3, skipped: 0, pct: 100 },
    });
  });

  it("keeps function names unique when merging chunks with colliding anonymous names", () => {
    /* https://github.com/vitest-dev/vitest/issues/11069
     *
     * source.js
     * ```js
     * export function sum(a, b) {
     *   return a + b;
     * }
     * export function multiply(a, b) {
     *   return a * b;
     * }
     * ```
     *
     *  - chunk A: fnMap { 0: "(anonymous_0)" → multiply }
     *  - chunk B: fnMap { 0: "(anonymous_0)" → sum, 1: "(anonymous_1)" → multiply }
     */
    const sum: Range = {
      start: { line: 1, column: 0 },
      end: { line: 3, column: 1 },
    };
    const multiply: Range = {
      start: { line: 4, column: 0 },
      end: { line: 6, column: 1 },
    };

    const chunkA = new FileCoverage({
      path: "/source.js",
      statementMap: {},
      fnMap: {
        "0": { name: "(anonymous_0)", decl: multiply, loc: multiply, line: 4 },
      },
      branchMap: {},
      s: {},
      f: { "0": 1 },
      b: {},
    });

    const chunkB = new FileCoverage({
      path: "/source.js",
      statementMap: {},
      fnMap: {
        "0": { name: "(anonymous_0)", decl: sum, loc: sum, line: 1 },
        "1": { name: "(anonymous_1)", decl: multiply, loc: multiply, line: 4 },
      },
      branchMap: {},
      s: {},
      f: { "0": 1, "1": 1 },
      b: {},
    });

    chunkA.merge(chunkB);

    const names = Object.values(chunkA.fnMap).map((fn) => fn.name);
    expect(names).toHaveLength(2);
    expect(names).toContain("(anonymous_0)");
    expect(names).toContain("(anonymous_1)");
  });

  it("keeps function names unique when merging chunks with colliding named functions", () => {
    /* classes.ts
     * ```ts
     * export class Foo {
     *   constructor() {}
     * }
     * export class Bar {
     *   constructor() {}
     * }
     * ```
     *
     *  - chunk A: fnMap { 0: "constructor" → Bar#constructor }
     *  - chunk B: fnMap { 0: "constructor" → Foo#constructor, 1: "constructor" → Bar#constructor }
     */
    const fooConstructor: Range = {
      start: { line: 2, column: 2 },
      end: { line: 2, column: 18 },
    };
    const barConstructor: Range = {
      start: { line: 5, column: 2 },
      end: { line: 5, column: 18 },
    };

    const chunkA = new FileCoverage({
      path: "/classes.ts",
      statementMap: {},
      fnMap: {
        "0": { name: "constructor", decl: barConstructor, loc: barConstructor, line: 5 },
      },
      branchMap: {},
      s: {},
      f: { "0": 1 },
      b: {},
    });

    const chunkB = new FileCoverage({
      path: "/classes.ts",
      statementMap: {},
      fnMap: {
        "0": { name: "constructor", decl: fooConstructor, loc: fooConstructor, line: 2 },
        "1": { name: "constructor", decl: barConstructor, loc: barConstructor, line: 5 },
      },
      branchMap: {},
      s: {},
      f: { "0": 1, "1": 1 },
      b: {},
    });

    chunkA.merge(chunkB);

    const names = Object.values(chunkA.fnMap).map((fn) => fn.name);
    expect(names).toHaveLength(2);
    expect(new Set(names).size, `duplicate function names: ${names.join(", ")}`).toBe(2);
    expect(names).toContain("constructor");
    expect(names).toContain("constructor_2");
  });

  it("resets hits when requested", () => {
    const loc = function (sl: number, sc: number, el: number, ec: number): Range {
      return {
        start: { line: sl, column: sc },
        end: { line: el, column: ec },
      };
    };
    const fc = new FileCoverage({
      path: "/path/to/file",
      statementMap: {
        1: loc(1, 1, 1, 100),
        2: loc(2, 1, 2, 50),
        3: loc(2, 51, 2, 100),
        4: loc(2, 101, 3, 100),
      },
      fnMap: {
        1: {
          name: "foobar",
          line: 1,
          loc: loc(1, 1, 1, 50),
        },
      },
      branchMap: {
        1: {
          type: "if",
          line: 2,
          locations: [loc(2, 1, 2, 20), loc(2, 50, 2, 100)],
        },
      },
      s: {
        1: 2,
        2: 3,
        3: 1,
        4: 0,
      },
      f: {
        1: 54,
      },
      b: {
        1: [1, 50],
      },
      bT: {
        1: [1, 50],
      },
    } as unknown as FileCoverageData);
    fc.resetHits();
    expect({ 1: 0, 2: 0, 3: 0, 4: 0 }).toEqual(fc.s);
    expect({ 1: 0 }).toEqual(fc.f);
    expect({ 1: [0, 0] }).toEqual(fc.b);
    expect({ 1: [0, 0] }).toEqual(fc.bT);
    // does not throw if bT missing
    fc.data.bT = undefined;
    fc.resetHits();
    expect(fc.bT).toBeUndefined();
  });

  it("returns uncovered lines", () => {
    const c = new FileCoverage({
      path: "/path/to/file",
      statementMap: {
        1: {
          start: { line: 1, column: 1 },
          end: { line: 1, column: 100 },
        },
        2: {
          start: { line: 1, column: 101 },
          end: { line: 1, column: 200 },
        },
        3: {
          start: { line: 2, column: 1 },
          end: { line: 2, column: 100 },
        },
      },
      fnMap: {},
      branchMap: {},
      s: { 1: 0, 2: 1, 3: 0 },
      b: {},
      f: {},
    });
    expect(["2"]).toEqual(c.getUncoveredLines());
  });

  it("returns branch coverage by line", () => {
    const c = new FileCoverage({
      path: "/path/to/file",
      branchMap: {
        1: { line: 1 },
        2: { line: 2 },
      },
      fnMap: {},
      statementMap: {},
      s: {},
      b: {
        1: [1, 0],
        2: [0, 0, 0, 1],
      },
      f: {},
    } as unknown as FileCoverageData);
    const bcby = c.getBranchCoverageByLine();
    expect({
      1: {
        covered: 1,
        total: 2,
        coverage: 50,
      },
      2: {
        covered: 1,
        total: 4,
        coverage: 25,
      },
    }).toEqual(bcby);
  });

  it("returns branch coverage by line with Cobertura branchMap structure", () => {
    const loc = function (sl: number, sc: number, el: number, ec: number): Range {
      return {
        start: { line: sl, column: sc },
        end: { line: el, column: ec },
      };
    };
    const c = new FileCoverage({
      path: "/path/to/file",
      branchMap: {
        1: { loc: loc(1, 1, 1, 100) },
        2: { loc: loc(2, 50, 2, 100) },
      },
      fnMap: {},
      statementMap: {},
      s: {},
      b: {
        1: [1, 0],
        2: [0, 0, 0, 1],
      },
      f: {},
    } as unknown as FileCoverageData);
    const bcby = c.getBranchCoverageByLine();
    expect({
      1: {
        covered: 1,
        total: 2,
        coverage: 50,
      },
      2: {
        covered: 1,
        total: 4,
        coverage: 25,
      },
    }).toEqual(bcby);
  });

  it("allows file coverage to be initialized with tracking for logical truthiness", () => {
    let fcov = new FileCoverage("foo.json");
    expect(fcov.data.bT).toBeFalsy();
    fcov = new FileCoverage("foo.json", true);
    assert(fcov.data.bT);
    assert(fcov.toSummary().branchesTrue);
  });
});

describe("addHits unit coverage", () => {
  it("adds numbers", () => expect(addHits(1, 2)).toBe(3));
  it("adds arrays", () => expect(addHits([1, 2], [2, 3])).toEqual([3, 5]));
  it("nulls invalid input", () => expect(addHits(1, [2])).toBeNull());
});

describe("findNearestContainer unit coverage", () => {
  it("finds the nearest containing range", () => {
    const loc = (sl: number, sc: number, el: number, ec: number) => ({
      loc: {
        start: { line: sl, column: sc },
        end: { line: el, column: ec },
      },
    });
    const item1 = loc(5, 5, 10, 10);
    const item2 = loc(9, 0, 10, 10);
    const map = {
      0: loc(1, 1, 100, 100),
      1: loc(2, 2, 90, 0),
      3: loc(5, 0, 11, 0),
      4: loc(5, 1, 10, 99),
      5: loc(5, 10, 10, 10),
      6: loc(6, 0, 10, 10),
      // does not happen in practice, but verify that the code
      // will behave properly if ranges are out of order.
      7: loc(2, 3, 90, 0),
    };
    expect(findNearestContainer(item1, map)).toBe("4");
    expect(findNearestContainer(item2, map)).toBe("6");
  });
});

describe("addNearestContainerHits unit coverage", () => {
  it("adds hits from the nearest container", () => {
    const loc = (sl: number, sc: number, el: number, ec: number) => ({
      loc: {
        start: { line: sl, column: sc },
        end: { line: el, column: ec },
      },
    });
    const item = loc(5, 5, 10, 10);
    const map = {
      0: loc(1, 1, 100, 100),
      1: loc(2, 2, 90, 0),
      3: loc(5, 0, 11, 0),
      4: loc(5, 1, 10, 99),
      5: loc(5, 10, 10, 10),
      6: loc(6, 0, 10, 10),
    };
    const hits = {
      0: 0,
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
    };
    expect(addNearestContainerHits(item, 10, map, hits)).toBe(14);
    expect(addNearestContainerHits(loc(1000, 4, 10010, 1234), 10, map, hits)).toBe(10);
  });
});

describe("findNearestContainer missing loc defense", () => {
  it("does not throw if loc is missing", () => {
    const loc = (sl: number, sc: number, el: number, ec: number) => ({
      start: { line: sl, column: sc },
      end: { line: el, column: ec },
    });
    const map = {
      0: { loc: loc(1, 1, 100, 100) },
      1: {},
      2: loc(10, 10, 50, 50),
      3: { loc: loc(20, 20, 40, 40) },
    };

    expect(findNearestContainer({ no: "loc" }, map)).toBeNull();
    expect(
      findNearestContainer(loc(30, 30, 35, 35), "3" as unknown as Record<string, unknown>),
    ).toBe(null);
  });
});
