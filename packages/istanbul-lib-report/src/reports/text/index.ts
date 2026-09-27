/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE
 file for terms.
 */
import type { CoverageSummary, Totals } from "@vitest/istanbul-lib-coverage";

import type { ContentWriter, Context, ReportBaseOptions, ReportNode } from "../../index";
import ReportBase from "../../report-base";

const NAME_COL = 4;
const PCT_COLS = 7;
const MISSING_COL = 17;
const TAB_SIZE = 1;
const DELIM = " | ";

/** the four coverage metrics shown in the table */
type MetricKey = "statements" | "branches" | "functions" | "lines";

/** options accepted by {@link TextReport} */
export interface TextOptions extends ReportBaseOptions {
  /** the file to write the report to, defaults to the console */
  file?: string | null;
  /** maximum column width of the table, defaults to the terminal width */
  maxCols?: number;
  /** skip rows with no coverage */
  skipEmpty?: boolean;
  /** skip rows with full coverage */
  skipFull?: boolean;
}

/** narrows a possibly-`"Unknown"` pct before handing it to `classForPercent` */
function classForPercent(context: Context, type: string, pct: Totals["pct"]): string {
  return context.classForPercent(type, typeof pct === "number" ? pct : NaN);
}

function padding(num: number, ch?: string): string {
  let str = "";
  let i;
  ch = ch || " ";
  for (i = 0; i < num; i += 1) {
    str += ch;
  }
  return str;
}

function fill(str: string | number, width: number, right?: boolean, tabs?: number): string {
  tabs = tabs || 0;
  str = String(str);

  const leadingSpaces = tabs * TAB_SIZE;
  const remaining = width - leadingSpaces;
  const leader = padding(leadingSpaces);
  let fmtStr = "";

  if (remaining > 0) {
    const strlen = str.length;
    let fillStr;

    if (remaining >= strlen) {
      fillStr = padding(remaining - strlen);
    } else {
      fillStr = "...";
      const length = remaining - fillStr.length;

      str = str.substring(strlen - length);
      right = true;
    }
    fmtStr = right ? fillStr + str : str + fillStr;
  }

  return leader + fmtStr;
}

function formatName(name: string, maxCols: number, level?: number): string {
  return fill(name, maxCols, false, level);
}

function formatPct(pct: string | number | "Unknown", width?: number): string {
  return fill(pct, width || PCT_COLS, true, 0);
}

function nodeMissing(node: ReportNode): string {
  if (node.isSummary()) {
    return "";
  }

  const metrics = node.getCoverageSummary()!;
  const isEmpty = metrics.isEmpty();
  const lines = isEmpty ? 0 : metrics.lines.pct;

  let coveredLines: [string, number | boolean][];

  const fileCoverage = node.getFileCoverage();
  if (lines === 100) {
    const branches = fileCoverage.getBranchCoverageByLine();
    coveredLines = Object.entries(branches).map(([key, { coverage }]) => [key, coverage === 100]);
  } else {
    coveredLines = Object.entries(fileCoverage.getLineCoverage());
  }

  let newRange = true;
  const ranges = coveredLines
    .reduce<number[][]>((acum, [line, hit]) => {
      if (hit) newRange = true;
      else {
        const lineNumber = parseInt(line);
        if (newRange) {
          acum.push([lineNumber]);
          newRange = false;
        } else acum[acum.length - 1][1] = lineNumber;
      }

      return acum;
    }, [])
    .map((range): number | string => {
      const { length } = range;

      if (length === 1) return range[0];

      return `${range[0]}-${range[1]}`;
    });

  return ([] as (number | string)[]).concat(...ranges).join(",");
}

function nodeName(node: ReportNode): string {
  return node.getRelativeName() || "All files";
}

function depthFor(node: ReportNode): number {
  let ret = 0;
  let parent = node.getParent();
  while (parent) {
    ret += 1;
    parent = parent.getParent();
  }
  return ret;
}

function nullDepthFor(): number {
  return 0;
}

function findWidth(
  node: ReportNode,
  context: Context,
  nodeExtractor: (node: ReportNode) => string,
  depthFor: (node: ReportNode) => number = nullDepthFor,
): number {
  let last = 0;
  function compareWidth(node: ReportNode) {
    last = Math.max(last, TAB_SIZE * depthFor(node) + nodeExtractor(node).length);
  }
  const visitor = {
    onSummary: compareWidth,
    onDetail: compareWidth,
  };
  node.visit(context.getVisitor(visitor));
  return last;
}

function makeLine(nameWidth: number, missingWidth: number): string {
  const name = padding(nameWidth, "-");
  const pct = padding(PCT_COLS, "-");
  const elements = [];

  elements.push(name);
  elements.push(pct);
  elements.push(padding(PCT_COLS + 1, "-"));
  elements.push(pct);
  elements.push(pct);
  elements.push(padding(missingWidth, "-"));
  return elements.join(DELIM.replace(/ /g, "-")) + "-";
}

function tableHeader(maxNameCols: number, missingWidth: number): string {
  const elements = [];
  elements.push(formatName("File", maxNameCols, 0));
  elements.push(formatPct("% Stmts"));
  elements.push(formatPct("% Branch", PCT_COLS + 1));
  elements.push(formatPct("% Funcs"));
  elements.push(formatPct("% Lines"));
  elements.push(formatName("Uncovered Line #s", missingWidth));
  return elements.join(DELIM) + " ";
}

function isFull(metrics: CoverageSummary): boolean {
  return (
    metrics.statements.pct === 100 &&
    metrics.branches.pct === 100 &&
    metrics.functions.pct === 100 &&
    metrics.lines.pct === 100
  );
}

/** why a row is left out of the table, or `null` when it is printed */
function skipReason(
  metrics: CoverageSummary,
  skipEmpty: boolean | undefined,
  skipFull: boolean | undefined,
): "empty" | "full" | null {
  if (skipEmpty && metrics.isEmpty()) return "empty";
  if (skipFull && isFull(metrics)) return "full";
  return null;
}

/** counts of skipped files when `skipFull` would leave the table without file rows, otherwise `null` */
function hiddenTableCounts(
  root: ReportNode,
  context: Context,
  skipEmpty: boolean | undefined,
  skipFull: boolean | undefined,
): { full: number; empty: number } | null {
  if (!skipFull) return null;

  const counts = { full: 0, empty: 0, shown: 0 };
  root.visit(
    context.getVisitor({
      onDetail(node) {
        counts[skipReason(node.getCoverageSummary()!, skipEmpty, skipFull) ?? "shown"] += 1;
      },
    }),
  );
  return counts.shown === 0 && counts.full > 0 ? counts : null;
}

function fileNoun(count: number): string {
  return count === 1 ? "file" : "files";
}

function tableRow(
  node: ReportNode,
  context: Context,
  colorizer: (str: string, clazz?: string) => string,
  maxNameCols: number,
  level: number,
  skipEmpty: boolean | undefined,
  skipFull: boolean | undefined,
  missingWidth: number,
): string {
  const name = nodeName(node);
  const metrics = node.getCoverageSummary()!;
  const isEmpty = metrics.isEmpty();
  if (skipReason(metrics, skipEmpty, skipFull)) {
    return "";
  }

  const mm: Record<MetricKey, number | "Unknown"> = {
    statements: isEmpty ? 0 : metrics.statements.pct,
    branches: isEmpty ? 0 : metrics.branches.pct,
    functions: isEmpty ? 0 : metrics.functions.pct,
    lines: isEmpty ? 0 : metrics.lines.pct,
  };
  const colorize: (str: string, key: MetricKey) => string = isEmpty
    ? function (str) {
        return str;
      }
    : function (str, key) {
        return colorizer(str, classForPercent(context, key, mm[key]));
      };
  const elements = [];

  elements.push(colorize(formatName(name, maxNameCols, level), "statements"));
  elements.push(colorize(formatPct(mm.statements), "statements"));
  elements.push(colorize(formatPct(mm.branches, PCT_COLS + 1), "branches"));
  elements.push(colorize(formatPct(mm.functions), "functions"));
  elements.push(colorize(formatPct(mm.lines), "lines"));
  elements.push(
    colorizer(formatName(nodeMissing(node), missingWidth), mm.lines === 100 ? "medium" : "low"),
  );

  return elements.join(DELIM) + " ";
}

class TextReport extends ReportBase {
  declare file: string | null;
  declare maxCols: number;
  declare cw: ContentWriter | null;
  declare skipEmpty: boolean | undefined;
  declare skipFull: boolean | undefined;
  declare nameWidth: number;
  declare missingWidth: number;
  declare hideTable: boolean;

  constructor(opts?: TextOptions) {
    super(opts);

    opts = opts || {};
    const { maxCols } = opts;

    this.file = opts.file || null;
    this.maxCols = maxCols != null ? maxCols : process.stdout.columns || 80;
    this.cw = null;
    this.skipEmpty = opts.skipEmpty;
    this.skipFull = opts.skipFull;
    this.hideTable = false;
  }

  onStart(root: ReportNode, context: Context): void {
    this.cw = context.writer.writeFile(this.file);
    const counts = hiddenTableCounts(root, context, this.skipEmpty, this.skipFull);
    this.hideTable = counts !== null;
    if (counts) {
      this.cw.println("No files with missing coverage.");
      this.cw.println(`${counts.full} ${fileNoun(counts.full)} fully covered.`);
      if (counts.empty > 0) {
        this.cw.println(`${counts.empty} empty ${fileNoun(counts.empty)} skipped.`);
      }
      return;
    }
    this.nameWidth = Math.max(NAME_COL, findWidth(root, context, nodeName, depthFor));
    this.missingWidth = Math.max(MISSING_COL, findWidth(root, context, nodeMissing));

    if (this.maxCols > 0) {
      const pct_cols = DELIM.length + 4 * (PCT_COLS + DELIM.length) + 2;

      const maxRemaining = this.maxCols - (pct_cols + MISSING_COL);
      if (this.nameWidth > maxRemaining) {
        this.nameWidth = maxRemaining;
        this.missingWidth = MISSING_COL;
      } else if (this.nameWidth < maxRemaining) {
        const maxRemaining = this.maxCols - (this.nameWidth + pct_cols);
        if (this.missingWidth > maxRemaining) {
          this.missingWidth = maxRemaining;
        }
      }
    }
    const line = makeLine(this.nameWidth, this.missingWidth);
    this.cw.println(line);
    this.cw.println(tableHeader(this.nameWidth, this.missingWidth));
    this.cw.println(line);
  }

  onSummary(node: ReportNode, context: Context): void {
    if (this.hideTable) {
      return;
    }
    const nodeDepth = depthFor(node);
    const row = tableRow(
      node,
      context,
      this.cw!.colorize.bind(this.cw),
      this.nameWidth,
      nodeDepth,
      this.skipEmpty,
      this.skipFull,
      this.missingWidth,
    );
    if (row) {
      this.cw!.println(row);
    }
  }

  onDetail(node: ReportNode, context: Context): void {
    return this.onSummary(node, context);
  }

  onEnd(): void {
    if (!this.hideTable) {
      this.cw!.println(makeLine(this.nameWidth, this.missingWidth));
    }
    this.cw!.close();
  }
}

export default TextReport;
