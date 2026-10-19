import { assert, describe, it, expect } from "vitest";

import Instrumenter from "../src/instrumenter";

const generateCode = (code: string) => {
  const opts = {
    esModules: true,
    produceSourceMap: true,
  };
  const instrumenter = new Instrumenter(opts);
  return instrumenter.instrumentSync(code, import.meta.filename);
};

describe("syntax", () => {
  it("parses decorators", () => {
    const generated = generateCode(`
      @decorator
      class MyClass {}
    `);
    assert(generated);
    expect(generated).toBeTypeOf("string");
  });

  it("preserves import attributes", () => {
    const generated = generateCode(`
      import foo from 'bar' with { type: 'json' };
    `);
    expect(generated).toContain("import foo from 'bar' with { type: 'json' };");
  });

  it("preserves the original code", () => {
    const code = "const a = 1;\n\nfunction b(  ) { return a }\n";
    const generated = generateCode(code);
    expect(generated).toMatch(/const a = \(cov_\w+\(\)\.s\[0\]\+\+, 1\);\n\n/);
    expect(generated).toMatch(
      /\nfunction b\( {2}\) \{cov_\w+\(\)\.f\[0\]\+\+; cov_\w+\(\)\.s\[1\]\+\+;return a \}\n$/,
    );
  });

  it("keeps line numbers of the original code", () => {
    const code = '"use strict"\nconst a = 1;\nif (a) b()\nexport const c = () => a;';
    const generated = generateCode(code);
    expect(generated.split("\n")).toHaveLength(code.split("\n").length);
    expect(generated.split("\n")[0]).toMatch(/^"use strict";function cov_/);
  });

  it("keeps hashbang as the first line", () => {
    const generated = generateCode("#!/usr/bin/env node\nconsole.log(1)");
    expect(generated).toMatch(/^#!\/usr\/bin\/env node\nfunction cov_/);
  });

  it("does not break code relying on automatic semicolon insertion", () => {
    const instrumenter = new Instrumenter({ esModules: false, ignoreLines: false });
    const generated = instrumenter.instrumentSync("a = b\n;(c || d)\nx => x\n", "asi.js");
    expect(generated).toMatch(/\n;cov_\w+\(\)\.s\[1\]\+\+;;?\(\(cov_\w+\(\)\.b\[0\]\[0\]\+\+, c\)/);
    expect(() => new Function(generated)).not.toThrow();
  });
});
