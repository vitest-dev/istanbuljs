/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import type { FileCoverageData } from "@vitest/istanbul-lib-coverage";

import type { Context, ReportBaseOptions, ReportNode, Summarizers } from "../../index";
import ReportBase from "../../report-base";
import { CoverageReport } from "./coverage-report";
import { extractIstanbulContext } from "./istanbul-context";
import type { HtmlModernOptions } from "./options";

export type { LinkMapper } from "../html/index";
export type { HtmlModernOptions } from "./options";
export type {
  CoverageData,
  GenerateOptions,
  GenerateResult,
  IstanbulReportContext,
  ReportData,
  ReportStats,
  SerializableHtmlModernOptions,
} from "./types";
export { CoverageReport } from "./coverage-report";
export { extractIstanbulContext } from "./istanbul-context";
export { inferProjectRoot, resolveProjectRoot } from "./infer-project-root";

class HtmlModernReport extends ReportBase {
  private htmlOptions: HtmlModernOptions;
  private coverage: Record<string, FileCoverageData> = {};
  private summarizer?: Summarizers;

  constructor(opts: HtmlModernOptions & Partial<ReportBaseOptions> = {}) {
    super(opts);
    this.htmlOptions = opts;
    if (opts.summarizer !== undefined) {
      this.summarizer = opts.summarizer;
    }
  }

  /** Called for each file node during tree traversal; stores a deep clone keyed by path. */
  onDetail(node: ReportNode): void {
    const fileCoverage: FileCoverageData = JSON.parse(
      JSON.stringify(node.getFileCoverage().toJSON()),
    );
    this.coverage[fileCoverage.path] = fileCoverage;
  }

  /** Called after traversal completes; generates the HTML report via {@link CoverageReport}. */
  async onEnd(_rootNode: ReportNode, context: Context): Promise<void> {
    const coverageReport = new CoverageReport(this.htmlOptions);
    await coverageReport.generate({
      coverage: this.coverage,
      targetDir: context.dir,
      sourceFinder: context.sourceFinder,
      istanbul: extractIstanbulContext(context, this.summarizer),
    });
  }
}

export default HtmlModernReport;
