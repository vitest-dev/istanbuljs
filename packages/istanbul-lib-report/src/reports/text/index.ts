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

function tableHeader(maxNameCols: number, missingWidth: string | number): string {
  const elements = [];
  elements.push(formatName("File", maxNameCols, 0));
  elements.push(formatPct("% Stmts"));
  elements.push(formatPct("% Branch", PCT_COLS + 1));
  elements.push(formatPct("% Funcs"));
  elements.push(formatPct("% Lines"));
  elements.push(formatName("Uncovered Line #s", missingWidth as number));
  return elements.join(DELIM) + " ";
}
