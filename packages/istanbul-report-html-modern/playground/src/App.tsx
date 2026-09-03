import reportData from "@repo/fixtures/report-data.json";
import { buildReportFiles, ReportApp } from "@vitest/istanbul-report-html-modern";

import "@vitest/istanbul-report-html-modern/style.css";
import type { FileCoverageData } from "@vitest/istanbul-report-html-modern";
import { useMemo } from "react";

export function App() {
  const prepared = useMemo(
    () =>
      buildReportFiles({
        projectRoot: reportData.projectRoot,
        coverage: reportData.coverage as Record<string, FileCoverageData>,
        sources: reportData.sources,
      }),
    [],
  );

  return (
    <ReportApp
      files={prepared.files}
      projectRoot={prepared.projectRoot}
      name={prepared.name || "playground"}
    />
  );
}
