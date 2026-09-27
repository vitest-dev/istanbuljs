/** Serialized coverage report payload embedded in the single-file HTML page. */
export interface ReportData {
  html?: {
    verbose?: boolean;
    subdir?: string;
    skipEmpty?: boolean;
    metricsToShow?: ("lines" | "branches" | "functions" | "statements")[];
    fileTags?: { glob: string; tag: string }[];
  };
  istanbul?: {
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
  stats?: {
    coverageFileCount: number;
    sourceFileCount: number;
  };
  /** project root used to relativize coverage paths in the UI (inferred or explicit) */
  projectRoot: string;
  coverage: Record<string, unknown>;
  sources: Record<string, string>;
  fileTagRules?: { glob: string; tag: string }[];
  fileTagsByPath?: Record<string, string[]>;
  generatedAt?: string;
  packageName?: string;
  packageVersion?: string;
}

declare global {
  interface Window {
    reportData?: ReportData;
  }
}
