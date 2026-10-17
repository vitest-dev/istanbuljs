import type { ESTree } from "rolldown/utils";

import { MAGIC_KEY, MAGIC_VALUE } from "./constants";
import { parse } from "./parse";
import type { SourceCoverageData } from "./source-coverage";

type Node = ESTree.Node;

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

const NOT_CONFIDENT = Symbol("not confident");

function getAst(code: string | ESTree.Program): ESTree.Program {
  if (typeof code === "object" && typeof code.type === "string") {
    // Assume code is already an ESTree AST.
    return code;
  }

  if (typeof code !== "string") {
    throw new Error("Code must be a string");
  }

  // Parse as leniently as possible
  return parse(code, "instrumented.js", { esModules: true, autoWrap: true, lenient: true }).program;
}

// statically evaluates literal expressions
function evaluate(node: Node | null | undefined): unknown {
  if (!node) {
    throw NOT_CONFIDENT;
  }
  switch (node.type) {
    case "ParenthesizedExpression":
      return evaluate(node.expression);
    case "Literal":
      if ("regex" in node && node.regex) {
        throw NOT_CONFIDENT;
      }
      return node.value;
    case "Identifier":
      if (node.name === "undefined") {
        return undefined;
      }
      throw NOT_CONFIDENT;
    case "TemplateLiteral":
      if (node.expressions.length > 0) {
        throw NOT_CONFIDENT;
      }
      return node.quasis[0].value.cooked;
    case "UnaryExpression": {
      const argument = evaluate(node.argument) as any;
      switch (node.operator) {
        case "-":
          return -argument;
        case "+":
          return +argument;
        case "!":
          return !argument;
        case "void":
          return undefined;
      }
      throw NOT_CONFIDENT;
    }
    case "ArrayExpression":
      return node.elements.map((element) => {
        if (!element || element.type === "SpreadElement") {
          throw NOT_CONFIDENT;
        }
        return evaluate(element);
      });
    case "ObjectExpression": {
      const result: Record<string, unknown> = {};
      for (const property of node.properties) {
        if (property.type !== "Property" || property.computed || property.kind !== "init") {
          throw NOT_CONFIDENT;
        }
        const { key } = property;
        const name =
          key.type === "Identifier"
            ? key.name
            : key.type === "Literal"
              ? String(key.value)
              : evaluate(key as Node);
        result[name as string] = evaluate(property.value);
      }
      return result;
    }
  }
  throw NOT_CONFIDENT;
}

function tryEvaluate(node: Node | null | undefined): { confident: boolean; value?: unknown } {
  try {
    return { confident: true, value: evaluate(node) };
  } catch (error) {
    if (error === NOT_CONFIDENT) {
      return { confident: false };
    }
    throw error;
  }
}

function isFunction(node: Node): node is ESTree.Function | ESTree.ArrowFunctionExpression {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

// finds the function (or program) that contains the coverage schema magic value
function findCoverageScope(ast: ESTree.Program): Node | null {
  const stack: Node[] = [ast];

  const walk = (node: Node): boolean => {
    if (
      node.type === "Property" &&
      !node.computed &&
      node.key.type === "Identifier" &&
      node.key.name === MAGIC_KEY
    ) {
      const magicValue = tryEvaluate(node.value);
      if (magicValue.confident && magicValue.value === MAGIC_VALUE) {
        return true;
      }
    }
    const isScope = isFunction(node);
    if (isScope) {
      stack.push(node);
    }
    for (const key in node) {
      const child = (node as any)[key];
      if (key === "parent" || !child || typeof child !== "object") {
        continue;
      }
      const children = Array.isArray(child) ? child : [child];
      for (const item of children) {
        if (item && typeof item.type === "string" && walk(item)) {
          return true;
        }
      }
    }
    if (isScope) {
      stack.pop();
    }
    return false;
  };

  return walk(ast) ? stack[stack.length - 1] : null;
}

// the initializers of variables declared directly in the scope
function getDeclarations(scope: Node): Map<string, Node | null> {
  const declarations = new Map<string, Node | null>();
  const body =
    scope.type === "Program"
      ? scope.body
      : isFunction(scope) && scope.body && scope.body.type === "BlockStatement"
        ? scope.body.body
        : [];
  for (const statement of body) {
    if (statement.type !== "VariableDeclaration") {
      continue;
    }
    for (const declarator of statement.declarations) {
      if (declarator.id.type === "Identifier" && !declarations.has(declarator.id.name)) {
        declarations.set(declarator.id.name, declarator.init);
      }
    }
  }
  return declarations;
}

export default function readInitialCoverage(code: string | ESTree.Program): InitialCoverage | null {
  const ast = getAst(code);

  const covScope = findCoverageScope(ast);
  if (!covScope) {
    return null;
  }

  const declarations = getDeclarations(covScope);
  const result: Record<string, any> = {};

  for (const key of ["path", "hash", "gcv", "coverageData"]) {
    if (!declarations.has(key)) {
      return null;
    }
    const value = tryEvaluate(declarations.get(key));
    if (!value.confident) {
      return null;
    }
    result[key] = value.value;
  }

  delete result.coverageData[MAGIC_KEY];
  delete result.coverageData.hash;

  return result as InitialCoverage;
}
