/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import fs from "node:fs";
import path from "node:path";

import type { CoverageSummary, Totals } from "@vitest/istanbul-lib-coverage";

import * as html from "../../html-escape";
import type { Context, FileWriter, ReportNode } from "../../index";
import ReportBase from "../../report-base";
import annotator from "./annotator";
import type { AnnotatedData } from "./annotator";

/** the four coverage metrics reported per node */
type MetricKey = "statements" | "branches" | "functions" | "lines";

/** maps report nodes to output paths, see the html report's `linkMapper` option */
export interface LinkMapper {
  getPath(node: ReportNode | string): string;
  relativePath(source: ReportNode | string, target: ReportNode | string): string;
  assetPath(node: ReportNode, name: string): string;
}

/** options accepted by {@link HtmlReport} */
export interface HtmlOptions {
  /** show extra logging while the report is generated */
  verbose?: boolean;
  /** maps report nodes to output paths */
  linkMapper?: LinkMapper;
  /** subdirectory (under the report dir) to write the report to */
  subdir?: string;
  /** skip nodes with no coverage */
  skipEmpty?: boolean;
}

/** data threaded through the header/footer templates while rendering a page */
interface TemplateData {
  datetime: string;
  entity: string;
  metrics: CoverageSummary;
  reportClass: string;
  pathHtml: string;
  base: { css: string };
  sorter: { js: string; image: string };
  blockNavigation: { js: string };
  prettify: { js: string; css: string };
  favicon: string;
}

/** data for a single row of a summary page */
interface SummaryLineData {
  reportClasses: Record<MetricKey, string>;
  metrics: CoverageSummary;
  file: string;
  output: string;
}

/** narrows a possibly-`"Unknown"` pct before handing it to `classForPercent` */
function classForPercent(context: Context, type: string, pct: Totals["pct"]): string {
  return context.classForPercent(type, typeof pct === "number" ? pct : NaN);
}

function htmlHead(details: TemplateData): string {
  return `
<head>
    <title>Code coverage report for ${html.escape(details.entity)}</title>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="${html.escape(details.prettify.css)}" />
    <link rel="stylesheet" href="${html.escape(details.base.css)}" />
    <link rel="shortcut icon" type="image/x-icon" href="${html.escape(details.favicon)}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style type='text/css'>
        .coverage-summary .sorter {
            background-image: url(${html.escape(details.sorter.image)});
        }
    </style>
</head>
    `;
}

function headerTemplate(details: TemplateData): string {
  function metricsTemplate({ pct, covered, total }: Totals, kind: string): string {
    return `
            <div class='fl pad1y space-right2'>
                <span class="strong">${pct}% </span>
                <span class="quiet">${kind}</span>
                <span class='fraction'>${covered}/${total}</span>
            </div>
        `;
  }

  function skipTemplate(metrics: CoverageSummary): string {
    const statements = metrics.statements.skipped;
    const branches = metrics.branches.skipped;
    const functions = metrics.functions.skipped;

    const countLabel = (c: number, label: string, plural: string): string[] | string =>
      c === 0 ? [] : `${c} ${label}${c === 1 ? "" : plural}`;
    const skips = ([] as string[]).concat(
      countLabel(statements, "statement", "s"),
      countLabel(functions, "function", "s"),
      countLabel(branches, "branch", "es"),
    );

    if (skips.length === 0) {
      return "";
    }

    return `
            <div class='fl pad1y'>
                <span class="strong">${skips.join(", ")}</span>
                <span class="quiet">Ignored</span>  &nbsp;&nbsp;&nbsp;&nbsp;
            </div>
        `;
  }

  return `
<!doctype html>
<html lang="en">
${htmlHead(details)}
<body>
<div class='wrapper'>
    <div class='pad1'>
        <h1>${details.pathHtml}</h1>
        <div class='clearfix'>
            ${metricsTemplate(details.metrics.statements, "Statements")}
            ${metricsTemplate(details.metrics.branches, "Branches")}
            ${metricsTemplate(details.metrics.functions, "Functions")}
            ${metricsTemplate(details.metrics.lines, "Lines")}
            ${skipTemplate(details.metrics)}
        </div>
        <p class="quiet">
            Press <em>n</em> or <em>j</em> to go to the next uncovered block, <em>b</em>, <em>p</em> or <em>k</em> for the previous block.
        </p>
        <template id="filterTemplate">
            <div class="quiet">
                Filter:
                <input type="search" id="fileSearch">
            </div>
        </template>
    </div>
    <div class='status-line ${details.reportClass}'></div>
    `;
}

function footerTemplate(details: TemplateData): string {
  return `
                <div class='push'></div><!-- for sticky footer -->
            </div><!-- /wrapper -->
            <div class='footer quiet pad2 space-top1 center small'>
                Code coverage generated by
                <a href="https://istanbul.js.org/" target="_blank" rel="noopener noreferrer">istanbul</a>
                at ${html.escape(details.datetime)}
            </div>
        <script src="${html.escape(details.prettify.js)}"></script>
        <script>
            window.onload = function () {
                prettyPrint();
            };
        </script>
        <script src="${html.escape(details.sorter.js)}"></script>
        <script src="${html.escape(details.blockNavigation.js)}"></script>
    </body>
</html>
    `;
}

function detailTemplate(data: AnnotatedData): string {
  const lineNumbers = new Array(data.maxLines).fill(undefined).map((_, i) => i + 1);
  const lineLink = (num: number) => `<a name='L${num}'></a><a href='#L${num}'>${num}</a>`;
  const lineCount = (line: { covered: string | null; hits: number | string }) =>
    `<span class="cline-any cline-${line.covered}">${line.hits}</span>`;

  /* This is rendered in a `<pre>`, need control of all whitespace. */
  return [
    "<tr>",
    `<td class="line-count quiet">${lineNumbers.map(lineLink).join("\n")}</td>`,
    `<td class="line-coverage quiet">${data.lineCoverage.map(lineCount).join("\n")}</td>`,
    `<td class="text"><pre class="prettyprint lang-js">${data.annotatedCode.join("\n")}</pre></td>`,
    "</tr>",
  ].join("");
}
const summaryTableHeader = [
  '<div class="pad1">',
  '<table class="coverage-summary">',
  "<thead>",
  "<tr>",
  '   <th data-col="file" data-fmt="html" data-html="true" class="file">File</th>',
  '   <th data-col="pic" data-type="number" data-fmt="html" data-html="true" class="pic"></th>',
  '   <th data-col="statements" data-type="number" data-fmt="pct" class="pct">Statements</th>',
  '   <th data-col="statements_raw" data-type="number" data-fmt="html" class="abs"></th>',
  '   <th data-col="branches" data-type="number" data-fmt="pct" class="pct">Branches</th>',
  '   <th data-col="branches_raw" data-type="number" data-fmt="html" class="abs"></th>',
  '   <th data-col="functions" data-type="number" data-fmt="pct" class="pct">Functions</th>',
  '   <th data-col="functions_raw" data-type="number" data-fmt="html" class="abs"></th>',
  '   <th data-col="lines" data-type="number" data-fmt="pct" class="pct">Lines</th>',
  '   <th data-col="lines_raw" data-type="number" data-fmt="html" class="abs"></th>',
  "</tr>",
  "</thead>",
  "<tbody>",
].join("\n");

function summaryLineTemplate(details: SummaryLineData): string {
  const { reportClasses, metrics, file, output } = details;
  const percentGraph = (pct: Totals["pct"]): string => {
    if (typeof pct !== "number" || !isFinite(pct)) {
      return "";
    }

    const cls = ["cover-fill"];
    if (pct === 100) {
      cls.push("cover-full");
    }

    pct = Math.floor(pct);
    return [
      `<div class="${cls.join(" ")}" style="width: ${pct}%"></div>`,
      `<div class="cover-empty" style="width: ${100 - pct}%"></div>`,
    ].join("");
  };
  const summaryType = (type: MetricKey, showGraph = false): string[] => {
    const info = metrics[type];
    const reportClass = reportClasses[type];
    const result = [
      `<td data-value="${info.pct}" class="pct ${reportClass}">${info.pct}%</td>`,
      `<td data-value="${info.total}" class="abs ${reportClass}">${info.covered}/${info.total}</td>`,
    ];
    if (showGraph) {
      result.unshift(
        `<td data-value="${info.pct}" class="pic ${reportClass}">`,
        `<div class="chart">${percentGraph(info.pct)}</div>`,
        `</td>`,
      );
    }

    return result;
  };

  return ([] as string[])
    .concat(
      "<tr>",
      `<td class="file ${
        reportClasses.statements
      }" data-value="${html.escape(file)}"><a href="${html.escape(
        output,
      )}">${html.escape(file)}</a></td>`,
      summaryType("statements", true),
      summaryType("branches"),
      summaryType("functions"),
      summaryType("lines"),
      "</tr>\n",
    )
    .join("\n\t");
}

const summaryTableFooter = ["</tbody>", "</table>", "</div>"].join("\n");
const emptyClasses: Record<MetricKey, string> = {
  statements: "empty",
  lines: "empty",
  functions: "empty",
  branches: "empty",
};

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
    return path.posix.relative(sourcePath, targetPath);
  },

  assetPath(node, name) {
    return this.relativePath(this.getPath(node), name);
  },
};

function fixPct(metrics: CoverageSummary): CoverageSummary {
  (Object.keys(emptyClasses) as MetricKey[]).forEach((key) => {
    metrics[key].pct = 0;
  });
  return metrics;
}

class HtmlReport extends ReportBase {
  declare verbose: boolean | undefined;
  declare linkMapper: LinkMapper;
  declare subdir: string;
  declare date: string;
  declare skipEmpty: boolean | undefined;

  constructor(opts: HtmlOptions) {
    super();

    this.verbose = opts.verbose;
    this.linkMapper = opts.linkMapper || standardLinkMapper;
    this.subdir = opts.subdir || "";
    this.date = new Date().toISOString();
    this.skipEmpty = opts.skipEmpty;
  }

  getBreadcrumbHtml(node: ReportNode): string {
    let parent = node.getParent();
    const nodePath: ReportNode[] = [];

    while (parent) {
      nodePath.push(parent);
      parent = parent.getParent();
    }

    const linkPath = nodePath.map((ancestor) => {
      const target = this.linkMapper.relativePath(node, ancestor);
      const name = ancestor.getRelativeName() || "All files";
      return '<a href="' + target + '">' + name + "</a>";
    });

    linkPath.reverse();
    return linkPath.length > 0 ? linkPath.join(" / ") + " " + node.getRelativeName() : "All files";
  }

  fillTemplate(node: ReportNode, templateData: TemplateData, context: Context): void {
    const linkMapper = this.linkMapper;
    const summary = node.getCoverageSummary()!;
    templateData.entity = node.getQualifiedName() || "All files";
    templateData.metrics = summary;
    templateData.reportClass = classForPercent(context, "statements", summary.statements.pct);
    templateData.pathHtml = this.getBreadcrumbHtml(node);
    templateData.base = {
      css: linkMapper.assetPath(node, "base.css"),
    };
    templateData.sorter = {
      js: linkMapper.assetPath(node, "sorter.js"),
      image: linkMapper.assetPath(node, "sort-arrow-sprite.png"),
    };
    templateData.blockNavigation = {
      js: linkMapper.assetPath(node, "block-navigation.js"),
    };
    templateData.prettify = {
      js: linkMapper.assetPath(node, "prettify.js"),
      css: linkMapper.assetPath(node, "prettify.css"),
    };
    templateData.favicon = linkMapper.assetPath(node, "favicon.png");
  }

  getTemplateData(): TemplateData {
    return { datetime: this.date } as TemplateData;
  }

  getWriter(context: Context): FileWriter {
    if (!this.subdir) {
      return context.writer;
    }
    return context.writer.writerForDir(this.subdir);
  }

  onStart(root: ReportNode, context: Context): void {
    const assetHeaders: Record<string, string> = {
      ".js": "/* eslint-disable */\n",
    };

    [".", "vendor"].forEach((subdir) => {
      const writer = this.getWriter(context);
      const srcDir = path.resolve(import.meta.dirname, "assets", subdir);
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
          writer.copyFile(resolvedSource, dest, assetHeaders[path.extname(f)]);
        }
      });
    });
  }

  onSummary(node: ReportNode, context: Context): void {
    const linkMapper = this.linkMapper;
    const templateData = this.getTemplateData();
    const children = node.getChildren();
    const skipEmpty = this.skipEmpty;

    this.fillTemplate(node, templateData, context);
    const cw = this.getWriter(context).writeFile(linkMapper.getPath(node));
    cw.write(headerTemplate(templateData));
    cw.write(summaryTableHeader);
    children.forEach((child) => {
      const metrics = child.getCoverageSummary()!;
      const isEmpty = metrics.isEmpty();
      if (skipEmpty && isEmpty) {
        return;
      }
      const reportClasses = isEmpty
        ? emptyClasses
        : {
            statements: classForPercent(context, "statements", metrics.statements.pct),
            lines: classForPercent(context, "lines", metrics.lines.pct),
            functions: classForPercent(context, "functions", metrics.functions.pct),
            branches: classForPercent(context, "branches", metrics.branches.pct),
          };
      const data = {
        metrics: isEmpty ? fixPct(metrics) : metrics,
        reportClasses,
        file: child.getRelativeName(),
        output: linkMapper.relativePath(node, child),
      };
      cw.write(summaryLineTemplate(data) + "\n");
    });
    cw.write(summaryTableFooter);
    cw.write(footerTemplate(templateData));
    cw.close();
  }

  onDetail(node: ReportNode, context: Context): void {
    const linkMapper = this.linkMapper;
    const templateData = this.getTemplateData();

    this.fillTemplate(node, templateData, context);
    const cw = this.getWriter(context).writeFile(linkMapper.getPath(node));
    cw.write(headerTemplate(templateData));
    cw.write('<pre><table class="coverage">\n');
    cw.write(detailTemplate(annotator(node.getFileCoverage(), context)));
    cw.write("</table></pre>\n");
    cw.write(footerTemplate(templateData));
    cw.close();
  }
}

export default HtmlReport;
