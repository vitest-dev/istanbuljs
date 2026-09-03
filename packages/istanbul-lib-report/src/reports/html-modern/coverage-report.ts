import fs from "node:fs";
import { createRequire } from "node:module";

import { resolveProjectRoot } from "./infer-project-root";
import type { HtmlModernOptions } from "./options";
import type {
  CoverageData,
  GenerateOptions,
  GenerateResult,
  IstanbulReportContext,
  ReportData,
  SerializableHtmlModernOptions,
} from "./types";
import { resolveReportHtmlDist, writeHtmlReport, writeReportDataJson } from "./write-report";

const require = createRequire(import.meta.url);
const { name: packageName, version: packageVersion } = require("../../../package.json") as {
  name: string;
  version: string;
};

function serializeHtmlOptions(options: HtmlModernOptions): SerializableHtmlModernOptions {
  const html: SerializableHtmlModernOptions = {};

  if (options.verbose !== undefined) {
    html.verbose = options.verbose;
  }
  if (options.subdir !== undefined) {
    html.subdir = options.subdir;
  }
  if (options.skipEmpty !== undefined) {
    html.skipEmpty = options.skipEmpty;
  }
  if (options.metricsToShow !== undefined) {
    html.metricsToShow = options.metricsToShow;
  }
  if (options.projectRoot !== undefined) {
    html.projectRoot = options.projectRoot;
  }
  if (options.writeReportDataJson !== undefined) {
    html.writeReportDataJson = options.writeReportDataJson;
  }

  return html;
}

export class CoverageReport {
  private htmlOptions: HtmlModernOptions;

  constructor(htmlOptions: HtmlModernOptions = {}) {
    this.htmlOptions = htmlOptions;
  }

  buildReportData(
    coverage: CoverageData,
    sourceFinder: (filePath: string) => string,
    istanbul: IstanbulReportContext,
  ): ReportData {
    const sources: Record<string, string> = {};

    for (const filePath of Object.keys(coverage)) {
      try {
        sources[filePath] = sourceFinder(filePath);
      } catch {
        // skip files whose source cannot be resolved
      }
    }

    return {
      html: serializeHtmlOptions(this.htmlOptions),
      istanbul,
      stats: {
        coverageFileCount: Object.keys(coverage).length,
        sourceFileCount: Object.keys(sources).length,
      },
      projectRoot: resolveProjectRoot(Object.keys(coverage), this.htmlOptions.projectRoot),
      coverage,
      sources,
      generatedAt: new Date().toISOString(),
      packageName,
      packageVersion,
    };
  }

  async generate({
    coverage,
    targetDir,
    sourceFinder,
    istanbul,
  }: GenerateOptions): Promise<GenerateResult> {
    const reportData = this.buildReportData(coverage, sourceFinder, istanbul);
    fs.mkdirSync(targetDir, { recursive: true });

    let htmlReportPath: string | undefined;
    const reportHtmlDist = resolveReportHtmlDist();
    if (reportHtmlDist) {
      htmlReportPath = writeHtmlReport(reportData, targetDir, reportHtmlDist);
      if (this.htmlOptions.verbose) {
        console.log(`HTML report written to ${htmlReportPath}`);
      }
    } else if (this.htmlOptions.verbose) {
      console.log("@vitest/istanbul-report-html-modern not found, skipping HTML report generation");
    }

    if (this.htmlOptions.writeReportDataJson) {
      const reportDataJsonPath = writeReportDataJson(reportData, targetDir);
      if (this.htmlOptions.verbose) {
        console.log(`Report data written to ${reportDataJsonPath}`);
      }
    }

    return htmlReportPath !== undefined ? { reportData, htmlReportPath } : { reportData };
  }
}
