import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import MagicString from "magic-string";
import { assert, describe, it, expect } from "vitest";

import Instrumenter from "../src/instrumenter";
import * as verifier from "./util/verifier";

describe("varia", () => {
  it("debug/ walkDebug should not cause errors", async () => {
    const v = verifier.create("output = args[0];", {}, { debug: true });
    assert(!v.err);
    await v.verify(["X"], "X", {
      lines: { 1: 1 },
      statements: { 0: 1 },
    });
  });

  it("auto-generates filename", async () => {
    const v = verifier.create("output = args[0];", { file: null });
    assert(!v.err);
    await v.verify(["X"], "X", {
      lines: { 1: 1 },
      statements: { 0: 1 },
    });
  });

  it("handles windows-style paths in file names", async () => {
    const v = verifier.create("output = args[0];", { file: "c:\\x\\y.js" });
    assert(!v.err);
    await v.verify(["X"], "X", {
      lines: { 1: 1 },
      statements: { 0: 1 },
    });

    const cov = v.getCoverage();
    expect(Object.keys(cov)[0]).toBe("c:\\x\\y.js");
  });

  it("preserves comments when requested", async () => {
    const v = verifier.create("/* hello */\noutput = args[0];", {}, { preserveComments: true });
    assert(!v.err);
    await v.verify(["X"], "X", {
      lines: { 2: 1 },
      statements: { 0: 1 },
    });

    const code = v.getGeneratedCode();
    assert(code.match(/\/* hello */));
  });

  it("preserves function names for named export arrow functions", () => {
    /* https://github.com/istanbuljs/babel-plugin-istanbul/issues/125 */
    const v = verifier.create(
      "export const func = () => true;",
      { generateOnly: true },
      { esModules: true },
    );
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(code.match(/cov_(.+)\.s\[\d+\]\+\+;export const func = \(\) =>/));
  });

  it("honors ignore next for exported functions", () => {
    /* https://github.com/istanbuljs/istanbuljs/issues/297 */
    const v = verifier.create(
      "/* istanbul ignore next*/ export function fn1() {}" +
        "/* istanbul ignore next*/ export default function() {}",
      { generateOnly: true },
      { esModules: true, preserveComments: false },
    );
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(
      code.match(
        /return actualCoverage;}cov_[^(]+\(\);\/\* istanbul ignore next\*\/ export function fn1\(\) {}\/\* istanbul ignore next\*\/ export default function\(\) {}$/,
      ),
    );
  });

  it("instruments exported functions", () => {
    /* https://github.com/istanbuljs/istanbuljs/issues/297 */
    const v = verifier.create(
      "export function fn1() {}" + "export default function() {}",
      { generateOnly: true },
      { esModules: true },
    );
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(
      code.match(
        /return actualCoverage;}cov_([^(]+)\(\);export function fn1\(\) {cov_(.+)\.f\[\d+\]\+\+;}export default function\(\) {cov_(.+)\.f\[\d+\]\+\+;}/,
      ),
    );
  });

  it("returns last coverage object", async () => {
    const instrumenter = new Instrumenter({
      coverageVariable: "__testing_coverage__",
    });
    let err: any;
    let cov: any;

    await new Promise<void>((resolve) =>
      instrumenter.instrument("output = args[0]", import.meta.filename, (e) => {
        err = e;
        cov = instrumenter.lastFileCoverage();

        expect(err).toBeFalsy();
        assert(cov);
        resolve();
      }),
    );
  });

  it("creates a source-map when requested", () => {
    const opts = {
      produceSourceMap: true,
      coverageVariable: "__testing_coverage__",
    };
    const instrumenter = new Instrumenter(opts);
    const generated = instrumenter.instrumentSync("output = args[0]", import.meta.filename);

    assert(generated);
    expect(generated).toBeTypeOf("string");
    assert(instrumenter.lastSourceMap());
  });

  describe("combineSourceMaps", () => {
    // the input code is the original code without its two leading lines
    const original = "// header\n// header\nconst value = 1;\nconsole.log(value);\n";
    const input = new MagicString(original);
    input.remove(0, original.indexOf("const"));
    const code = input.toString();
    const inputSourceMap = {
      ...input.generateMap({ hires: true, source: "original.js", includeContent: true }),
      version: 3 as const,
    };

    function instrument(combineSourceMaps?: boolean) {
      const instrumenter = new Instrumenter({ produceSourceMap: true, combineSourceMaps });
      const generated = instrumenter.instrumentSync(code, "input.js", inputSourceMap);
      const map = instrumenter.lastSourceMap();
      assert(map);
      // the coverage header also contains "console.log" in the input source map
      const consoleLine = generated.split("\n").findLastIndex((l) => l.includes("console.log"));
      const position = originalPositionFor(new TraceMap(map as any), {
        line: consoleLine + 1,
        column: generated.split("\n")[consoleLine].indexOf("console.log"),
      });
      return { map, position, coverage: instrumenter.lastFileCoverage() };
    }

    it("maps to the original sources by default", () => {
      const { map, position, coverage } = instrument();

      expect(map.sources).toEqual(["original.js"]);
      expect(position).toMatchObject({ source: "original.js", line: 4, column: 0 });
      expect(coverage.inputSourceMap).toBe(inputSourceMap);
    });

    it("maps to the input code only when disabled", () => {
      const { map, position, coverage } = instrument(false);

      expect(map.sources).toEqual(["input.js"]);
      expect(map.sourcesContent).toEqual([code]);
      expect(position).toMatchObject({ source: "input.js", line: 2, column: 0 });
      expect(coverage.inputSourceMap).toBe(inputSourceMap);
    });

    it("produces no source map for already instrumented code when disabled", () => {
      const instrumenter = new Instrumenter({ produceSourceMap: true, combineSourceMaps: false });
      const generated = instrumenter.instrumentSync(code, "input.js", inputSourceMap);
      instrumenter.instrumentSync(generated, "input.js", inputSourceMap);

      expect(instrumenter.lastSourceMap()).toBeNull();
    });
  });

  it("registers source map URLs seen in the original source", () => {
    let f = "";
    let u = "";
    const fn = function (file: string, sourceMapUrl: string) {
      f = file;
      u = sourceMapUrl;
    };
    const opts = {
      sourceMapUrlCallback: fn,
      coverageVariable: "__testing_coverage__",
    };
    const instrumenter = new Instrumenter(opts);
    const generated = instrumenter.instrumentSync(
      "/* foobar */ output = args[0]\n// @sourceMappingURL=foo.map",
      import.meta.filename,
    );

    assert(generated);
    expect(f).toEqual(import.meta.filename);
    expect(u).toEqual("foo.map");
  });

  describe("callback style instrumentation", () => {
    it("allows filename to be optional", async () => {
      const instrumenter = new Instrumenter({
        coverageVariable: "__testing_coverage__",
      });
      let generated: any;
      let err: any;

      await new Promise<void>((resolve) =>
        instrumenter.instrument("output = args[0]", (e, c) => {
          err = e;
          generated = c;
          expect(err).toBeFalsy();
          assert(generated);
          resolve();
        }),
      );
    });
    it("returns instead of throwing errors", () => {
      const instrumenter = new Instrumenter({
        coverageVariable: "__testing_coverage__",
      });
      let generated: any = null;
      let err: any = null;

      instrumenter.instrument("output = args[0] : 1: 2", (e, c) => {
        err = e;
        generated = c;
      });
      assert(err);
      assert(!generated);
    });
  });

  // see: https://github.com/istanbuljs/istanbuljs/issues/110
  // TODO: it feels like we should be inserting line counters
  // for class exports and class declarations.
  it("properly exports named classes", () => {
    const v = verifier.create(
      "export class App extends Component {};",
      { generateOnly: true },
      { esModules: true },
    );
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(code.match(/return actualCoverage;}cov_[^(]+\(\);export class App extends/));
  });

  it("declares Function when needed", () => {
    const v = verifier.create(
      "function Function() {}",
      { generateOnly: true },
      { esModules: true },
    );
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(code.match(/var Function\s*=/));
  });

  it("does not declare Function when not needed", () => {
    const v = verifier.create(
      "function differentFunction() {}",
      { generateOnly: true },
      { esModules: true },
    );
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(!code.match(/var Function\s*=/));
  });

  it("does not add extra parenthesis when superclass is an identifier", () => {
    const v = verifier.create("class App extends Component {};", {
      generateOnly: true,
    });
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(code.match(/return actualCoverage;}cov_[^(]+\(\);class App extends Component/));
  });

  it("can store coverage object in alternative scope", () => {
    const opts = { generateOnly: true };
    const instrumentOpts = { coverageGlobalScope: "window.top" };
    const v = verifier.create('console.log("test");', opts, instrumentOpts);
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(code.match(/global\s*=\s*\(*new\s*Function\(['"]return\s*window.top['"]\)\)*\(\)/));
  });

  it("can store coverage object in alternative scope without function", () => {
    const opts = { generateOnly: true };
    const instrumentOpts = {
      coverageGlobalScope: "window.top",
      coverageGlobalScopeFunc: false,
    };
    const v = verifier.create('console.log("test");', opts, instrumentOpts);
    assert(!v.err);

    const code = v.getGeneratedCode();
    assert(code.match(/global\s*=\s*window.top;/));
  });
});
