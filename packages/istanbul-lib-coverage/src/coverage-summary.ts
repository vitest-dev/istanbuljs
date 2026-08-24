/*
Copyright 2012-2015, Yahoo Inc.
Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
*/

import dataProperties from "./data-properties";
import percent from "./percent";

/**
 * Totals for a single coverage metric (statements, lines, functions, branches).
 * `pct` is a percentage number (0-100), or the string `"Unknown"` for a blank
 * summary that has not yet been merged with any data.
 */
export interface Totals {
  total: number;
  covered: number;
  skipped: number;
  pct: number | "Unknown";
}

/**
 * Raw, JSON-serializable data underlying a `CoverageSummary`.
 */
export interface CoverageSummaryData {
  lines: Totals;
  statements: Totals;
  functions: Totals;
  branches: Totals;
  branchesTrue?: Totals;
}

function blankSummary(): CoverageSummaryData {
  const empty = (): Totals => ({
    total: 0,
    covered: 0,
    skipped: 0,
    pct: "Unknown",
  });

  return {
    lines: empty(),
    statements: empty(),
    functions: empty(),
    branches: empty(),
    branchesTrue: empty(),
  };
}

// asserts that a data object "looks like" a summary coverage object
function assertValidSummary(obj: CoverageSummaryData): void {
  const valid = obj && obj.lines && obj.statements && obj.functions && obj.branches;
  if (!valid) {
    throw new Error(
      "Invalid summary coverage object, missing keys, found:" + Object.keys(obj).join(","),
    );
  }
}

/**
 * CoverageSummary provides a summary of code coverage . It exposes 4 properties,
 * `lines`, `statements`, `branches`, and `functions`. Each of these properties
 * is an object that has 4 keys `total`, `covered`, `skipped` and `pct`.
 * `pct` is a percentage number (0-100).
 */
class CoverageSummary {
  data: CoverageSummaryData;

  declare readonly lines: Totals;
  declare readonly statements: Totals;
  declare readonly functions: Totals;
  declare readonly branches: Totals;
  declare readonly branchesTrue: Totals | undefined;

  /**
   * @constructor
   * @param obj an optional data object or
   * another coverage summary to initialize this object with.
   */
  constructor(obj?: CoverageSummary | CoverageSummaryData) {
    if (!obj) {
      this.data = blankSummary();
    } else if (isCoverageSummary(obj)) {
      this.data = obj.data;
    } else {
      this.data = obj;
    }
    assertValidSummary(this.data);
  }

  /**
   * merges a second summary coverage object into this one
   * @param obj - another coverage summary object
   */
  merge(obj: CoverageSummary): this {
    const keys = ["lines", "statements", "branches", "functions", "branchesTrue"] as const;
    keys.forEach((key) => {
      const theirs = obj[key];
      if (theirs) {
        const mine = this[key]!;
        mine.total += theirs.total;
        mine.covered += theirs.covered;
        mine.skipped += theirs.skipped;
        mine.pct = percent(mine.covered, mine.total);
      }
    });

    return this;
  }

  /**
   * returns a POJO that is JSON serializable. May be used to get the raw
   * summary object.
   */
  toJSON(): CoverageSummaryData {
    return this.data;
  }

  /**
   * return true if summary has no lines of code
   */
  isEmpty(): boolean {
    return this.lines.total === 0;
  }
}

dataProperties(CoverageSummary, ["lines", "statements", "functions", "branches", "branchesTrue"]);

export function isCoverageSummary(obj: unknown): obj is CoverageSummary {
  if (obj instanceof CoverageSummary) {
    return true;
  }

  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as CoverageSummary).data === "object" &&
    typeof (obj as CoverageSummary).isEmpty === "function" &&
    typeof (obj as CoverageSummary).merge === "function"
  );
}

export { CoverageSummary };
