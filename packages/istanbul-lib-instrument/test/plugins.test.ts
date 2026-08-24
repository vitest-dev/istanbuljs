import type { ParserPlugin } from "@babel/parser";
import { assert, describe, it, expect } from "vitest";

import Instrumenter from "../src/instrumenter";

const codeNeedDecoratorPlugin = `
  @decorator
  class MyClass {}
`;

const generateCode = (code: string, parserPlugins?: ParserPlugin[]) => {
  const opts = {
    esModules: true,
    produceSourceMap: true,
    parserPlugins,
  };
  const instrumenter = new Instrumenter(opts);
  return instrumenter.instrumentSync(code, import.meta.filename);
};

describe("plugins", () => {
  describe("when the code has a decorator", () => {
    describe("without decorator plugin", () => {
      it("should fail", () => {
        expect(() => generateCode(codeNeedDecoratorPlugin)).toThrow();
      });
    });

    describe("with decorator plugin", () => {
      it("should success", () => {
        const generated = generateCode(codeNeedDecoratorPlugin, ["decorators"]);
        assert(generated);
        expect(generated).toBeTypeOf("string");
      });
    });
  });
});
