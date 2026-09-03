export interface CoverageLocation {
  line: number;
  column: number;
}

export interface CoverageRange {
  start: CoverageLocation;
  end: CoverageLocation;
}

export interface FunctionMapping {
  name?: string;
  decl?: CoverageRange;
  loc: CoverageRange;
}

export interface BranchMapping {
  loc?: CoverageRange;
  type: string;
  locations: CoverageRange[];
}

/** Shape compatible with istanbul-lib-coverage `FileCoverageData`. */
export interface FileCoverageData {
  path: string;
  statementMap: Record<string, CoverageRange>;
  fnMap: Record<string, FunctionMapping>;
  branchMap: Record<string, BranchMapping>;
  s: Record<string, number>;
  f: Record<string, number>;
  b: Record<string, number[]>;
}

export interface CoverageTotals {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface DataSourceItem {
  path: string;
  statements: CoverageTotals;
  branches: CoverageTotals;
  functions: CoverageTotals;
  lines: CoverageTotals;
}

export interface FileDataResponse {
  fileCoverage: FileCoverageData;
  fileContent: string;
}

export interface ReportProps {
  /** Report display name */
  name: string;
  /** Currently selected path */
  value: string;
  dataSource: DataSourceItem[];
  onSelect: (val: string) => Promise<FileDataResponse>;
}

export interface ReportAppFile extends FileCoverageData {
  source: string;
}

export interface ReportAppProps {
  files: ReportAppFile[];
  /** project root used to relativize coverage paths in the UI (inferred or explicit) */
  projectRoot: string;
  name?: string;
  /** Initial path when there is no hash, e.g. `src/index.ts` */
  defaultValue?: string;
}
