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
 * Prints one GitHub Actions annotation workflow command per run of uncovered
 * lines, so each gap shows next to its own code in a pull request's diff. GitHub shows 10 warning and 10 error annotations per step and drops the
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
    const file = fc.path.replace(/[%\r\n:,]/g, encodeURIComponent);

    // workflow command format: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#setting-a-warning-message
    for (const [start, end] of uncoveredRuns(fc)) {
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
 * Runs of uncovered lines as `[start, end]`: lines with unrun statements, partly
 * covered branches, or the start of a function that never ran. As in the text
 * report's "Uncovered Line #s", a run spans lines without statements and ends
 * at the next covered line.
 */
function uncoveredRuns(fc: FileCoverage): [number, number][] {
  const covered = new Map(
    Object.entries(fc.getLineCoverage()).map(([line, hits]) => [Number(line), hits > 0]),
  );
  for (const [line, { coverage }] of Object.entries(fc.getBranchCoverageByLine())) {
    if (coverage < 100) covered.set(Number(line), false);
  }
  for (const [id, hits] of Object.entries(fc.f)) {
    if (hits === 0) covered.set(fc.fnMap[id]!.loc.start.line, false);
  }

  const runs: [number, number][] = [];
  let open = false;
  for (const line of [...covered.keys()].sort((a, b) => a - b)) {
    if (covered.get(line)) {
      open = false;
    } else if (open) {
      runs.at(-1)![1] = line;
    } else {
      runs.push([line, line]);
      open = true;
    }
  }

  return runs;
}

export default GithubActionsReport;
