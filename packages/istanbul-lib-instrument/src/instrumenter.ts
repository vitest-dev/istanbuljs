/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import { transformSync } from "@babel/core";
import type { FileResult, InputOptions, NodePath, PluginObject, types as t } from "@babel/core";
import type { ParserPlugin } from "@babel/parser";
import { defaults } from "@istanbuljs/schema";

import readInitialCoverage from "./read-coverage";
import type { InputSourceMap, SourceCoverageData } from "./source-coverage";
import programVisitor from "./visitor";
import type { VisitorExitResult } from "./visitor";

/** source map produced by babel's transform */
type SourceMap = NonNullable<FileResult["map"]>;

/** options accepted by {@link Instrumenter} and {@link createInstrumenter} */
export interface InstrumenterOptions {
  /** name of global coverage variable (default `__coverage__`) */
  coverageVariable: string;
  /** report boolean value of logical expressions (default `false`) */
  reportLogic: boolean;
  /** preserve comments in output (default `false`) */
  preserveComments: boolean;
  /** generate compact code (default `true`) */
  compact: boolean;
  /** set to true to instrument ES6 modules */
  esModules: boolean;
  /** set to true to allow `return` statements outside of functions */
  autoWrap: boolean;
  /** set to true to produce a source map for the instrumented code */
  produceSourceMap: boolean;
  /** set to array of class method names to ignore for coverage */
  ignoreClassMethods: string[];
  /** enable ignore hints for lines (start, stop) (default `false`) */
  ignoreLines: boolean;
  /**
   * a callback function that is called when a source map URL
   * is found in the original code. This function is called with the source file name
   * and the source map URL.
   */
  sourceMapUrlCallback: ((filename: string, url: string) => void) | null;
  /** turn debugging on (default `false`) */
  debug: boolean;
  /** set babel parser plugins, see @istanbuljs/schema for defaults */
  parserPlugins: ParserPlugin[];
  /** the global coverage variable scope (default `this`) */
  coverageGlobalScope: string;
  /** use an evaluated function to find coverageGlobalScope (default `true`) */
  coverageGlobalScopeFunc: boolean;
  /** set babel generator options */
  generatorOpts?: Record<string, unknown>;
}

/** callback for the callback-style {@link Instrumenter#instrument} method */
export type InstrumenterCallback = (error: Error | null, code?: string) => void;

/**
 * Instrumenter is the public API for the instrument library.
 * It is typically used for ES5 code. For ES6 code that you
 * are already running under `babel` use the coverage plugin
 * instead.
 * @param opts optional. See {@link InstrumenterOptions}.
 */
class Instrumenter {
  opts: InstrumenterOptions;
  fileCoverage: SourceCoverageData | null | undefined;
  sourceMap: SourceMap | InputSourceMap | null | undefined;

  constructor(opts: Partial<InstrumenterOptions> = {}) {
    this.opts = {
      ...defaults.instrumenter,
      ...opts,
    } as InstrumenterOptions;
    this.fileCoverage = null;
    this.sourceMap = null;
  }
  /**
   * instrument the supplied code and track coverage against the supplied
   * filename. It throws if invalid code is passed to it. ES5 and ES6 syntax
   * is supported. To instrument ES6 modules, make sure that you set the
   * `esModules` property to `true` when creating the instrumenter.
   *
   * @param code - the code to instrument
   * @param filename - the filename against which to track coverage.
   * @param inputSourceMap - the source map that maps the not instrumented code back to it's original form.
   * Is assigned to the coverage object and therefore, is available in the json output and can be used to remap the
   * coverage to the untranspiled source.
   * @returns the instrumented code.
   */
  instrumentSync(code: string, filename?: string | null, inputSourceMap?: InputSourceMap): string {
    if (typeof code !== "string") {
      throw new Error("Code must be a string");
    }
    filename = filename || String(new Date().getTime()) + ".js";
    const { opts } = this;
    let output: VisitorExitResult | undefined;
    const babelOpts: InputOptions = {
      configFile: false,
      babelrc: false,
      ast: true,
      filename: filename || String(new Date().getTime()) + ".js",
      // trace-mapping allows `sources: (string | null)[]`, babel's types don't — same runtime shape
      inputSourceMap: inputSourceMap as InputOptions["inputSourceMap"],
      sourceMaps: opts.produceSourceMap,
      compact: opts.compact,
      comments: opts.preserveComments,
      parserOpts: {
        allowReturnOutsideFunction: opts.autoWrap,
        sourceType: opts.esModules ? "module" : "script",
        plugins: opts.parserPlugins,
      },
      generatorOpts: opts.generatorOpts,
      plugins: [
        ({ types }: { types: typeof t }): PluginObject => {
          const ee = programVisitor(types, filename as string, {
            coverageVariable: opts.coverageVariable,
            reportLogic: opts.reportLogic,
            coverageGlobalScope: opts.coverageGlobalScope,
            coverageGlobalScopeFunc: opts.coverageGlobalScopeFunc,
            ignoreClassMethods: opts.ignoreClassMethods,
            ignoreLines: opts.ignoreLines,
            inputSourceMap,
          });

          return {
            visitor: {
              Program: {
                enter: ee.enter,
                exit(path: NodePath<t.Program>) {
                  output = ee.exit(path);
                },
              },
            },
          };
        },
      ],
    };

    const codeMap = transformSync(code, babelOpts)!;

    if (!output || !output.fileCoverage) {
      const initialCoverage =
        readInitialCoverage(codeMap.ast!) || /* istanbul ignore next: paranoid check */ {};
      this.fileCoverage = (initialCoverage as { coverageData?: SourceCoverageData }).coverageData;
      this.sourceMap = inputSourceMap;
      return code;
    }

    this.fileCoverage = output.fileCoverage;
    this.sourceMap = codeMap.map;
    const cb = this.opts.sourceMapUrlCallback;
    if (cb && output.sourceMappingURL) {
      cb(filename, output.sourceMappingURL);
    }

    return codeMap.code as string;
  }
  /**
   * callback-style instrument method that calls back with an error
   * as opposed to throwing one. Note that in the current implementation,
   * the callback will be called in the same process tick and is not asynchronous.
   *
   * @param code - the code to instrument
   * @param filename - the filename against which to track coverage.
   * @param callback - the callback
   * @param inputSourceMap - the source map that maps the not instrumented code back to it's original form.
   * Is assigned to the coverage object and therefore, is available in the json output and can be used to remap the
   * coverage to the untranspiled source.
   */
  instrument(
    code: string,
    filename?: string | InstrumenterCallback | null,
    callback?: InstrumenterCallback,
    inputSourceMap?: InputSourceMap,
  ): void {
    if (!callback && typeof filename === "function") {
      callback = filename;
      filename = null;
    }
    try {
      const out = this.instrumentSync(code, filename as string | null | undefined, inputSourceMap);
      callback!(null, out);
    } catch (ex) {
      callback!(ex as Error);
    }
  }
  /**
   * returns the file coverage object for the last file instrumented.
   * @returns the file coverage object.
   */
  lastFileCoverage(): SourceCoverageData {
    return this.fileCoverage as SourceCoverageData;
  }
  /**
   * returns the source map produced for the last file instrumented.
   * @returns the source map object.
   */
  lastSourceMap(): SourceMap | InputSourceMap | null | undefined {
    return this.sourceMap;
  }
}

export default Instrumenter;
