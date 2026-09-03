import { projectRootBaseName, resolveSource, toRelativePath } from "../paths";
import type { FileCoverageData, ReportAppFile } from "../types";

export interface ReportDataLike {
  projectRoot?: string;
  coverage: Record<string, FileCoverageData | unknown>;
  sources: Record<string, string>;
}

/** Build `ReportApp` files from serialized report payload (absolute paths + sources). */
export function buildReportFiles(reportData: ReportDataLike): {
  files: ReportAppFile[];
  projectRoot: string;
  name: string;
} {
  const projectRoot = reportData.projectRoot ?? "";
  const coverage = reportData.coverage as Record<string, FileCoverageData>;

  const files = Object.entries(coverage).map(([key, data]) => {
    const absPath = data.path || key;
    return {
      ...data,
      path: absPath,
      source: resolveSource(reportData.sources, toRelativePath(absPath, projectRoot), projectRoot),
    };
  });

  return {
    files,
    projectRoot,
    name: projectRootBaseName(projectRoot),
  };
}
