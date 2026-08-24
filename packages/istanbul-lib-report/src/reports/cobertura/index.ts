/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import path from "node:path";

import type { Totals } from "@vitest/istanbul-lib-coverage";

import { escape } from "../../html-escape";
import type { ContentWriter, Context, ReportNode, XmlAttributes, XMLWriter } from "../../index";
import ReportBase from "../../report-base";

/** options accepted by {@link CoberturaReport} */
export interface CoberturaOptions {
  /** the file to write the report to, defaults to `cobertura-coverage.xml` */
  file?: string;
  /** timestamp to embed in the report, defaults to `Date.now()` */
  timestamp?: string;
  /** the project root used to relativize file paths, defaults to `process.cwd()` */
  projectRoot?: string;
}

/** narrows a possibly-`"Unknown"` pct into the 0-1 rate the report emits */
function rate(metrics: Totals): number {
  const { pct } = metrics;
  return typeof pct === "number" ? pct / 100.0 : NaN;
}

class CoberturaReport extends ReportBase {
  declare cw: ContentWriter | null;
  declare xml: XMLWriter | null;
  declare timestamp: string;
  declare projectRoot: string;
  declare file: string;

  constructor(opts?: CoberturaOptions) {
    super();

    opts = opts || {};

    this.cw = null;
    this.xml = null;
    this.timestamp = opts.timestamp || Date.now().toString();
    this.projectRoot = opts.projectRoot || process.cwd();
    this.file = opts.file || "cobertura-coverage.xml";
  }

  onStart(root: ReportNode, context: Context): void {
    this.cw = context.writer.writeFile(this.file);
    this.xml = context.getXMLWriter(this.cw);
    this.writeRootStats(root);
  }

  onEnd(): void {
    this.xml!.closeAll();
    this.cw!.close();
  }

  writeRootStats(node: ReportNode): void {
    const metrics = node.getCoverageSummary()!;
    this.cw!.println('<?xml version="1.0" ?>');
    this.cw!.println(
      '<!DOCTYPE coverage SYSTEM "http://cobertura.sourceforge.net/xml/coverage-04.dtd">',
    );
    this.xml!.openTag("coverage", {
      "lines-valid": metrics.lines.total,
      "lines-covered": metrics.lines.covered,
      "line-rate": rate(metrics.lines),
      "branches-valid": metrics.branches.total,
      "branches-covered": metrics.branches.covered,
      "branch-rate": rate(metrics.branches),
      timestamp: this.timestamp,
      complexity: "0",
      version: "0.1",
    });
    this.xml!.openTag("sources");
    this.xml!.inlineTag("source", undefined, this.projectRoot);
    this.xml!.closeTag("sources");
    this.xml!.openTag("packages");
  }

  onSummary(node: ReportNode): void {
    const metrics = node.getCoverageSummary(true);
    if (!metrics) {
      return;
    }
    this.xml!.openTag("package", {
      name: node.isRoot() ? "main" : escape(asJavaPackage(node)),
      "line-rate": rate(metrics.lines),
      "branch-rate": rate(metrics.branches),
    });
    this.xml!.openTag("classes");
  }

  onSummaryEnd(node: ReportNode): void {
    const metrics = node.getCoverageSummary(true);
    if (!metrics) {
      return;
    }
    this.xml!.closeTag("classes");
    this.xml!.closeTag("package");
  }

  onDetail(node: ReportNode): void {
    const fileCoverage = node.getFileCoverage();
    const metrics = node.getCoverageSummary()!;
    const branchByLine = fileCoverage.getBranchCoverageByLine();

    this.xml!.openTag("class", {
      name: escape(asClassName(node)),
      filename: path.relative(this.projectRoot, fileCoverage.path),
      "line-rate": rate(metrics.lines),
      "branch-rate": rate(metrics.branches),
    });

    this.xml!.openTag("methods");
    const fnMap = fileCoverage.fnMap;
    Object.entries(fnMap).forEach(([k, { name, decl, loc }]) => {
      const hits = fileCoverage.f[k];
      // Some versions of the instrumenter in the wild populate 'loc'
      // but not 'decl':
      const start = (decl || loc).start;
      this.xml!.openTag("method", {
        name: escape(name),
        hits,
        signature: "()V", //fake out a no-args void return
      });
      this.xml!.openTag("lines");
      //Add the function definition line and hits so that jenkins cobertura plugin records method hits
      this.xml!.inlineTag("line", {
        number: start.line,
        hits,
      });
      this.xml!.closeTag("lines");
      this.xml!.closeTag("method");
    });
    this.xml!.closeTag("methods");

    this.xml!.openTag("lines");
    const lines = fileCoverage.getLineCoverage();
    Object.entries(lines).forEach(([k, hits]) => {
      const attrs: XmlAttributes = {
        number: k,
        hits,
        branch: "false",
      };
      const branchDetail = branchByLine[k];

      if (branchDetail) {
        attrs.branch = "true";
        attrs["condition-coverage"] =
          branchDetail.coverage + "% (" + branchDetail.covered + "/" + branchDetail.total + ")";
      }
      this.xml!.inlineTag("line", attrs);
    });

    this.xml!.closeTag("lines");
    this.xml!.closeTag("class");
  }
}

function asJavaPackage(node: ReportNode): string {
  return node.getRelativeName().replace(/\//g, ".").replace(/\\/g, ".").replace(/\.$/, "");
}

function asClassName(node: ReportNode): string {
  return node.getRelativeName().replace(/.*[\\/]/, "");
}

export default CoberturaReport;
