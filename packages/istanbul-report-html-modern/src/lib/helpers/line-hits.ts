import type { FileCoverageData } from "../types";

export interface LineHit {
  executionNumber: number;
}

/** Derive per-line hit counts from statement coverage for the editor gutter. */
export function computeLineHits(
  fileCoverage: FileCoverageData,
  fileDetail: string,
): {
  times: { lineNumber: number; count: number }[];
  rows: string[];
  maxWidth: number;
  lines: LineHit[];
} {
  const empty = {
    times: [] as { lineNumber: number; count: number }[],
    rows: [] as string[],
    maxWidth: 0,
    lines: [] as LineHit[],
  };

  if (fileCoverage.s === undefined) {
    return empty;
  }

  const rows = fileDetail.split("\n");
  const maxWidth = rows.reduce((max, row) => Math.max(max, row.length), 0);

  const lineMap: Record<number, number> = Object.create(null) as Record<number, number>;
  for (const [st, count] of Object.entries(fileCoverage.s)) {
    const meta = fileCoverage.statementMap[st];
    if (meta === undefined) {
      continue;
    }
    const { line } = meta.start;
    const prevVal = lineMap[line];
    if (prevVal === undefined || prevVal < count) {
      lineMap[line] = count;
    }
  }

  const times = Object.entries(lineMap).map(([lineNumber, count]) => ({
    lineNumber: Number(lineNumber),
    count,
  }));

  const lines: LineHit[] = [];
  for (let i = 0; i < rows.length; i++) {
    const found = times.find((n) => n.lineNumber === i + 1);
    lines.push({
      executionNumber: found === undefined ? -1 : found.count,
    });
  }

  return {
    times,
    rows,
    lines,
    maxWidth,
  };
}
