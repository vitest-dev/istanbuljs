/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import fs from "node:fs";
import path from "node:path";

import type { Totals } from "@vitest/istanbul-lib-coverage";

import type { Context, FileWriter, ReportNode } from "../../index";
import ReportBase from "../../report-base";
import HtmlReport from "../html/index";
import type { HtmlOptions, LinkMapper } from "../html/index";

/** options accepted by {@link HtmlSpaReport} */
export interface HtmlSpaOptions extends HtmlOptions {
  /** the metrics to show in the report UI, defaults to lines, branches and functions */
  metricsToShow?: ("lines" | "branches" | "functions" | "statements")[];
}

/** a single metric as embedded into the SPA's `window.data` */
interface SpaMetric {
  total: number;
  covered: number;
  skipped: number;
  missed: number;
  pct: number | "Unknown";
  classForPercent: string;
}

/** the recursive node structure embedded into the SPA's `window.data` */
interface SpaDataStructure {
  file: string;
  isEmpty: boolean;
  metrics: Record<"statements" | "branches" | "functions" | "lines", SpaMetric>;
  children: false | SpaDataStructure[];
}

const standardLinkMapper: LinkMapper = {
  getPath(node) {
    if (typeof node === "string") {
      return node;
    }
    let filePath = node.getQualifiedName();
    if (node.isSummary()) {
      if (filePath !== "") {
        filePath += "/index.html";
      } else {
        filePath = "index.html";
      }
    } else {
      filePath += ".html";
    }
    return filePath;
  },

  relativePath(source, target) {
    const targetPath = this.getPath(target);
    const sourcePath = path.dirname(this.getPath(source));
    return path.relative(sourcePath, targetPath);
  },

  assetPath(node, name) {
    return this.relativePath(this.getPath(node), name);
  },
};

class HtmlSpaReport extends ReportBase {
  declare verbose: boolean;
  declare linkMapper: LinkMapper;
  declare subdir: string;
  declare date: string;
  declare skipEmpty: boolean | undefined;
  declare htmlReport: HtmlReport;
  declare metricsToShow: ("lines" | "branches" | "functions" | "statements")[];

  constructor(opts: HtmlSpaOptions = {}) {
    super({
      // force the summarizer to nested for html-spa
      summarizer: "nested",
    });

    this.verbose = opts.verbose || false;
    this.linkMapper = opts.linkMapper || standardLinkMapper;
    this.subdir = opts.subdir || "";
    this.date = Date();
    this.skipEmpty = opts.skipEmpty;
    this.htmlReport = new HtmlReport(opts);
    this.htmlReport.getBreadcrumbHtml = function () {
      return '<a href="javascript:history.back()">Back</a>';
    };

    this.metricsToShow = opts.metricsToShow || ["lines", "branches", "functions"];
  }

  getWriter(context: Context): FileWriter {
    if (!this.subdir) {
      return context.writer;
    }
    return context.writer.writerForDir(this.subdir);
  }

  onStart(root: ReportNode, context: Context): void {
    this.htmlReport.onStart(root, context);

    const writer = this.getWriter(context);
    const srcDir = path.resolve(import.meta.dirname, "./assets");
    fs.readdirSync(srcDir).forEach((f) => {
      const resolvedSource = path.resolve(srcDir, f);
      const resolvedDestination = ".";
      const stat = fs.statSync(resolvedSource);
      let dest;

      if (stat.isFile()) {
        dest = resolvedDestination + "/" + f;
        if (this.verbose) {
          console.log("Write asset: " + dest);
        }
        writer.copyFile(resolvedSource, dest);
      }
    });
  }

  onDetail(node: ReportNode, context: Context): void {
    this.htmlReport.onDetail(node, context);
  }

  getMetric(metric: Totals, type: string, context: Context): SpaMetric {
    const isEmpty = metric.total === 0;
    return {
      total: metric.total,
      covered: metric.covered,
      skipped: metric.skipped,
      missed: metric.total - metric.covered,
      pct: isEmpty ? 0 : metric.pct,
      classForPercent: isEmpty
        ? "empty"
        : context.classForPercent(type, typeof metric.pct === "number" ? metric.pct : NaN),
    };
  }

  toDataStructure(node: ReportNode, context: Context): SpaDataStructure {
    const coverageSummary = node.getCoverageSummary()!;
    const metrics = {
      statements: this.getMetric(coverageSummary.statements, "statements", context),
      branches: this.getMetric(coverageSummary.branches, "branches", context),
      functions: this.getMetric(coverageSummary.functions, "functions", context),
      lines: this.getMetric(coverageSummary.lines, "lines", context),
    };

    return {
      file: node.getRelativeName(),
      isEmpty: coverageSummary.isEmpty(),
      metrics,
      children:
        node.isSummary() && node.getChildren().map((child) => this.toDataStructure(child, context)),
    };
  }

  onEnd(rootNode: ReportNode, context: Context): void {
    const data = this.toDataStructure(rootNode, context);

    const cw = this.getWriter(context).writeFile(this.linkMapper.getPath(rootNode));

    cw.write(
      `<!doctype html>
            <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <link rel="stylesheet" href="spa.css" />
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                </head>
                <body>
                    <div id="app" class="app"></div>
                    <script>
                        window.data = ${JSON.stringify(data)};
                        window.generatedDatetime = ${JSON.stringify(String(Date()))};
                        window.metricsToShow = ${JSON.stringify(this.metricsToShow)};
                    </script>
                    <script src="bundle.js"></script>
                </body>
            </html>`,
    );
    cw.close();
  }
}

export default HtmlSpaReport;
