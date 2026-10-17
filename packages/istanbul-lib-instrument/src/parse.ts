/*
 * For Vitest users rolldown will be a transitive dependency of Vite 8.
 * If we wanted to drop rolldown dep, we could do something similar to what ast-v8-to-istanbul does
 * with its `options.ast` option. That would require js-tokens for comment parsing.
 */
import { parseSync } from "rolldown/utils";
import type { ESTree } from "rolldown/utils";

import type { Comment } from "./visitor";

const RETURN_OUTSIDE_FUNCTION_RE = /'return' statement can only be used within a function body/;

/** options accepted by {@link parse} */
export interface ParseOptions {
  /** parse the code as ES module */
  esModules: boolean;
  /** allow `return` statements outside of functions */
  autoWrap: boolean;
  /** do not throw on syntax errors */
  lenient?: boolean;
}

/** the parsed program and its comments */
export interface ParsedProgram {
  program: ESTree.Program;
  comments: Comment[];
}

/**
 * Parses JavaScript (and JSX) code with OXC.
 * Throws a `SyntaxError` for invalid code, unless `lenient` is set.
 */
export function parse(code: string, filename: string, opts: ParseOptions): ParsedProgram {
  const result = parseSync(filename, code, {
    lang: "jsx",
    sourceType: opts.esModules ? "module" : "script",
  });

  if (!opts.lenient) {
    const errors = result.errors.filter(
      (e) =>
        e.severity === "Error" && !(opts.autoWrap && RETURN_OUTSIDE_FUNCTION_RE.test(e.message)),
    );
    if (errors.length > 0) {
      const [error] = errors;
      throw new SyntaxError(
        error.message + (error.codeframe ? "\n" + error.codeframe : "") + `\nFile: ${filename}`,
      );
    }
  }

  return { program: result.program, comments: result.comments };
}
