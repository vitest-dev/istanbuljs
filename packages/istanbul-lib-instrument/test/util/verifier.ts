import { classes } from "@vitest/istanbul-lib-coverage";
import { assert } from "vitest";

import type { InputSourceMap, InstrumenterOptions } from "../../src/index";
import Instrumenter from "../../src/instrumenter";
import readInitialCoverage from "../../src/read-coverage";

const FileCoverage = classes.FileCoverage;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

interface VerifierResult {
  err?: Error;
  debug: boolean;
  file: string | null;
  fn: any;
  code: any;
  generatedCode: string | undefined;
  coverageVariable: string;
  baseline: any;
  emptyCoverage: any;
}

function pad(str: any, len: number): string {
  const blanks = "                                             ";
  if (str.length >= len) {
    return str;
  }
  return blanks.substring(0, len - str.length) + str;
}

function annotatedCode(code: string): string {
  const codeArray = code.split("\n");
  let line = 0;
  const annotated = codeArray.map((str) => {
    line += 1;
    return pad(line, 6) + ": " + str;
  });
  return annotated.join("\n");
}

function getGlobalObject(): any {
  if (typeof globalThis !== "undefined") {
    // eslint-disable-next-line no-undef
    return globalThis;
  }
  if (typeof global !== "undefined") {
    // eslint-disable-next-line no-undef
    return global;
  }
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-undef
    return window;
  }
  if (typeof self !== "undefined") {
    // eslint-disable-next-line no-undef
    return self;
  }
  return new Function("return this")();
}

class Verifier {
  result: VerifierResult;

  // NOTE: these fields are never assigned - they only exist on `this.result`.
  // Some tests read them from the verifier directly (`v.err`, `v.code`,
  // `v.generatedCode`) and rely on them being `undefined`; these declarations
  // preserve that long-standing behavior under type checking.
  declare err?: Error;
  declare code?: string;
  declare generatedCode?: string;

  constructor(result: VerifierResult) {
    this.result = result;
  }

  async verify(args: unknown[], expectedOutput: unknown, expectedCoverage: any): Promise<void> {
    assert.ok(!this.result.err, ((this.result.err || {}) as Error).message);
    getGlobalObject()[this.result.coverageVariable] = structuredClone(this.result.baseline);
    const actualOutput = await this.result.fn(args);
    const cov = this.getFileCoverage();

    assert.ok(cov && typeof cov === "object", "No coverage found for [" + this.result.file + "]");
    assert.deepEqual(actualOutput, expectedOutput, "Output mismatch");
    assert.deepEqual(cov.getLineCoverage(), expectedCoverage.lines || {}, "Line coverage mismatch");
    assert.deepEqual(cov.f, expectedCoverage.functions || {}, "Function coverage mismatch");
    assert.deepEqual(cov.b, expectedCoverage.branches || {}, "Branch coverage mismatch");
    assert.deepEqual(
      cov.bT || {},
      expectedCoverage.branchesTrue || {},
      "Branch truthiness coverage mismatch",
    );
    assert.deepEqual(cov.s, expectedCoverage.statements || {}, "Statement coverage mismatch");
    assert.deepEqual(
      (cov.data as any).inputSourceMap,
      expectedCoverage.inputSourceMap || undefined,
      "Input source map mismatch",
    );
    const initial = readInitialCoverage(this.getGeneratedCode());
    assert.ok(initial);
    assert.deepEqual(initial!.coverageData, this.result.emptyCoverage);
    assert.ok(initial!.path);
    if (this.result.file) {
      assert.equal(initial!.path, this.result.file);
    }
    assert.equal(initial!.gcv, this.result.coverageVariable);
    assert.ok(initial!.hash);
  }

  getCoverage(): any {
    return getGlobalObject()[this.result.coverageVariable];
  }

  getFileCoverage() {
    const cov = this.getCoverage();
    return new FileCoverage(cov[Object.keys(cov)[0]]);
  }

  getGeneratedCode(): string {
    return this.result.generatedCode as string;
  }

  compileError(): Error | undefined {
    return this.result.err;
  }
}

function extractTestOption(opts: Record<string, any>, name: string, defaultValue: any): any {
  let v = defaultValue;
  if (Object.prototype.hasOwnProperty.call(opts, name)) {
    v = opts[name];
  }
  return v;
}

function create(
  code: any,
  opts?: Record<string, any> | null,
  instrumenterOpts?: Partial<InstrumenterOptions> | null,
  inputSourceMap?: InputSourceMap,
): Verifier {
  opts = opts || {};
  instrumenterOpts = instrumenterOpts || {};
  instrumenterOpts.coverageVariable = instrumenterOpts.coverageVariable || "__testing_coverage__";

  const debug = extractTestOption(opts, "debug", process.env.DEBUG === "1");
  const file = extractTestOption(opts, "file", import.meta.filename);
  const generateOnly = extractTestOption(opts, "generateOnly", false);
  const noCoverage = extractTestOption(opts, "noCoverage", false);
  const quiet = extractTestOption(opts, "quiet", false);
  const coverageVariable = instrumenterOpts.coverageVariable;
  const g = getGlobalObject();
  let instrumenterOutput: string | undefined;
  let wrapped;
  let fn;
  let verror: Error | undefined;

  if (debug) {
    instrumenterOpts.compact = false;
  }
  const instrumenter = new Instrumenter(instrumenterOpts);
  try {
    instrumenterOutput = instrumenter.instrumentSync(code, file, inputSourceMap);
    if (debug) {
      console.log("================== Original ============================================");
      console.log(annotatedCode(code));
      console.log("================== Generated ===========================================");
      console.log(instrumenterOutput);
      console.log("========================================================================");
    }
  } catch (ex: any) {
    if (!quiet) {
      console.error(ex.stack);
    }
    verror = new Error("Error instrumenting:\n" + annotatedCode(String(code)) + "\n" + ex.message);
  }
  if (!(verror || generateOnly)) {
    wrapped = "{ var output;\n" + instrumenterOutput + "\nreturn output;\n}";
    g[coverageVariable] = undefined;
    try {
      if (opts.isAsync) {
        fn = new AsyncFunction("args", wrapped);
      } else {
        fn = new Function("args", wrapped);
      }
    } catch (ex: any) {
      console.error(ex.stack);
      verror = new Error("Error compiling\n" + annotatedCode(code) + "\n" + ex.message);
    }
  }
  if (generateOnly || noCoverage) {
    assert.ok(!verror);
  }
  return new Verifier({
    err: verror,
    debug,
    file,
    fn,
    code,
    generatedCode: instrumenterOutput,
    coverageVariable,
    baseline: structuredClone(g[coverageVariable]),
    emptyCoverage: instrumenter.lastFileCoverage(),
  });
}

export { create };
