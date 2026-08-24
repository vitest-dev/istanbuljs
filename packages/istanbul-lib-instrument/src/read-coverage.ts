import { parseSync, traverse } from "@babel/core";
import type { NodePath, types as t } from "@babel/core";

type Scope = NodePath["scope"];
import { defaults } from "@istanbuljs/schema";

import { MAGIC_KEY, MAGIC_VALUE } from "./constants";
import type { SourceCoverageData } from "./source-coverage";

/** the initial coverage state extracted from already-instrumented code */
export interface InitialCoverage {
  /** the file path the coverage is tracked against */
  path: string;
  /** hash of the coverage data */
  hash: string;
  /** the global coverage variable name */
  gcv: string;
  /** the (empty) coverage data embedded in the instrumented file */
  coverageData: SourceCoverageData;
}

function getAst(code: string | t.Node): t.Node {
  if (typeof code === "object" && typeof code.type === "string") {
    // Assume code is already a babel ast.
    return code;
  }

  if (typeof code !== "string") {
    throw new Error("Code must be a string");
  }

  // Parse as leniently as possible
  return parseSync(code, {
    babelrc: false,
    configFile: false,
    parserOpts: {
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      sourceType: "unambiguous",
      plugins: defaults.instrumenter.parserPlugins,
    },
  }) as t.Node;
}

export default function readInitialCoverage(code: string | t.Node): InitialCoverage | null {
  const ast = getAst(code);

  let covScope: Scope | undefined;
  traverse(ast, {
    ObjectProperty(path: NodePath<t.ObjectProperty>) {
      const { node } = path;
      if (
        !node.computed &&
        path.get("key").isIdentifier() &&
        (node.key as t.Identifier).name === MAGIC_KEY
      ) {
        const magicValue = path.get("value").evaluate();
        if (!magicValue.confident || magicValue.value !== MAGIC_VALUE) {
          return;
        }
        covScope = path.scope.getFunctionParent() || path.scope.getProgramParent();
        path.stop();
      }
    },
  });

  if (!covScope) {
    return null;
  }

  const result: Record<string, any> = {};

  for (const key of ["path", "hash", "gcv", "coverageData"]) {
    const binding = covScope.getOwnBinding(key);
    if (!binding) {
      return null;
    }
    const valuePath = binding.path.get("init") as NodePath;
    const value = valuePath.evaluate();
    if (!value.confident) {
      return null;
    }
    result[key] = value.value;
  }

  delete result.coverageData[MAGIC_KEY];
  delete result.coverageData.hash;

  return result as InitialCoverage;
}
