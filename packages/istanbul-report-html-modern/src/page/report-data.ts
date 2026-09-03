/** Keep in sync with packages/istanbul-lib-report/src/reports/html-modern/coverage-report.ts */
export interface ReportData {
  html: {
    verbose?: boolean;
    subdir?: string;
    skipEmpty?: boolean;
    metricsToShow?: ("lines" | "branches" | "functions" | "statements")[];
  };
  istanbul: {
    dir: string;
    watermarks: {
      statements: [number, number];
      functions: [number, number];
      branches: [number, number];
      lines: [number, number];
    };
    defaultSummarizer: "flat" | "nested" | "pkg" | "defaultSummarizer";
    summarizer?: "flat" | "nested" | "pkg" | "defaultSummarizer";
    sourceFinder: "filesystem" | "custom";
  };
  stats: {
    coverageFileCount: number;
    sourceFileCount: number;
  };
  /** project root used to relativize coverage paths in the UI (inferred or explicit) */
  projectRoot: string;
  coverage: Record<string, unknown>;
  sources: Record<string, string>;
  generatedAt?: string;
  packageName?: string;
  packageVersion?: string;
}

declare global {
  interface Window {
    reportData?: ReportData;
  }
}
