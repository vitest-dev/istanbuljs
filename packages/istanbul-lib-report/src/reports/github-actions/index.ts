import type { FileCoverage } from "@vitest/istanbul-lib-coverage";

import type { ContentWriter, Context, ReportNode } from "../../index";
import ReportBase from "../../report-base";

type AnnotationLevel = "notice" | "warning" | "error";

/** options accepted by {@link GithubActionsReport} */
export interface GithubActionsOptions {
  /** the file to write the workflow commands to, defaults to the console */
  file?: string | null;
  /**
   * the annotation level, defaults to `warning`. Use `error` when any
   * uncovered line fails the build, as with 100% coverage thresholds.
   */
  level?: AnnotationLevel;
}

/**
 * Prints one GitHub Actions annotation workflow command per run of consecutive
 * uncovered lines, so each gap shows next to its own code in a pull request's
 * diff. GitHub shows 10 warning and 10 error annotations per step and drops the
 * rest.
 */
class GithubActionsReport extends ReportBase {
  declare file: string | null;
  declare level: AnnotationLevel;
  declare cw: ContentWriter | null;

  constructor(opts?: GithubActionsOptions) {
    super();

    opts = opts || {};
    this.file = opts.file || null;
    this.level = opts.level || "warning";
    this.cw = null;
  }

  onStart(_node: ReportNode, context: Context): void {
    this.cw = context.writer.writeFile(this.file);
  }

  onDetail(node: ReportNode): void {
    const fc = node.getFileCoverage();
    const file = escapeProperty(fc.path);

    // workflow command format: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#setting-a-warning-message
    for (const [start, end] of lineRuns(uncoveredLines(fc))) {
      this.cw!.println(
        `::${this.level} file=${file},line=${start},endLine=${end},title=Uncovered code` +
          `::Uncovered ${start === end ? `line ${start}` : `lines ${start}-${end}`}`,
      );
    }
  }

  onEnd(): void {
    this.cw!.close();
  }
}

/**
 * sorted uncovered lines: the lines the text report lists, plus the lines of
 * partially covered branches and of functions that never ran
 */
function uncoveredLines(fc: FileCoverage): number[] {
  const lines = new Set(fc.getUncoveredLines().map(Number));

  for (const [line, { coverage }] of Object.entries(fc.getBranchCoverageByLine())) {
    if (coverage < 100) lines.add(Number(line));
  }
  for (const [id, hits] of Object.entries(fc.f)) {
    if (hits === 0) lines.add(fc.fnMap[id]!.loc.start.line);
  }

  return [...lines].sort((a, b) => a - b);
}

/** sorted, distinct `[3, 4, 5, 9]` as `[[3, 5], [9, 9]]` */
function lineRuns(lines: number[]): [number, number][] {
  const runs: [number, number][] = [];
  for (const line of lines) {
    const last = runs.at(-1);
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      runs.push([line, line]);
    }
  }

  return runs;
}

function escapeProperty(s: string): string {
  return s
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}

export default GithubActionsReport;
