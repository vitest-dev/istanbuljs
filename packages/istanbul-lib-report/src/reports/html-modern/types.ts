import type { FileCoverageData } from "@vitest/istanbul-lib-coverage";

import type { Summarizers, Watermarks } from "../../index";
import type { HtmlModernOptions } from "./options";

/** coverage data keyed by absolute file path */
export type CoverageData = Record<string, FileCoverageData>;

/** html report options embedded in the HTML report (`linkMapper` is omitted) */
export type SerializableHtmlModernOptions = Omit<HtmlModernOptions, "linkMapper">;

/** serializable subset of istanbul `createContext` options plus report tree config */
export interface IstanbulReportContext {
  /** output directory from {@link Context.dir} */
  dir: string;
  /** low/high percentage thresholds from {@link Context.watermarks} */
  watermarks: Watermarks;
  /** default tree from `createContext({ defaultSummarizer })` */
  defaultSummarizer: Summarizers;
  /** tree chosen by this report via `ReportBase` `summarizer` option */
  summarizer?: Summarizers;
  /** whether context uses istanbul's filesystem lookup or a custom `sourceFinder` */
  sourceFinder: "filesystem" | "custom";
}

/** summary counts shown in the HTML report UI */
export interface ReportStats {
  coverageFileCount: number;
  sourceFileCount: number;
}

/** input to {@link CoverageReport.generate} */
export interface GenerateOptions {
  coverage: CoverageData;
  targetDir: string;
  sourceFinder: (filePath: string) => string;
  istanbul: IstanbulReportContext;
}

/** serialized payload embedded in the HTML report */
export interface ReportData {
  html: SerializableHtmlModernOptions;
  istanbul: IstanbulReportContext;
  stats: ReportStats;
  /** project root used to relativize coverage paths in the UI (inferred or explicit) */
  projectRoot: string;
  coverage: CoverageData;
  sources: Record<string, string>;
  generatedAt?: string;
  packageName?: string;
  packageVersion?: string;
}

/** output from {@link CoverageReport.generate} */
export interface GenerateResult {
  reportData: ReportData;
  htmlReportPath?: string;
}
