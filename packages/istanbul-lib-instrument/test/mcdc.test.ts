import { describe, expect, it } from "vitest";

import Instrumenter from "../src/instrumenter";
import type { InstrumenterOptions } from "../src/instrumenter";
import { parse } from "../src/parse";
import type { SourceCoverageData } from "../src/source-coverage";

const COVERAGE = "__mcdc_coverage__";
const FILE = "mcdc.js";
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const g = globalThis as any;

// `initialCoverage` is the empty coverage data created by the instrumenter
function instrument(code: string, opts: Partial<InstrumenterOptions> = {}) {
  const instrumenter = new Instrumenter({ coverageVariable: COVERAGE, mcdc: true, ...opts });
  const generated = instrumenter.instrumentSync(code, FILE);
  return { generated, initialCoverage: instrumenter.lastFileCoverage() };
}

// evaluates the code the same way as the spec verifier: `args` in, `output` out
function evaluate(code: string, args: unknown[] = [], isAsync = false): any {
  const Fn = isAsync ? AsyncFunction : Function;
  return new Fn("args", `var output;\n${code}\nreturn output;`)(args);
}

function resetCoverage() {
  delete g[COVERAGE];
}

function fileCoverage(): SourceCoverageData {
  return g[COVERAGE][FILE];
}

// the hit test vectors of each decision, e.g. `{ 0: { "T-F": 1 } }`
function hitVectors(): Record<string, Record<string, number>> {
  const { decisionMap, d } = fileCoverage();
  return Object.fromEntries(
    Object.entries(decisionMap!).map(([id, { vectors }]) => [
      id,
      Object.fromEntries(
        vectors.flatMap((vector, i) => (d![id][i] > 0 ? [[vector, d![id][i]]] : [])),
      ),
    ]),
  );
}

// instruments and runs the code, checking the output against the original code.
// `initialCoverage` is the coverage data embedded into the code, the hits are counted in
// its copy, see `fileCoverage`.
function run(code: string, args: unknown[] = []) {
  const { generated, initialCoverage } = instrument(code);
  resetCoverage();
  const output = evaluate(generated, args);
  expect(output).toStrictEqual(evaluate(code, args));
  return { output, generated, initialCoverage, vectors: hitVectors() };
}

function expectValidSyntax(code: string, esModules: boolean) {
  expect(() => parse(code, "generated.jsx", { esModules, autoWrap: false })).not.toThrow();
}

describe("mcdc option", () => {
  it("is disabled by default", () => {
    const instrumenter = new Instrumenter();
    const generated = instrumenter.instrumentSync("output = args[0] && args[1];", FILE);
    const initialCoverage = instrumenter.lastFileCoverage();
    expect(initialCoverage.decisionMap).toBeUndefined();
    expect(initialCoverage.d).toBeUndefined();
    expect(generated).not.toContain("_d0");
  });

  it("adds empty decisions when there are none", () => {
    const { initialCoverage } = instrument("output = args[0] ?? 1;");
    expect(initialCoverage.decisionMap).toEqual({});
    expect(initialCoverage.d).toEqual({});
  });

  it("does not change statement, function and branch coverage", () => {
    const code = `
      function canAccess(isOwner, isShared, isNotRevoked) {
        return (isOwner || isShared) && isNotRevoked ? "yes" : "no";
      }
      output = canAccess(args[0], args[1], args[2]);
    `;
    const [off, on] = [false, true].map((mcdc) => {
      resetCoverage();
      evaluate(instrument(code, { mcdc }).generated, [false, true, true]);
      const { s, f, b, statementMap, fnMap, branchMap } = fileCoverage();
      return { s, f, b, statementMap, fnMap, branchMap };
    });
    expect(on).toEqual(off);
    expect(on.b).toEqual({ 0: [1, 0], 1: [1, 1, 1] });
  });
});

describe("decision data", () => {
  it("records the test vectors of a condition masked by another one", () => {
    const code = `
      function canAccess(isOwner, isShared, isNotRevoked) {
        return (isOwner || isShared) && isNotRevoked;
      }
      output = [canAccess(true, false, false), canAccess(false, true, true)];
    `;
    const { initialCoverage, vectors } = run(code);

    expect(initialCoverage.decisionMap).toEqual({
      0: {
        loc: { start: { line: 3, column: 15 }, end: { line: 3, column: 52 } },
        conditions: [
          { start: { line: 3, column: 16 }, end: { line: 3, column: 23 } },
          { start: { line: 3, column: 27 }, end: { line: 3, column: 35 } },
          { start: { line: 3, column: 40 }, end: { line: 3, column: 52 } },
        ],
        vectors: ["FF-", "FTF", "FTT", "T-F", "T-T"],
      },
    });
    // the embedded coverage data starts at zero, running the code increments its copy
    expect(initialCoverage.d).toEqual({ 0: [0, 0, 0, 0, 0] });
    expect(fileCoverage().d).toEqual({ 0: [0, 0, 1, 1, 0] });
    // 100% branch coverage, but `isOwner` has no independence pair
    expect(vectors).toEqual({ 0: { "T-F": 1, FTT: 1 } });
  });

  // each shape is evaluated with all combinations of truthy and falsy conditions, and the
  // hit vectors are compared to the conditions that the original code evaluated
  const shapes = [
    "c(0) && c(1)",
    "c(0) || c(1)",
    "c(0) && c(1) && c(2)",
    "c(0) || c(1) || c(2)",
    "(c(0) || c(1)) && c(2)",
    "c(0) || c(1) && c(2)",
    "c(0) && c(1) || c(2)",
    "(((c(0))) && ((c(1))))",
    "(c(0) && c(1)) || (c(2) && c(3))",
    "(c(0) || c(1)) && (c(2) || c(3))",
    "c(0) && (c(1) || c(2)) && c(3)",
    "c(0) || (c(1) && (c(2) || c(3)))",
    "((c(0) && c(1)) || c(2)) && (c(3) || (c(4) && c(5)))",
  ];
  const truthy = [true, 1, "x", {}, [], -1, Symbol("s")];
  const falsy = [false, 0, "", null, undefined, Number.NaN, 0n];

  it.each(shapes)("numbers the test vectors of %s", (shape) => {
    const n = shape.match(/c\(/g)!.length;
    const code = `
      const [values, log] = args;
      const c = (i) => (log.push(i), values[i]);
      output = ${shape};
    `;
    const { generated, initialCoverage } = instrument(code);
    resetCoverage();

    const expected: Record<string, number> = Object.fromEntries(
      initialCoverage.decisionMap![0].vectors.map((v) => [v, 0]),
    );
    for (let bits = 0; bits < 2 ** n; bits++) {
      const values = Array.from({ length: n }, (_, i) =>
        bits & (1 << i) ? truthy[i % truthy.length] : falsy[i % falsy.length],
      );
      const log: number[] = [];
      const output = evaluate(generated, [values, log]);

      const originalLog: number[] = [];
      expect(output).toBe(evaluate(code, [values, originalLog]));
      expect(log).toEqual(originalLog);

      const vector = Array.from({ length: n }, (_, i) =>
        log.includes(i) ? (values[i] ? "T" : "F") : "-",
      ).join("");
      expect(Object.keys(expected)).toContain(vector);
      expected[vector]++;
    }

    expect(Object.keys(initialCoverage.decisionMap!)).toEqual(["0"]);
    expect(initialCoverage.decisionMap![0].conditions).toHaveLength(n);
    // every listed vector is reachable, and recorded exactly when the original code evaluates it
    expect(Object.values(expected).every((count) => count > 0)).toBe(true);
    expect(hitVectors()).toEqual({ 0: expected });
  });

  it("skips decisions with too many test vectors", () => {
    const pairs = (k: number) =>
      Array.from({ length: k }, (_, i) => `(args[${2 * i}] || args[${2 * i + 1}])`).join(" && ");
    const args = Array.from({ length: 14 }, (_, i) => i % 3 === 0);

    // 2^7 + 2^7 - 1 test vectors
    const tooMany = run(`output = ${pairs(7)};`, args);
    expect(tooMany.initialCoverage.decisionMap).toEqual({});

    // 2^6 + 2^6 - 1 test vectors
    const enough = run(`output = ${pairs(6)};`, args);
    expect(enough.initialCoverage.decisionMap![0].vectors).toHaveLength(127);
  });

  it("treats `??` as a condition, not as a decision", () => {
    expect(run("output = args[0] ?? args[1];", [null, 1]).initialCoverage.decisionMap).toEqual({});

    const operand = run("output = args[0] && (args[1] ?? args[2]);", [1, null, 0]);
    expect(operand.initialCoverage.decisionMap![0].vectors).toEqual(["F-", "TF", "TT"]);
    expect(operand.vectors).toEqual({ 0: { TF: 1 } });

    const decision = run("output = (args[0] || args[1]) ?? args[2];", [0, 0, 1]);
    expect(decision.initialCoverage.decisionMap![0].vectors).toEqual(["FF", "FT", "T-"]);
    expect(decision.vectors).toEqual({ 0: { FF: 1 } });
  });

  it("covers nested decisions separately", () => {
    const { initialCoverage, vectors } = run(
      "const f = (x) => x; output = args[0] && f(args[1] || args[2]) && !(args[1] && args[2]);",
      [1, 0, 1],
    );
    expect(Object.keys(initialCoverage.decisionMap!)).toHaveLength(3);
    expect(vectors).toEqual({ 0: { TTT: 1 }, 1: { FT: 1 }, 2: { "F-": 1 } });
  });

  it("covers the right-hand side of logical assignments", () => {
    const { initialCoverage, vectors } = run(
      "let a = 0, b = 1; a ||= args[0] && args[1]; b &&= args[1] || args[0]; output = [a, b];",
      [1, 2],
    );
    expect(Object.keys(initialCoverage.decisionMap!)).toHaveLength(2);
    expect(vectors).toEqual({ 0: { TT: 1 }, 1: { "T-": 1 } });
  });

  it("keeps the conditions of ignored operands", () => {
    const { initialCoverage, vectors } = run(
      "output = args[0] && /* istanbul ignore next */ (args[1] || args[2]);",
      [1, 0, 1],
    );
    expect(initialCoverage.branchMap[0].locations).toHaveLength(1);
    expect(initialCoverage.decisionMap![0].conditions).toHaveLength(2);
    expect(vectors).toEqual({ 0: { TT: 1 } });
  });

  it("skips ignored decisions", () => {
    const { initialCoverage } = run(
      "/* istanbul ignore next */\noutput = args[0] && args[1];\n/* istanbul ignore next */\nfunction f(a, b) { return a || b; }",
      [1, 1],
    );
    expect(initialCoverage.decisionMap).toEqual({});
  });

  it("works together with reportLogic", () => {
    const code = "output = args[0] && args[1];";
    const { generated } = instrument(code, { reportLogic: true });
    resetCoverage();
    expect(evaluate(generated, [[], 0])).toBe(0);
    expect(fileCoverage().bT).toEqual({ 0: [0, 0] });
    expect(hitVectors()).toEqual({ 0: { TF: 1 } });
  });
});

describe("runtime semantics", () => {
  it("preserves values, side effects and short-circuiting", () => {
    const code = `
      const log = [];
      const v = (x) => (log.push(x), x);
      const port = v(args[0]) || v(8080);
      const obj = v(args[1]) && v({ ok: true });
      const none = v(null) && v("never");
      output = { port, obj, none, log };
    `;
    expect(run(code, ["", 1]).output).toEqual({
      port: 8080,
      obj: { ok: true },
      none: null,
      log: ["", 8080, 1, { ok: true }, null],
    });
  });

  it("preserves the names of functions and classes", () => {
    const code = `
      const f = args[0] || function () {};
      const a = args[0] || (() => {});
      const c = args[0] || class {};
      const named = args[0] || function named() {};
      const asyncFn = args[0] || (async () => {});
      output = [f.name, a.name, c.name, named.name, asyncFn.name];
    `;
    expect(run(code, [0]).output).toEqual(["", "", "", "named", ""]);
  });

  it("preserves this, arguments, new.target and super", () => {
    const code = `
      class Base { get value() { return 1; } }
      class Child extends Base {
        constructor() {
          super();
          this.target = new.target === Child && arguments.length === 0;
        }
        get value() { return super.value && this instanceof Child && new.target === undefined; }
      }
      const obj = { v: 1, m() { return this.v && this; } };
      function count() { return arguments.length > 1 && arguments[1]; }
      const child = new Child();
      output = [child.target, child.value, obj.m() === obj, count(1, "second")];
    `;
    expect(run(code).output).toEqual([true, true, true, "second"]);
  });

  it("keeps the directives first", () => {
    const code = `
      function strict() {
        "use strict"
        return this === undefined && (() => this === undefined || "x")();
      }
      const arrow = () => { "use strict"; return this === undefined || typeof this; };
      output = [strict(), arrow()];
    `;
    const { output, generated } = run(code);
    expect(output).toEqual([true, "object"]);
    expect(generated).toMatch(/"use strict";var cov_\w+_d0,cov_\w+_v;cov_\w+\(\)\.f\[0\]\+\+/);
  });

  it("does not mix the vectors of recursive calls", () => {
    const code = `
      function f(n) { return n > 0 && f(n - 1) || n === 0; }
      output = f(2);
    `;
    expect(run(code).vectors).toEqual({ 0: { "TT-": 2, "F-T": 1 } });
  });

  it("does not mix the vectors of concurrent async calls", async () => {
    const code = "output = async (a, b, p, c) => (a || b) && (await p) && c;";
    const { generated } = instrument(code);
    resetCoverage();
    const fn = evaluate(generated);

    const deferred = () => {
      let resolve!: (value: boolean) => void;
      const promise = new Promise<boolean>((r) => (resolve = r));
      return { promise, resolve };
    };
    const first = deferred();
    const second = deferred();
    // both calls are suspended in the middle of the decision
    const results = [fn(false, true, first.promise, true), fn(true, false, second.promise, false)];
    second.resolve(true);
    first.resolve(true);

    expect(await Promise.all(results)).toEqual([true, false]);
    expect(hitVectors()).toEqual({ 0: { FTTT: 1, "T-TF": 1 } });
  });

  it("does not mix the vectors of interleaved generators", () => {
    const code = "output = function* (a, b, c) { return (a || b) && (yield) && c; };";
    const { generated } = instrument(code);
    resetCoverage();
    const gen = evaluate(generated);

    const first = gen(false, true, 1);
    const second = gen(true, false, 0);
    first.next();
    second.next();
    expect(second.next(true)).toEqual({ value: 0, done: true });
    expect(first.next(false)).toEqual({ value: false, done: true });
    expect(hitVectors()).toEqual({ 0: { "FTF-": 1, "T-TF": 1 } });
  });

  it("supports decisions in default parameters", () => {
    // the parameters cannot see the variables declared in the function body. In strict
    // mode, using them would throw instead of silently creating global variables.
    const code = `
      function outer() {
        "use strict";
        function fn(a, b = a && a.x) { return b; }
        const arrow = (a, b = a || "fallback") => b;
        return [fn(null), fn({ x: 1 }), fn({ x: 1 }, "passed"), arrow(0), arrow("a")];
      }
      output = outer();
    `;
    const { output, vectors } = run(code);
    expect(output).toEqual([null, 1, "passed", "fallback", "a"]);
    // the passed parameter does not evaluate the default value
    expect(vectors).toEqual({ 0: { "F-": 1, TT: 1 }, 1: { FT: 1, "T-": 1 } });
    expect(Object.keys(globalThis).filter((key) => key.startsWith("cov_"))).toEqual([]);
  });

  it("supports decisions in classes", () => {
    const code = `
      const flag = args[0];
      class A {
        static s = flag && "static";
        x = flag || "field";
        static #p = 1;
        static { this.init = A.s && A.s.length > 0; }
        [flag && "computed"]() { return 1; }
        static has(o) { return #p in o && o !== null; }
      }
      output = [A.s, new A().x, A.init, typeof A.prototype.computed, A.has(A), A.has({})];
    `;
    const { output, initialCoverage } = run(code, ["v"]);
    expect(output).toEqual(["static", "v", true, "function", true, false]);
    expect(Object.keys(initialCoverage.decisionMap!)).toHaveLength(5);
  });

  it("supports decisions in control flow", () => {
    const code = `
      const log = [];
      let i = 0;
      if (args[0] && args[1]) log.push("if");
      while (i < 3 && args[0]) i++;
      do { i-- } while (i > 0 || !args[0]);
      for (let j = 0; j < 2 && args[1]; j++) log.push(j);
      switch (args[0] || args[1]) { case 1: log.push("case"); }
      log.push(args[0] && args[1] ? "then" : "else");
      log.push(\`\${args[0] || "none"}\`, ...[args[1] && "spread"], args?.[0] && "chain");
      output = log;
    `;
    expect(run(code, [1, 1]).output).toEqual(["if", 0, 1, "case", "then", "1", "spread", "chain"]);
  });

  it("does not break automatic semicolon insertion", () => {
    const code = "output = 0\nargs[0] && (output = 1)\n;(args[0] || args[1]).toString()\noutput";
    const { output, generated } = run(code, [1, 0]);
    expect(output).toBe(1);
    // only the outermost wrapper of the expression statement is guarded with ";"
    expect(generated).toMatch(
      /\ncov_\w+\(\)\.s\[1\]\+\+;;\(cov_\w+\(\)\.b\[0\]\[0\]\+\+, \(cov_\w+_v=args\[0\]/,
    );
  });

  it("keeps line numbers of the original code", () => {
    const code = "output = (args[0] ||\n  args[1]) &&\n  (() =>\n    args[2] && args[3])();\n";
    const { generated } = run(code, [1, 1, 1, 1]);
    expect(generated.split("\n")).toHaveLength(code.split("\n").length);
  });
});

describe("syntax", () => {
  it.each([
    ["export default", "export default a && b;"],
    ["top-level await", "if (a && await b) {}\nexport const c = (await d) || e;"],
    ["import.meta", "export const url = import.meta.url && import.meta.dirname || '';"],
    ["arrow default parameter", "export const f = (a, b = a && 1) => a || b;"],
    ["hashbang and directive", '#!/usr/bin/env node\n"use strict"\nexport const x = a && b;'],
    ["class expression", "export const C = class { static [a || b] = c && d; static { e || f } };"],
    ["async generator", "export async function* g() { while ((yield) && (await a || b)) {} }"],
    ["private in", "class A { #x; static is(o) { return #x in o && #x in o.next; } }"],
    ["jsx", "export const el = <div a={a && b}>{a && <span />}{b || (c && <i />)}</div>;"],
    [
      "object getter and method",
      "export const o = { get a() { return b && c; }, m() { return d || e; } };",
    ],
    ["labeled statements", "outer: for (;;) { if (a && b) break outer; }"],
    ["nested functions", "function f(a) { return function (b) { return (c) => a && b || c; }; }"],
  ])("generates valid code for %s", (_, code) => {
    expectValidSyntax(code, true);
    const { generated, initialCoverage } = instrument(code, { esModules: true });
    expectValidSyntax(generated, true);
    expect(Object.keys(initialCoverage.decisionMap!).length).toBeGreaterThan(0);
  });

  it("generates valid code for scripts", () => {
    const code = "var a = b && c;\nwith (o) { d || e }\nfunction f() { return arguments[0] && g; }";
    const { generated } = instrument(code, { esModules: false });
    expectValidSyntax(generated, false);
  });

  it("produces a source map", () => {
    const instrumenter = new Instrumenter({ mcdc: true, esModules: true, produceSourceMap: true });
    const generated = instrumenter.instrumentSync("export const x = a && (b || c);", FILE);
    expectValidSyntax(generated, true);
    expect(instrumenter.lastSourceMap()).toMatchObject({ sources: [FILE] });
  });
});
