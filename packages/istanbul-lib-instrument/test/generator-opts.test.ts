import type { ParserPlugin } from "@babel/parser";
import { assert, describe, it } from "vitest";

import Instrumenter from "../src/instrumenter";

const codeWithImportAttribute = `
  import foo from 'bar' with { type: 'json' };
`;

const generateCode = (
  code: string,
  parserPlugins: ParserPlugin[],
  generatorOpts?: Record<string, unknown>,
) => {
  const opts = {
    esModules: true,
    produceSourceMap: true,
    parserPlugins,
    generatorOpts,
  };
  const instrumenter = new Instrumenter(opts);
  return instrumenter.instrumentSync(code, import.meta.filename);
};

describe("generatorOpts", () => {
  it("preserves import attributes", () => {
    const generated = generateCode(codeWithImportAttribute, []);
    assert(generated);
    assert(typeof generated === "string");
    assert(generated.includes("with{type:'json'}"));
  });

  it("passes options through to the generator", () => {
    const code = "const a = 1;";
    const withDefaults = generateCode(code, []);
    assert(withDefaults.includes("const a=("));

    const withoutCompact = generateCode(code, [], { compact: false });
    assert(withoutCompact.includes("const a = ("));
  });
});
