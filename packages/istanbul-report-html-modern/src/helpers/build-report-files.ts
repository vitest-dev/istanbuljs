import type { FileTagRule } from "../file-tags";
import { projectRootBaseName, resolveSource, toRelativePath } from "../paths";
import type { FileCoverageData, ReportAppFile } from "../types";
import type { StatementWatermarks } from "./color";

export interface ReportDataLike {
  projectRoot?: string;
  coverage: Record<string, FileCoverageData | unknown>;
  sources: Record<string, string>;
  html?: { fileTags?: FileTagRule[] };
  istanbul?: {
    watermarks?: {
      statements?: StatementWatermarks;
    };
  };
  fileTagRules?: FileTagRule[];
  fileTagsByPath?: Record<string, string[]>;
}

/** Build `ReportApp` files from serialized report payload (absolute paths + sources). */
export function buildReportFiles(reportData: ReportDataLike): {
  files: ReportAppFile[];
  projectRoot: string;
  name: string;
  fileTagRules?: FileTagRule[];
  fileTagsByPath?: Record<string, string[]>;
  statementWatermarks?: StatementWatermarks;
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
    fileTagRules: reportData.fileTagRules ?? reportData.html?.fileTags,
    fileTagsByPath: reportData.fileTagsByPath,
    statementWatermarks: reportData.istanbul?.watermarks?.statements,
  };
}
