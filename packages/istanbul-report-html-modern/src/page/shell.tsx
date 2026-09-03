import { buildReportFiles, ReportApp } from "@vitest/istanbul-report-html-modern";

import "@vitest/istanbul-report-html-modern/style.css";
import { useMemo } from "react";

import { ReportFooter } from "./components/ReportFooter";
import type { ReportData } from "./report-data";

/** Standalone single-file HTML page shell around {@link ReportApp}. */
export function ReportShell() {
  const reportData = window.reportData as ReportData | undefined | null;

  const prepared = useMemo(() => {
    if (reportData == null) {
      return null;
    }
    return buildReportFiles(reportData);
  }, [reportData]);

  if (prepared === null || reportData == null) {
    return <p>No report data loaded.</p>;
  }

  return (
    <div className="report-page">
      <div className="report-page__content">
        <ReportApp files={prepared.files} projectRoot={prepared.projectRoot} name={prepared.name} />
      </div>
      <ReportFooter
        generatedAt={reportData.generatedAt}
        packageName={reportData.packageName}
        packageVersion={reportData.packageVersion}
      />
    </div>
  );
}

export default ReportShell;
