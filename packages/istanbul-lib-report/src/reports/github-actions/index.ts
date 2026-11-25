import type { FileCoverage } from "@vitest/istanbul-lib-coverage";

import type { ContentWriter } from "../../file-writer";
import type { Context, ReportNode } from "../../index";
import ReportBase from "../../report-base";

/** options accepted by {@link GithubActionsReport} */
export interface GithubActionsOptions {
  /** the file to write the workflow commands to, defaults to the console */
  file?: string | null;
}

/**
 * Prints one GitHub Actions `::error` workflow command per file with uncovered
 * statements, functions or branches. The annotation is anchored at the file's
 * first uncovered line and its message lists every uncovered line, so a file
 * takes a single slot of the 10 error annotations GitHub shows per step.
 */
class GithubActionsReport extends ReportBase {
  declare file: string | null;
  declare cw: ContentWriter | null;

  constructor(opts?: GithubActionsOptions) {
    super();

    opts = opts || {};
    this.file = opts.file || null;
    this.cw = null;
  }

  onStart(_node: ReportNode, context: Context): void {
    this.cw = context.writer.writeFile(this.file);
  }

  onDetail(node: ReportNode): void {
    const fileCoverage = node.getFileCoverage();
    const lines = uncoveredLines(fileCoverage);
    if (lines.length === 0) {
      return;
    }

    this.cw!.println(
      formatError(
        { file: fileCoverage.path, line: String(lines[0]), title: "Uncovered code" },
        `Uncovered ${lineRanges(lines)}`,
      ),
    );
  }

  onEnd(): void {
    this.cw!.close();
  }
}

/** sorted start lines of every statement, function and branch path with zero hits */
function uncoveredLines(fc: FileCoverage): number[] {
  const lines = new Set<number>();

  for (const [id, hits] of Object.entries(fc.s)) {
    if (hits === 0) lines.add(fc.statementMap[id]!.start.line);
  }
  for (const [id, hits] of Object.entries(fc.f)) {
    if (hits === 0) lines.add(fc.fnMap[id]!.loc.start.line);
  }
  for (const [id, paths] of Object.entries(fc.b)) {
    const branch = fc.branchMap[id]!;
    paths.forEach((hits, i) => {
      // an implicit else has an empty location, so fall back to the branch's own
      if (hits === 0) lines.add(branch.locations[i]?.start.line ?? branch.loc.start.line);
    });
  }

  return [...lines].sort((a, b) => a - b);
}

/** `[3, 4, 5, 9]` as `lines 3-5, 9` */
function lineRanges(lines: number[]): string {
  const runs: [number, number][] = [];
  for (const line of lines) {
    const last = runs.at(-1);
    if (last && line === last[1] + 1) {
      last[1] = line;
    } else {
      runs.push([line, line]);
    }
  }

  const text = runs.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`));
  return `${lines.length === 1 ? "line" : "lines"} ${text.join(", ")}`;
}

// workflow command format, matching Vitest's `github-actions` test reporter:
// https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#setting-an-error-message
function formatError(properties: Record<string, string>, message: string): string {
  const props = Object.entries(properties)
    .map(([key, value]) => `${key}=${escapeProperty(value)}`)
    .join(",");
  return `::error ${props}::${escapeData(message)}`;
}

function escapeData(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function escapeProperty(s: string): string {
  return escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

export default GithubActionsReport;
