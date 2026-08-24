/*
Copyright 2012-2015, Yahoo Inc.
Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
*/

import { CoverageSummary } from "./coverage-summary";
import type { CoverageSummaryData, Totals } from "./coverage-summary";
import dataProperties from "./data-properties";
import percent from "./percent";

/** a single location in a source file: 1-based line, 0-based column */
export interface Location {
  line: number;
  column: number;
}

/** a source range delimited by a start and end location */
export interface Range {
  start: Location;
  end: Location;
}

/** metadata for a single function in the instrumented source */
export interface FunctionMapping {
  name: string;
  decl: Range;
  loc: Range;
  line: number;
}

/** metadata for a single branch in the instrumented source */
export interface BranchMapping {
  loc: Range;
  type: string;
  locations: Range[];
  line: number;
}

/**
 * Raw, JSON-serializable coverage data for a single file, as produced by the
 * istanbul instrumenter or coverage tooling.
 */
export interface FileCoverageData {
  path: string;
  statementMap: Record<string, Range>;
  fnMap: Record<string, FunctionMapping>;
  branchMap: Record<string, BranchMapping>;
  s: Record<string, number>;
  f: Record<string, number>;
  b: Record<string, number[]>;
  /** hit counts for logical branch truthiness; only present when reportLogic is enabled */
  bT?: Record<string, number[]>;
  /** marks coverage produced by the `--all` option (empty placeholder coverage) */
  all?: boolean;
}

/** per-line branch coverage as returned by `FileCoverage#getBranchCoverageByLine` */
export interface Coverage {
  covered: number;
  total: number;
  coverage: number;
}

/** hit counts: a number for statements/functions, a number[] for branches */
type Hits = number | number[];

// returns a data object that represents empty coverage
function emptyCoverage(filePath: string, reportLogic: boolean): FileCoverageData {
  const cov: FileCoverageData = {
    path: filePath,
    statementMap: {},
    fnMap: {},
    branchMap: {},
    s: {},
    f: {},
    b: {},
  };
  if (reportLogic) cov.bT = {};
  return cov;
}

// asserts that a data object "looks like" a coverage object
function assertValidObject(obj: FileCoverageData): void {
  const valid =
    obj && obj.path && obj.statementMap && obj.fnMap && obj.branchMap && obj.s && obj.f && obj.b;
  if (!valid) {
    throw new Error(
      "Invalid file coverage object, missing keys, found:" + Object.keys(obj).join(","),
    );
  }
}

const keyFromLoc = ({ start, end }: Range): string =>
  `${start.line}|${start.column}|${end.line}|${end.column}`;

const isObj = (o: unknown): o is Record<string, unknown> => !!o && typeof o === "object";
const isLineCol = (o: unknown): o is Location =>
  isObj(o) && typeof o.line === "number" && typeof o.column === "number";
const isLoc = (o: unknown): o is Range => isObj(o) && isLineCol(o.start) && isLineCol(o.end);
const getLoc = (o: unknown): Range | null =>
  isLoc(o) ? o : isLoc((o as { loc?: unknown }).loc) ? (o as { loc: Range }).loc : null;

// When merging, we can have a case where two ranges cover
// the same block of code with `hits=1`, and each carve out a
// different range with `hits=0` to indicate it's uncovered.
// Find the nearest container so that we can properly indicate
// that both sections are hit.
// Returns null if no containing item is found.
const findNearestContainer = (item: unknown, map: Record<string, unknown>): string | null => {
  const itemLoc = getLoc(item);
  if (!itemLoc) return null;
  // the B item is not an identified range in the A set, BUT
  // it may be contained by an identified A range. If so, then
  // any hit of that containing A range counts as a hit of this
  // B range as well. We have to find the *narrowest* containing
  // range to be accurate, since ranges can be hit and un-hit
  // in a nested fashion.
  let nearestContainingItem: unknown = null;
  let containerDistance: number[] | null = null;
  let containerKey: string | null = null;
  for (const [i, mapItem] of Object.entries(map)) {
    const mapLoc = getLoc(mapItem);
    if (!mapLoc) continue;
    // contained if all of line distances are > 0
    // or line distance is 0 and col dist is >= 0
    const distance = [
      itemLoc.start.line - mapLoc.start.line,
      itemLoc.start.column - mapLoc.start.column,
      mapLoc.end.line - itemLoc.end.line,
      mapLoc.end.column - itemLoc.end.column,
    ];
    if (
      distance[0] < 0 ||
      distance[2] < 0 ||
      (distance[0] === 0 && distance[1] < 0) ||
      (distance[2] === 0 && distance[3] < 0)
    ) {
      continue;
    }
    if (nearestContainingItem === null) {
      containerDistance = distance;
      nearestContainingItem = mapItem;
      containerKey = i;
      continue;
    }
    // closer line more relevant than closer column
    const closerBefore =
      distance[0] < containerDistance![0] ||
      (distance[0] === 0 && distance[1] < containerDistance![1]);
    const closerAfter =
      distance[2] < containerDistance![2] ||
      (distance[2] === 0 && distance[3] < containerDistance![3]);
    if (closerBefore || closerAfter) {
      // closer
      containerDistance = distance;
      nearestContainingItem = mapItem;
      containerKey = i;
    }
  }
  return containerKey;
};

// either add two numbers, or all matching entries in a number[]
const addHits = (aHits: Hits | null | undefined, bHits: Hits | null | undefined): Hits | null => {
  if (typeof aHits === "number" && typeof bHits === "number") {
    return aHits + bHits;
  } else if (Array.isArray(aHits) && Array.isArray(bHits)) {
    return aHits.map((a, i) => (a || 0) + (bHits[i] || 0));
  }
  return null;
};

const addNearestContainerHits = (
  item: unknown,
  itemHits: Hits | null,
  map: Record<string, unknown>,
  mapHits: Record<string, Hits>,
): Hits | null => {
  const container = findNearestContainer(item, map);
  if (container) {
    return addHits(itemHits, mapHits[container]);
  } else {
    return itemHits;
  }
};

const mergeProp = <H extends Hits, T>(
  aHits: Record<string, H>,
  aMap: Record<string, T>,
  bHits: Record<string, H>,
  bMap: Record<string, T>,
  itemKey: (item: T) => string = keyFromLoc as unknown as (item: T) => string,
): [Record<string, H>, Record<string, T>] => {
  const aItems: Record<string, [Hits | null, T]> = {};
  for (const [key, itemHits] of Object.entries(aHits)) {
    const item = aMap[key];
    aItems[itemKey(item)] = [itemHits, item];
  }
  const bItems: Record<string, [Hits | null, T]> = {};
  for (const [key, itemHits] of Object.entries(bHits)) {
    const item = bMap[key];
    bItems[itemKey(item)] = [itemHits, item];
  }
  const mergedItems: Record<string, [Hits | null, T]> = {};
  for (const [key, aValue] of Object.entries(aItems)) {
    let aItemHits = aValue[0];
    const aItem = aValue[1];
    const bValue = bItems[key];
    if (!bValue) {
      // not an identified range in b, but might be contained by one
      aItemHits = addNearestContainerHits(aItem, aItemHits, bMap, bHits);
    } else {
      // is an identified range in b, so add the hits together
      aItemHits = addHits(aItemHits, bValue[0]);
    }
    mergedItems[key] = [aItemHits, aItem];
  }
  // now find the items in b that are not in a. already added matches.
  for (const [key, bValue] of Object.entries(bItems)) {
    let bItemHits = bValue[0];
    const bItem = bValue[1];
    if (mergedItems[key]) continue;
    // not an identified range in b, but might be contained by one
    bItemHits = addNearestContainerHits(bItem, bItemHits, aMap, aHits);
    mergedItems[key] = [bItemHits, bItem];
  }

  const hits: Record<string, Hits | null> = {};
  const map: Record<string, T> = {};

  Object.values(mergedItems).forEach(([itemHits, item], i) => {
    hits[i] = itemHits;
    map[i] = item;
  });

  return [hits as Record<string, H>, map];
};

/**
 * provides a read-only view of coverage for a single file.
 * The deep structure of this object is documented elsewhere. It has the following
 * properties:
 *
 * * `path` - the file path for which coverage is being tracked
 * * `statementMap` - map of statement locations keyed by statement index
 * * `fnMap` - map of function metadata keyed by function index
 * * `branchMap` - map of branch metadata keyed by branch index
 * * `s` - hit counts for statements
 * * `f` - hit count for functions
 * * `b` - hit count for branches
 */
class FileCoverage {
  data: FileCoverageData;

  declare readonly path: string;
  declare readonly statementMap: Record<string, Range>;
  declare readonly fnMap: Record<string, FunctionMapping>;
  declare readonly branchMap: Record<string, BranchMapping>;
  declare readonly s: Record<string, number>;
  declare readonly f: Record<string, number>;
  declare readonly b: Record<string, number[]>;
  declare readonly bT: Record<string, number[]> | undefined;
  declare readonly all: boolean | undefined;

  /**
   * @constructor
   * @param pathOrObj is a string that initializes
   * and empty coverage object with the specified file path or a data object that
   * has all the required properties for a file coverage object.
   */
  constructor(pathOrObj?: string | FileCoverage | FileCoverageData, reportLogic = false) {
    if (!pathOrObj) {
      throw new Error("Coverage must be initialized with a path or an object");
    }
    if (typeof pathOrObj === "string") {
      this.data = emptyCoverage(pathOrObj, reportLogic);
    } else if (isFileCoverage(pathOrObj)) {
      this.data = pathOrObj.data;
    } else if (typeof pathOrObj === "object") {
      this.data = pathOrObj;
    } else {
      throw new Error("Invalid argument to coverage constructor");
    }
    assertValidObject(this.data);
  }

  /**
   * returns computed line coverage from statement coverage.
   * This is a map of hits keyed by line number in the source.
   */
  getLineCoverage(): Record<string, number> {
    const statementMap = this.data.statementMap;
    const statements = this.data.s;
    const lineMap: Record<string, number> = Object.create(null);

    Object.entries(statements).forEach(([st, count]) => {
      /* istanbul ignore if: is this even possible? */
      if (!statementMap[st]) {
        return;
      }
      const { line } = statementMap[st].start;
      const prevVal = lineMap[line];
      if (prevVal === undefined || prevVal < count) {
        lineMap[line] = count;
      }
    });
    return lineMap;
  }

  /**
   * returns an array of uncovered line numbers.
   * @returns an array of line numbers for which no hits have been
   *  collected.
   */
  getUncoveredLines(): string[] {
    const lc = this.getLineCoverage();
    const ret: string[] = [];
    Object.entries(lc).forEach(([l, hits]) => {
      if (hits === 0) {
        ret.push(l);
      }
    });
    return ret;
  }

  /**
   * returns a map of branch coverage by source line number.
   * @returns an object keyed by line number. Each object
   * has a `covered`, `total` and `coverage` (percentage) property.
   */
  getBranchCoverageByLine(): Record<string, Coverage> {
    const branchMap = this.branchMap;
    const branches = this.b;
    const ret: Record<string, number[] | Coverage> = {};
    Object.entries(branchMap).forEach(([k, map]) => {
      const line = map.line || map.loc.start.line;
      const branchData = branches[k];
      ret[line] = ret[line] || [];
      (ret[line] as number[]).push(...branchData);
    });
    Object.entries(ret).forEach(([k, dataArray]) => {
      const covered = (dataArray as number[]).filter((item) => item > 0);
      const coverage = (covered.length / (dataArray as number[]).length) * 100;
      ret[k] = {
        covered: covered.length,
        total: (dataArray as number[]).length,
        coverage,
      };
    });
    return ret as Record<string, Coverage>;
  }

  /**
   * return a JSON-serializable POJO for this file coverage object
   */
  toJSON(): FileCoverageData {
    return this.data;
  }

  /**
   * merges a second coverage object into this one, updating hit counts
   * @param other - the coverage object to be merged into this one.
   *  Note that the other object should have the same structure as this one (same file).
   */
  merge(other: FileCoverage): void {
    if (other.all === true) {
      return;
    }

    if (this.all === true) {
      this.data = other.data;
      return;
    }

    const [s, statementMap] = mergeProp(this.s, this.statementMap, other.s, other.statementMap);
    this.data.s = s;
    this.data.statementMap = statementMap;

    const keyFromLocProp = (x: FunctionMapping) => keyFromLoc(x.loc);
    const keyFromLocationsProp = (x: BranchMapping) => keyFromLoc(x.locations[0]);

    const [f, fnMap] = mergeProp(this.f, this.fnMap, other.f, other.fnMap, keyFromLocProp);
    this.data.f = f;
    this.data.fnMap = fnMap;

    const [b, branchMap] = mergeProp(
      this.b,
      this.branchMap,
      other.b,
      other.branchMap,
      keyFromLocationsProp,
    );
    this.data.b = b;
    this.data.branchMap = branchMap;

    // Tracking additional information about branch truthiness
    // can be optionally enabled:
    if (this.bT && other.bT) {
      const [bT] = mergeProp(
        this.bT,
        this.branchMap,
        other.bT,
        other.branchMap,
        keyFromLocationsProp,
      );
      this.data.bT = bT;
    }
  }

  computeSimpleTotals(property: "getLineCoverage" | "s" | "f"): Totals {
    let stats: Record<string, number> | (() => Record<string, number>) = this[property];

    if (typeof stats === "function") {
      stats = stats.call(this);
    }

    const total = Object.keys(stats).length;
    const covered = Object.values(stats).filter((v) => !!v).length;
    return {
      total,
      covered,
      skipped: 0,
      pct: percent(covered, total),
    };
  }

  computeBranchTotals(property: "b" | "bT"): Totals {
    const stats = this[property]!;
    const ret: Totals = { total: 0, covered: 0, skipped: 0, pct: 0 };

    Object.values(stats).forEach((branches) => {
      ret.covered += branches.filter((hits) => hits > 0).length;
      ret.total += branches.length;
    });
    ret.pct = percent(ret.covered, ret.total);
    return ret;
  }

  /**
   * resets hit counts for all statements, functions and branches
   * in this coverage object resulting in zero coverage.
   */
  resetHits(): void {
    const statements = this.s;
    const functions = this.f;
    const branches = this.b;
    const branchesTrue = this.bT;
    Object.keys(statements).forEach((s) => {
      statements[s] = 0;
    });
    Object.keys(functions).forEach((f) => {
      functions[f] = 0;
    });
    Object.keys(branches).forEach((b) => {
      branches[b].fill(0);
    });
    // Tracking additional information about branch truthiness
    // can be optionally enabled:
    if (branchesTrue) {
      Object.keys(branchesTrue).forEach((bT) => {
        branchesTrue[bT].fill(0);
      });
    }
  }

  /**
   * returns a CoverageSummary for this file coverage object
   * @returns {CoverageSummary}
   */
  toSummary(): CoverageSummary {
    const ret: CoverageSummaryData = {
      lines: this.computeSimpleTotals("getLineCoverage"),
      functions: this.computeSimpleTotals("f"),
      statements: this.computeSimpleTotals("s"),
      branches: this.computeBranchTotals("b"),
    };
    // Tracking additional information about branch truthiness
    // can be optionally enabled:
    if (this.bT) {
      ret.branchesTrue = this.computeBranchTotals("bT");
    }
    return new CoverageSummary(ret);
  }
}

// expose coverage data attributes
dataProperties(FileCoverage, [
  "path",
  "statementMap",
  "fnMap",
  "branchMap",
  "s",
  "f",
  "b",
  "bT",
  "all",
]);

export function isFileCoverage(obj: unknown): obj is FileCoverage {
  if (obj instanceof FileCoverage) {
    return true;
  }

  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as FileCoverage).data === "object" &&
    typeof (obj as FileCoverage).toSummary === "function" &&
    typeof (obj as FileCoverage).getLineCoverage === "function"
  );
}

export {
  FileCoverage,
  // exported for testing
  findNearestContainer,
  addHits,
  addNearestContainerHits,
};
