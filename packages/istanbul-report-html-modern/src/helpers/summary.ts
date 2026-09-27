import type { CoverageTotals, DataSourceItem, FileCoverageData } from "../types";

export function percent(covered: number, total: number): number {
  if (total === 0) {
    return 100;
  }
  return Math.round((covered / total) * 10000) / 100;
}

export function emptyTotals(): CoverageTotals {
  return { total: 0, covered: 0, skipped: 0, pct: 100 };
}

export function mergeTotals(a: CoverageTotals, b: CoverageTotals): CoverageTotals {
  const total = a.total + b.total;
  const covered = a.covered + b.covered;
  const skipped = a.skipped + b.skipped;
  return { total, covered, skipped, pct: percent(covered, total) };
}

export function emptySummary(): Omit<DataSourceItem, "path"> {
  return {
    statements: emptyTotals(),
    branches: emptyTotals(),
    functions: emptyTotals(),
    lines: emptyTotals(),
  };
}

function hitsToTotals(hits: readonly number[]): CoverageTotals {
  const total = hits.length;
  const covered = hits.filter((count) => count > 0).length;
  return { total, covered, skipped: 0, pct: percent(covered, total) };
}

export function fileCoverageToSummary(coverage: FileCoverageData): Omit<DataSourceItem, "path"> {
  const lineHits = new Map<number, number>();
  for (const [id, range] of Object.entries(coverage.statementMap)) {
    const hits = coverage.s[id] ?? 0;
    const line = range.start.line;
    const prev = lineHits.get(line);
    if (prev === undefined || hits > prev) {
      lineHits.set(line, hits);
    }
  }

  return {
    statements: hitsToTotals(Object.values(coverage.s)),
    functions: hitsToTotals(Object.values(coverage.f)),
    branches: hitsToTotals(Object.values(coverage.b).flat()),
    lines: hitsToTotals([...lineHits.values()]),
  };
}

export function mergeSummaries(
  items: ReadonlyArray<Omit<DataSourceItem, "path">>,
): Omit<DataSourceItem, "path"> {
  return items.reduce<Omit<DataSourceItem, "path">>(
    (acc, item) => ({
      statements: mergeTotals(acc.statements, item.statements),
      branches: mergeTotals(acc.branches, item.branches),
      functions: mergeTotals(acc.functions, item.functions),
      lines: mergeTotals(acc.lines, item.lines),
    }),
    emptySummary(),
  );
}

export function filesToDataSource(files: readonly FileCoverageData[]): DataSourceItem[] {
  return files.map((file) => ({
    path: file.path,
    ...fileCoverageToSummary(file),
  }));
}

export function buildSummaryTree(
  value: string,
  files: readonly DataSourceItem[],
): {
  path: string;
  summary: Omit<DataSourceItem, "path">;
  children: DataSourceItem[];
} {
  const prefix = value === "" ? "" : `${value}/`;
  const under = files.filter((item) => {
    if (value === "") {
      return true;
    }
    return item.path === value || item.path.startsWith(prefix);
  });

  const groups = new Map<string, DataSourceItem[]>();
  for (const file of under) {
    if (file.path === value) {
      continue;
    }
    const rest = value === "" ? file.path : file.path.slice(prefix.length);
    const segment = rest.split("/")[0];
    if (segment === undefined || segment === "") {
      continue;
    }
    const childPath = value === "" ? segment : `${value}/${segment}`;
    const list = groups.get(childPath);
    if (list === undefined) {
      groups.set(childPath, [file]);
    } else {
      list.push(file);
    }
  }

  const children = [...groups.entries()]
    .map(([path, group]) => {
      const only = group.length === 1 ? group[0] : undefined;
      if (only !== undefined && only.path === path) {
        return only;
      }
      return { path, ...mergeSummaries(group) };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    path: value,
    summary: mergeSummaries(under),
    children,
  };
}
