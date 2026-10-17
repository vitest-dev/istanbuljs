import type { EncodedSourceMap } from "@jridgewell/trace-mapping";
import { classes } from "@vitest/istanbul-lib-coverage";
import type { FileCoverageData, FunctionMapping, Range } from "@vitest/istanbul-lib-coverage";

/**
 * an input source map, mapping the code being instrumented back to its
 * original source.
 */
export type InputSourceMap = EncodedSourceMap;

/**
 * coverage data produced by the instrumenter for a single file: raw
 * file coverage data plus the input source map, when one was provided.
 */
export interface SourceCoverageData extends FileCoverageData {
  inputSourceMap?: InputSourceMap;
}

function cloneLocation(loc?: Range | null): Range {
  return {
    start: {
      line: loc && loc.start.line,
      column: loc && loc.start.column,
    },
    end: {
      line: loc && loc.end.line,
      column: loc && loc.end.column,
    },
  } as Range;
}
/**
 * SourceCoverage provides mutation methods to manipulate the structure of
 * a file coverage object. Used by the instrumenter to create a full coverage
 * object for a file incrementally.
 *
 * @private
 * @param pathOrObj {String|Object} - see the argument for {@link FileCoverage}
 * @extends FileCoverage
 * @constructor
 */
class SourceCoverage extends classes.FileCoverage {
  declare data: SourceCoverageData;
  meta: { last: { s: number; f: number; b: number } };

  constructor(pathOrObj: string | FileCoverageData) {
    super(pathOrObj);
    this.meta = {
      last: {
        s: 0,
        f: 0,
        b: 0,
      },
    };
  }

  newStatement(loc: Range): number {
    const s = this.meta.last.s;
    this.data.statementMap[s] = cloneLocation(loc);
    this.data.s[s] = 0;
    this.meta.last.s += 1;
    return s;
  }

  newFunction(
    name: string | null | undefined,
    decl: Range | null | undefined,
    loc: Range | null | undefined,
  ): number {
    const f = this.meta.last.f;
    name = name || "(anonymous_" + f + ")";
    this.data.fnMap[f] = {
      name,
      decl: cloneLocation(decl),
      loc: cloneLocation(loc),
      // DEPRECATED: some legacy reports require this info.
      line: loc && loc.start.line,
    } as FunctionMapping;
    this.data.f[f] = 0;
    this.meta.last.f += 1;
    return f;
  }

  newBranch(type: string, loc: Range | null | undefined, isReportLogic = false): number {
    const b = this.meta.last.b;
    this.data.b[b] = [];
    this.data.branchMap[b] = {
      loc: cloneLocation(loc),
      type,
      locations: [],
      // DEPRECATED: some legacy reports require this info.
      line: (loc && loc.start.line) as number,
    };
    this.meta.last.b += 1;
    this.maybeNewBranchTrue(type, b, isReportLogic);
    return b;
  }

  maybeNewBranchTrue(type: string, name: number, isReportLogic: boolean): void {
    if (!isReportLogic) {
      return;
    }
    if (type !== "binary-expr") {
      return;
    }
    this.data.bT = this.data.bT || {};
    this.data.bT[name] = [];
  }

  addBranchPath(name: number, location: Range | null | undefined): number {
    const bMeta = this.data.branchMap[name];
    const counts = this.data.b[name];

    /* istanbul ignore if: paranoid check */
    if (!bMeta) {
      throw new Error("Invalid branch " + name);
    }
    bMeta.locations.push(cloneLocation(location));
    counts.push(0);
    this.maybeAddBranchTrue(name);
    return counts.length - 1;
  }

  maybeAddBranchTrue(name: number): void {
    if (!this.data.bT) {
      return;
    }
    const countsTrue = this.data.bT[name];
    if (!countsTrue) {
      return;
    }
    countsTrue.push(0);
  }

  /**
   * Assigns an input source map to the coverage that can be used
   * to remap the coverage output to the original source
   * @param sourceMap {object} the source map
   */
  inputSourceMap(sourceMap: InputSourceMap): void {
    this.data.inputSourceMap = sourceMap;
  }

  freeze(): void {
    // prune empty branches
    const map = this.data.branchMap;
    const branches = this.data.b;
    const branchesT = this.data.bT || {};
    Object.keys(map).forEach((b) => {
      if (map[b].locations.length === 0) {
        delete map[b];
        delete branches[b];
        delete branchesT[b];
      }
    });
  }
}

export { SourceCoverage };
