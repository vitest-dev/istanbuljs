/*
Copyright 2012-2015, Yahoo Inc.
Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
*/
import { defaults } from "@istanbuljs/schema";
import remapping from "@jridgewell/remapping";
import type { EncodedSourceMap } from "@jridgewell/trace-mapping";
import MagicString from "magic-string";

import { parse } from "./parse";
import readInitialCoverage from "./read-coverage";
import type { InputSourceMap, SourceCoverageData } from "./source-coverage";
import instrumentProgram from "./visitor";

/** source map produced for the instrumented code */
export type SourceMap = EncodedSourceMap;

/** options accepted by {@link Instrumenter} and {@link createInstrumenter} */
export interface InstrumenterOptions {
  /** name of global coverage variable (default `__coverage__`) */
  coverageVariable: string;
  /** report boolean value of logical expressions (default `false`) */
  reportLogic: boolean;
  /**
   * @deprecated has no effect, comments of the original code are always preserved
   */
  preserveComments: boolean;
  /**
   * @deprecated has no effect, the original code is preserved as-is
   */
  compact: boolean;
  /** set to true to instrument ES6 modules */
  esModules: boolean;
  /** set to true to allow `return` statements outside of functions */
  autoWrap: boolean;
  /** set to true to produce a source map for the instrumented code */
  produceSourceMap: boolean;
  /**
   * combine the produced source map with the input source map (default `true`).
   * Set to `false` to get a source map of the instrumentation step only, e.g. for
   * bundler plugins whose source maps are combined by the bundler.
   * The input source map is still stored in the coverage data, see `inputSourceMap`.
   */
  combineSourceMaps: boolean;
  /**
   * store the input source map in the coverage data (default `true`).
   * The coverage data is embedded into the instrumented code, so the source map
   * is a large part of it. When set to `false`, the source map has to be registered
   * to the `MapStore` with `registerMap` before transforming the coverage.
   */
  inputSourceMap: boolean;
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
  /**
   * @deprecated has no effect
   */
  debug: boolean;
  /** the global coverage variable scope (default `this`) */
  coverageGlobalScope: string;
  /** use an evaluated function to find coverageGlobalScope (default `true`) */
  coverageGlobalScopeFunc: boolean;
}

/** callback for the callback-style {@link Instrumenter#instrument} method */
export type InstrumenterCallback = (error: Error | null, code?: string) => void;

/**
 * Instrumenter is the public API for the instrument library.
 * The code is parsed with OXC and coverage counters are inserted
 * into the original code with `magic-string`.
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
    const { program, comments } = parse(code, filename, opts);
    const combineSourceMaps = opts.combineSourceMaps !== false;
    const s = new MagicString(code);

    const output = instrumentProgram(s, program, comments, filename, {
      coverageVariable: opts.coverageVariable,
      reportLogic: opts.reportLogic,
      coverageGlobalScope: opts.coverageGlobalScope,
      coverageGlobalScopeFunc: opts.coverageGlobalScopeFunc,
      ignoreClassMethods: opts.ignoreClassMethods,
      ignoreLines: opts.ignoreLines,
      inputSourceMap,
      storeInputSourceMap: opts.inputSourceMap !== false,
    });

    if (!output) {
      const initialCoverage =
        readInitialCoverage(program) || /* istanbul ignore next: paranoid check */ {};
      this.fileCoverage = (initialCoverage as { coverageData?: SourceCoverageData }).coverageData;
      this.sourceMap = combineSourceMaps ? inputSourceMap : null;
      return code;
    }

    this.fileCoverage = output.fileCoverage;
    this.sourceMap = opts.produceSourceMap
      ? createSourceMap(s, filename, combineSourceMaps ? inputSourceMap : undefined)
      : null;
    const cb = this.opts.sourceMapUrlCallback;
    if (cb && output.sourceMappingURL) {
      cb(filename, output.sourceMappingURL);
    }

    return s.toString();
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

// maps the instrumented code to the input code, and further to the original
// sources when the input code has a source map
function createSourceMap(
  s: MagicString,
  filename: string,
  inputSourceMap?: InputSourceMap,
): SourceMap {
  const map = s.generateMap({ hires: "boundary", source: filename, includeContent: true });
  if (!inputSourceMap) {
    return {
      version: 3,
      names: map.names,
      sources: map.sources,
      sourcesContent: map.sourcesContent,
      mappings: map.mappings,
    };
  }
  const remapped = remapping([map as EncodedSourceMap, inputSourceMap], () => null);
  return {
    version: 3,
    names: remapped.names,
    sources: remapped.sources,
    sourcesContent: remapped.sourcesContent,
    mappings: remapped.mappings as string,
    ...(remapped.ignoreList && remapped.ignoreList.length > 0
      ? { ignoreList: remapped.ignoreList }
      : {}),
  };
}

export default Instrumenter;
