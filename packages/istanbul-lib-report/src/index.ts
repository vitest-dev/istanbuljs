/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */

/**
 * @module Exports
 */

import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

import Context from "./context";
import type { ContextOptions } from "./context";
import FileWriter from "./file-writer";
import ReportBase from "./report-base";
import CloverReport from "./reports/clover/index";
import type { CloverOptions } from "./reports/clover/index";
import CoberturaReport from "./reports/cobertura/index";
import type { CoberturaOptions } from "./reports/cobertura/index";
import HtmlModernReport from "./reports/html-modern/index";
import type { HtmlModernOptions } from "./reports/html-modern/index";
import HtmlSpaReport from "./reports/html-spa/index";
import type { HtmlSpaOptions } from "./reports/html-spa/index";
import HtmlReport from "./reports/html/index";
import type { HtmlOptions } from "./reports/html/index";
import JsonSummaryReport from "./reports/json-summary/index";
import type { JsonSummaryOptions } from "./reports/json-summary/index";
import JsonReport from "./reports/json/index";
import type { JsonOptions } from "./reports/json/index";
import LcovReport from "./reports/lcov/index";
import type { LcovOptions } from "./reports/lcov/index";
import LcovOnlyReport from "./reports/lcovonly/index";
import type { LcovOnlyOptions } from "./reports/lcovonly/index";
import NoneReport from "./reports/none/index";
import TeamcityReport from "./reports/teamcity/index";
import type { TeamcityOptions } from "./reports/teamcity/index";
import TextLcovReport from "./reports/text-lcov/index";
import type { TextLcovOptions } from "./reports/text-lcov/index";
import TextSummaryReport from "./reports/text-summary/index";
import type { TextSummaryOptions } from "./reports/text-summary/index";
import TextReport from "./reports/text/index";
import type { TextOptions } from "./reports/text/index";
import * as watermarks from "./watermarks";
import type { Watermarks } from "./watermarks";

export type { ContextOptions, SourceFinder } from "./context";
export type { Context };
export type { ContentWriter, ConsoleWriter, FileContentWriter } from "./file-writer";
export type { ReportBaseOptions } from "./report-base";
export type { CloverOptions } from "./reports/clover/index";
export type { CoberturaOptions } from "./reports/cobertura/index";
export type { HtmlSpaOptions } from "./reports/html-spa/index";
export type {
  CoverageData,
  GenerateOptions,
  GenerateResult,
  HtmlModernOptions,
  IstanbulReportContext,
  ReportData,
  ReportStats,
  SerializableHtmlModernOptions,
} from "./reports/html-modern/index";
export {
  CoverageReport,
  extractIstanbulContext,
  inferProjectRoot,
} from "./reports/html-modern/index";
export { default as HtmlModernReport } from "./reports/html-modern/index";
export type { HtmlOptions, LinkMapper } from "./reports/html/index";
export type { JsonSummaryOptions } from "./reports/json-summary/index";
export type { JsonOptions } from "./reports/json/index";
export type { LcovOptions } from "./reports/lcov/index";
export type { LcovOnlyOptions } from "./reports/lcovonly/index";
export type { TeamcityOptions } from "./reports/teamcity/index";
export type { TextLcovOptions } from "./reports/text-lcov/index";
export type { TextSummaryOptions } from "./reports/text-summary/index";
export type { TextOptions } from "./reports/text/index";
export type { ReportNode, ReportTree, Summarizers } from "./summarizer-factory";
export type { BaseNode, BaseTree, CompositeVisitor, PartialVisitor, Visitor } from "./tree";
export type { Watermark, Watermarks } from "./watermarks";
export type { XmlAttributes, default as XMLWriter } from "./xml-writer";

/**
 * returns a reporting context for the supplied options
 * @param {Object} [opts=null] opts
 * @returns {Context}
 */
export function createContext(opts: ContextOptions): Context {
  return new Context(opts);
}

/**
 * returns the default watermarks that would be used when not
 * overridden
 * @returns {Object} an object with `statements`, `functions`, `branches`,
 *  and `line` keys. Each value is a 2 element array that has the low and
 *  high watermark as percentages.
 */
export function getDefaultWatermarks(): Watermarks {
  return watermarks.getDefault();
}

/**
 * Base class for all reports
 */
export { ReportBase };

/**
 * Utility for writing files under a specific directory
 */
export { FileWriter };

const reports = {
  clover: CloverReport,
  cobertura: CoberturaReport,
  html: HtmlReport,
  "html-modern": HtmlModernReport,
  "html-spa": HtmlSpaReport,
  json: JsonReport,
  "json-summary": JsonSummaryReport,
  lcov: LcovReport,
  lcovonly: LcovOnlyReport,
  none: NoneReport,
  teamcity: TeamcityReport,
  text: TextReport,
  "text-lcov": TextLcovReport,
  "text-summary": TextSummaryReport,
};

/** options accepted by each built-in report, keyed by report name */
export interface ReportOptions {
  clover: CloverOptions;
  cobertura: CoberturaOptions;
  html: HtmlOptions;
  "html-modern": HtmlModernOptions;
  "html-spa": HtmlSpaOptions;
  json: JsonOptions;
  "json-summary": JsonSummaryOptions;
  lcov: LcovOptions;
  lcovonly: LcovOnlyOptions;
  none: never;
  teamcity: TeamcityOptions;
  text: TextOptions;
  "text-lcov": TextLcovOptions;
  "text-summary": TextSummaryOptions;
}

/** names of the built-in reports */
export type ReportType = keyof ReportOptions;

type ReportConstructor = new (cfg: object) => ReportBase;

function getBuiltinReport(name: string): ReportConstructor | undefined {
  return Object.hasOwn(reports, name)
    ? (reports as Record<string, ReportConstructor>)[name]
    : undefined;
}

function unwrapDefault(mod: unknown): unknown {
  return typeof mod === "object" && mod !== null && "default" in mod ? mod.default : mod;
}

/**
 * creates an instance of a built-in report.
 * @param name the report name, e.g. `html`, `json`, `text`
 * @param cfg options for the report
 */
export function create<T extends ReportType>(
  name: T,
  cfg?: Partial<ReportOptions[T]>,
): InstanceType<(typeof reports)[T]> {
  const Cons = getBuiltinReport(name);
  if (!Cons) {
    throw new Error(`Unknown report "${name}". Use createAsync() to load custom reports.`);
  }
  return new Cons(cfg ?? {}) as InstanceType<(typeof reports)[T]>;
}

/**
 * creates an instance of a built-in or custom report.
 *
 * Custom reports are loaded with `import()`, so `name` may be a package name,
 * an absolute path or a `file://` URL of an ES module or CommonJS module whose
 * default export (or `module.exports`) is the report class.
 * @param name the report name, package name or path
 * @param cfg options for the report
 */
export async function createAsync<T extends ReportType>(
  name: T,
  cfg?: Partial<ReportOptions[T]>,
): Promise<InstanceType<(typeof reports)[T]>>;
export async function createAsync(name: string, cfg?: object): Promise<ReportBase>;
export async function createAsync(name: string, cfg?: object): Promise<ReportBase> {
  let Cons = getBuiltinReport(name);

  if (!Cons) {
    const specifier = isAbsolute(name) ? pathToFileURL(name).href : name;
    const mod: unknown = await import(specifier);

    Cons = unwrapDefault(mod) as ReportConstructor;
    // CommonJS transpiled from ESM: `module.exports = { __esModule: true, default: … }`
    if (typeof Cons === "object" && Cons !== null && "__esModule" in Cons) {
      Cons = unwrapDefault(Cons) as ReportConstructor;
    }

    if (typeof Cons !== "function") {
      throw new TypeError(
        `Custom report "${name}" must export a report class as its default export (ESM) or module.exports (CommonJS)`,
      );
    }
  }

  return new Cons!(cfg ?? {});
}
