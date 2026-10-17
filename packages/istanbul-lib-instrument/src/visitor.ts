import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { defaults } from "@istanbuljs/schema";
import {
  originalPositionFor,
  TraceMap,
  GREATEST_LOWER_BOUND,
  LEAST_UPPER_BOUND,
  sourceContentFor,
} from "@jridgewell/trace-mapping";
import type { Location, Range } from "@vitest/istanbul-lib-coverage";
import type MagicString from "magic-string";
import type { ESTree } from "rolldown/utils";

import { SHA, MAGIC_KEY, MAGIC_VALUE } from "./constants";
import { getIgnoredLines } from "./ignored-lines";
import { SourceCoverage } from "./source-coverage";
import type { InputSourceMap, SourceCoverageData } from "./source-coverage";

// pattern for istanbul to ignore a section
const COMMENT_RE = /^\s*istanbul\s+ignore\s+(if|else|next)(?=\W|$)/;
// pattern for istanbul to ignore the whole file
const COMMENT_FILE_RE = /^\s*istanbul\s+ignore\s+(file)(?=\W|$)/;
// source map URL pattern
const SOURCE_MAP_RE = /[#@]\s*sourceMappingURL=(.*)\s*$/m;
// characters that may appear between a hint comment and the node it applies to
const HINT_GAP_RE = /[\s(]/;
// line terminators, as counted by Babel's `loc`
const LINE_TERMINATOR_RE = /\r\n?|[\n\u2028\u2029]/g;
const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;
const INDEX_RE = /^(?:0|[1-9]\d*)$/;

/** options accepted by {@link instrumentProgram} */
export interface VisitorOptions {
  /** the global coverage variable name (default `__coverage__`) */
  coverageVariable: string;
  /** report boolean value of logical expressions (default `false`) */
  reportLogic: boolean;
  /** the global coverage variable scope (default `this`) */
  coverageGlobalScope: string;
  /** use an evaluated function to find coverageGlobalScope (default `true`) */
  coverageGlobalScopeFunc: boolean;
  /** names of methods to ignore by default on classes (default `[]`) */
  ignoreClassMethods: string[];
  /** enable ignore hints for lines (start, stop) (default `false`) */
  ignoreLines: boolean;
  /** the input source map, mapping the uninstrumented code back to the original code */
  inputSourceMap?: InputSourceMap;
}

/** the result returned by {@link instrumentProgram} */
export interface VisitorExitResult {
  /** the file coverage object created for the source file */
  fileCoverage: SourceCoverageData;
  /** any source mapping URL found when processing the file */
  sourceMappingURL: string | null;
}

/** a comment, as returned by the parser */
export interface Comment {
  type: "Line" | "Block";
  value: string;
  start: number;
  end: number;
}

/** the coverage data embedded into the instrumented file */
interface InstrumentedCoverageData extends SourceCoverageData {
  _coverageSchema?: string;
  hash?: string;
}

type Node = ESTree.Node;

/** the parent of a node and the property of the parent the node is stored in */
interface ParentInfo {
  parent: Node | null;
  key: string;
}

/** the `ReturnStatement` that wraps the expression body of an arrow function */
interface SyntheticReturn {
  type: "ReturnStatement";
  start: number;
  end: number;
}

type VisitNode = Node | SyntheticReturn;
type VisitFunction = (this: VisitState, node: any) => void;

// generate a variable name from hashing the supplied file path
function genVar(filename: string): string {
  const hash = createHash(SHA);
  hash.update(filename);
  return "cov_" + parseInt(hash.digest("hex").substr(0, 12), 16).toString(36);
}

// skip the non-standard `ParenthesizedExpression` nodes, Babel's AST has none of them
function unwrap(node: Node): Node {
  while (node.type === "ParenthesizedExpression") {
    node = node.expression;
  }
  return node;
}

function isDirective(node: Node): boolean {
  return node.type === "ExpressionStatement" && typeof node.directive === "string";
}

// object and class methods are functions themselves, their `value` is not visited as a function
function isMethod(node: Node): node is ESTree.MethodDefinition | ESTree.ObjectProperty {
  return (
    node.type === "MethodDefinition" ||
    (node.type === "Property" && (node.method || node.kind === "get" || node.kind === "set"))
  );
}

// statements that are wrapped in a block by the instrumenter when they are not one already
const BLOCK_BODY_KEYS: Record<string, string[]> = {
  IfStatement: ["consequent", "alternate"],
  ForStatement: ["body"],
  ForInStatement: ["body"],
  ForOfStatement: ["body"],
  WhileStatement: ["body"],
  DoWhileStatement: ["body"],
  WithStatement: ["body"],
};

const STATEMENT_TYPES = new Set([
  "BlockStatement",
  "BreakStatement",
  "ContinueStatement",
  "DebuggerStatement",
  "DoWhileStatement",
  "EmptyStatement",
  "ExpressionStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "IfStatement",
  "LabeledStatement",
  "ReturnStatement",
  "SwitchStatement",
  "ThrowStatement",
  "TryStatement",
  "WhileStatement",
  "WithStatement",
]);

// converts byte offsets to Babel compatible line (1-based) and column (0-based) positions
class Locator {
  lineStarts: number[];

  constructor(code: string) {
    this.lineStarts = [0];
    for (const match of code.matchAll(LINE_TERMINATOR_RE)) {
      this.lineStarts.push(match.index + match[0].length);
    }
  }

  position(offset: number): Location {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.lineStarts[mid] <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return { line: low + 1, column: offset - this.lineStarts[low] };
  }

  range(node: { start: number; end: number }): Range {
    return { start: this.position(node.start), end: this.position(node.end) };
  }
}

// VisitState holds the state of the visitor, provides helper functions
// and is the `this` for the individual coverage visitors.
class VisitState {
  code: string;
  s: MagicString;
  locator: Locator;
  varName: string;
  nextIgnore: VisitNode | null;
  cov: SourceCoverage;
  traceMap?: TraceMap;
  ignoreClassMethods: string[];
  ignoredLines: Map<string | null, Set<number>>;
  reportLogic: boolean;
  commentsByEnd: Map<number, Comment>;
  parents: WeakMap<Node, ParentInfo>;
  skipAll: WeakSet<Node>;
  switchBranches: WeakMap<Node, number>;
  convertedArrows: WeakSet<Node>;
  expressionStatementStarts: Set<number>;

  constructor(
    code: string,
    s: MagicString,
    comments: Comment[],
    sourceFilePath: string,
    inputSourceMap?: InputSourceMap,
    ignoreClassMethods: string[] = [],
    reportLogic = false,
    ignoreLines = false,
  ) {
    this.code = code;
    this.s = s;
    this.locator = new Locator(code);
    this.varName = genVar(sourceFilePath);
    this.nextIgnore = null;
    this.cov = new SourceCoverage(sourceFilePath);

    if (typeof inputSourceMap !== "undefined") {
      this.cov.inputSourceMap(inputSourceMap);

      if (ignoreLines) {
        this.traceMap = new TraceMap(inputSourceMap);
      }
    }
    this.ignoreClassMethods = ignoreClassMethods;
    this.ignoredLines = new Map();
    this.reportLogic = reportLogic;
    this.commentsByEnd = new Map(comments.map((c) => [c.end, c]));
    this.parents = new WeakMap();
    this.skipAll = new WeakSet();
    this.switchBranches = new WeakMap();
    this.convertedArrows = new WeakSet();
    this.expressionStatementStarts = new Set();
  }

  loc(node: { start: number; end: number }): Range {
    return this.locator.range(node);
  }

  // should we ignore the node? Yes, if specifically ignoring
  shouldIgnore(node: VisitNode): boolean {
    if (this.nextIgnore) {
      return true;
    }

    if (!this.traceMap) {
      return false;
    }

    // Anything that starts between the line ignore hints is ignored
    const start = originalPositionTryBoth(this.traceMap, this.locator.position(node.start));

    // Generated code
    if (start.line == null) {
      return false;
    }

    const filename = start.source;
    let ignoredLines = this.ignoredLines.get(filename);

    if (!ignoredLines) {
      const sources = sourceContentFor(this.traceMap, filename as string);
      ignoredLines = getIgnoredLines(sources || tryReadFileSync(filename as string));

      this.ignoredLines.set(filename, ignoredLines);
    }

    if (ignoredLines.has(start.line)) {
      return true;
    }

    return false;
  }

  // extract the ignore comment hint (next|if|else) or null from the
  // comments directly preceding the node
  hintFor(node: Node | SyntheticReturn): string | null {
    let hint: string | null = null;
    // comments inside the parentheses apply to the expression too
    let pos = node.type === "ParenthesizedExpression" ? unwrap(node).start : node.start;
    for (;;) {
      while (pos > 0 && HINT_GAP_RE.test(this.code[pos - 1])) {
        pos--;
      }
      const comment = this.commentsByEnd.get(pos);
      if (!comment) {
        break;
      }
      const groups = comment.value.trim().match(COMMENT_RE);
      // the comment closest to the node is visited last, like in Babel's `leadingComments`
      if (groups && hint === null) {
        hint = groups[1];
      }
      pos = comment.start;
    }
    return hint;
  }

  // all the generic stuff that needs to be done on enter for every node
  onEnter(node: VisitNode): void {
    // if already ignoring, nothing more to do
    if (this.nextIgnore !== null) {
      return;
    }
    // the synthetic return statement of an arrow function has no comments
    if (node.type === "ReturnStatement" && !("argument" in node)) {
      return;
    }
    const n = node as Node;
    // check hint to see if ignore should be turned on
    const hint = this.hintFor(n);
    if (hint === "next") {
      this.nextIgnore = n;
      return;
    }
    // else check custom node attribute set by a prior visitor
    if (this.skipAll.has(n)) {
      this.nextIgnore = n;
    }

    // else check for ignored class methods
    if (
      n.type === "FunctionExpression" &&
      this.ignoreClassMethods.some((name) => n.id && name === n.id.name)
    ) {
      this.nextIgnore = n;
      return;
    }
    if (
      n.type === "MethodDefinition" &&
      this.ignoreClassMethods.some((name) => name === (n.key as ESTree.IdentifierName).name)
    ) {
      this.nextIgnore = n;
      return;
    }
  }

  // all the generic stuff on exit of a node, including resetting ignores
  onExit(node: VisitNode): void {
    // restore ignore status, if needed
    if (node === this.nextIgnore) {
      this.nextIgnore = null;
    }
  }

  increase(type: string, id: number, index: number | null): string {
    return `${this.varName}().${type}[${id}]` + (index !== null ? `[${index}]` : "") + "++";
  }

  // where statements can be inserted before `node`. Labels must stay attached to their
  // statement, so counters are inserted before them.
  statementStart(node: Node): number {
    let info = this.parents.get(node);
    while (info && info.parent && info.parent.type === "LabeledStatement") {
      node = info.parent;
      info = this.parents.get(node);
    }
    return node.start;
  }

  // where statements can be inserted at the start of a block, after possible directives
  bodyStart(body: ESTree.BlockStatement | ESTree.FunctionBody | ESTree.Program): number {
    let lastDirective: Node | null = null;
    for (const statement of body.body) {
      if (!isDirective(statement)) {
        break;
      }
      lastDirective = statement;
    }
    if (!lastDirective) {
      return body.type === "Program" ? programStart(this.code, body) : body.start + 1;
    }
    if (this.code[lastDirective.end - 1] !== ";") {
      this.s.appendLeft(lastDirective.end, ";");
    }
    return lastDirective.end;
  }

  // a block the instrumenter wraps around `node`, see `blockBody`
  isInBlock(node: Node): boolean {
    const info = this.parents.get(node);
    if (!info || !info.parent) {
      return false;
    }
    const { parent, key } = info;
    return (
      parent.type === "Program" ||
      parent.type === "BlockStatement" ||
      (BLOCK_BODY_KEYS[parent.type] || []).includes(key)
    );
  }

  insertStatement(pos: number, increment: string): void {
    this.s.appendRight(pos, increment + ";");
  }

  // wraps `node` in a sequence expression, e.g. `(cov().s[0]++, node)`
  wrapExpression(node: Node, prefix: string, suffix = ")"): void {
    // an expression statement must not start with "(" after an unterminated statement
    if (this.expressionStatementStarts.has(node.start)) {
      prefix = ";" + prefix;
    }
    this.s.appendRight(node.start, prefix);
    this.s.prependLeft(node.end, suffix);
  }

  insertCounter(node: Node, increment: string): void {
    const inner = unwrap(node);
    if (inner.type === "BlockStatement") {
      this.insertStatement(this.bodyStart(inner), increment);
    } else if (STATEMENT_TYPES.has(inner.type)) {
      this.insertStatement(this.statementStart(inner), increment);
    } else {
      this.wrapExpression(node, `(${increment}, `);
    }
  }

  // for these expressions the statement counter needs to be hoisted, so
  // function name inference can be preserved
  counterNeedsHoisting(node: Node): boolean {
    return (
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression" ||
      node.type === "ClassExpression"
    );
  }

  insertDeclaratorCounter(declarator: ESTree.VariableDeclarator, increment: string): void {
    const init = declarator.init!;
    if (this.counterNeedsHoisting(unwrap(init))) {
      // make an attempt to hoist the statement counter, so that
      // function names are maintained.
      const declaration = this.parents.get(declarator)!.parent!;
      const container = this.parents.get(declaration)!.parent;
      if (container && container.type === "ExportNamedDeclaration") {
        return this.insertStatement(container.start, increment);
      }
      if (this.isInBlock(declaration)) {
        return this.insertStatement(declaration.start, increment);
      }
    }
    this.wrapExpression(init, `(${increment}, `);
  }

  insertStatementCounter(node: Node): void {
    const index = this.cov.newStatement(this.loc(unwrap(node)));
    this.insertCounter(node, this.increase("s", index, null));
  }

  insertFunctionCounter(node: Node): void {
    let fn: ESTree.Function | ESTree.ArrowFunctionExpression;
    let dloc: Range | null = null;
    switch (node.type) {
      case "FunctionDeclaration":
      case "FunctionExpression":
        fn = node;
        if (node.id) {
          dloc = this.loc(node.id);
        }
        break;
      case "ArrowFunctionExpression":
        fn = node;
        break;
      default:
        fn = (node as ESTree.MethodDefinition).value;
    }
    if (!dloc) {
      const start = this.locator.position(node.start);
      dloc = { start, end: { line: start.line, column: start.column + 1 } };
    }

    const body = fn.body;
    /* istanbul ignore if: not expected */
    if (!body) {
      console.error("Unable to process function body node type:", node.type);
      return;
    }
    const isConverted = this.convertedArrows.has(node);
    const bodyLoc = this.loc(isConverted ? unwrap(body as Node) : body);
    const name = fn.id ? fn.id.name : undefined;
    const index = this.cov.newFunction(name, dloc, bodyLoc);
    const increment = this.increase("f", index, null);

    this.insertStatement(
      isConverted ? body.start : this.bodyStart(body as ESTree.FunctionBody),
      increment,
    );
  }

  getBranchIncrement(branchName: number, loc: Range | undefined): string {
    const index = this.cov.addBranchPath(branchName, loc);
    return this.increase("b", branchName, index);
  }

  // wraps the logical expression leaf, incrementing the branch counter and,
  // with `reportLogic`, the truthy counter when the leaf evaluates truthy.
  insertLogicalCounter(leaf: Node, branchName: number): void {
    const index = this.cov.addBranchPath(branchName, this.loc(unwrap(leaf)));
    const increment = this.increase("b", branchName, index);

    if (!this.reportLogic) {
      return this.wrapExpression(leaf, `(${increment}, `);
    }

    const temp = `${this.varName}().${this.varName}_temp`;
    const isTruthy =
      `${temp} && (!Array.isArray(${temp}) || ${temp}.length) && ` +
      `(Object.getPrototypeOf(${temp}) !== Object.prototype || Object.values(${temp}).length)`;
    this.wrapExpression(
      leaf,
      `(${increment}, (${temp} = `,
      `, (${isTruthy} ? ${this.increase("bT", branchName, index)} : null), ${temp}))`,
    );
  }

  findLeaves(node: Node, accumulator: Node[]): void {
    const inner = unwrap(node);
    if (inner.type === "LogicalExpression") {
      const hint = this.hintFor(node);
      if (hint !== "next") {
        this.findLeaves(inner.left, accumulator);
        this.findLeaves(inner.right, accumulator);
      }
    } else {
      accumulator.push(node);
    }
  }

  // visitors to run for the node, null when the node is not instrumented
  visitorsFor(node: Node, info: ParentInfo): VisitFunction[] | null {
    switch (node.type) {
      case "FunctionExpression":
        if (info.key === "value" && info.parent && isMethod(info.parent)) {
          return null;
        }
        return codeVisitor[node.type];
      case "ExpressionStatement":
        return isDirective(node) ? null : codeVisitor[node.type];
      case "MethodDefinition":
        // private methods are not instrumented as functions
        return node.key.type === "PrivateIdentifier" ? null : codeVisitor[node.type];
      case "Property":
        return isMethod(node) ? codeVisitor[node.type] : null;
      default:
        return codeVisitor[node.type] || null;
    }
  }

  visit(node: Node, parent: Node | null, key: string): void {
    if (node.type === "ParenthesizedExpression") {
      return this.visit(node.expression, parent, key);
    }
    const info = { parent, key };
    this.parents.set(node, info);

    const visitors = this.visitorsFor(node, info);
    if (visitors) {
      this.onEnter(node);
      if (!this.shouldIgnore(node)) {
        for (const visitor of visitors) {
          visitor.call(this, node);
        }
      }
    }

    for (const childKey in node) {
      const child = (node as any)[childKey];
      if (childKey === "parent" || !child || typeof child !== "object") {
        continue;
      }
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item.type === "string") {
            this.visit(item, node, childKey);
          }
        }
      } else if (typeof child.type === "string") {
        if (childKey === "body" && this.convertedArrows.has(node)) {
          this.visitArrowBody(child, node);
        } else {
          this.visit(child, node, childKey);
        }
      }
    }

    if (visitors) {
      this.onExit(node);
    }
  }

  // the expression body of an arrow function is wrapped in a block with a return statement
  visitArrowBody(body: Node, arrow: Node): void {
    const inner = unwrap(body);
    const returnStatement: SyntheticReturn = {
      type: "ReturnStatement",
      start: inner.start,
      end: inner.end,
    };
    this.onEnter(returnStatement);
    if (!this.shouldIgnore(returnStatement)) {
      const index = this.cov.newStatement(this.loc(returnStatement));
      this.insertStatement(body.start, this.increase("s", index, null));
    }
    this.s.appendRight(body.start, "return ");
    this.visit(body, arrow, "body");
    this.onExit(returnStatement);
  }
}

function coverStatement(this: VisitState, node: Node) {
  this.insertStatementCounter(node);
}

function coverExpressionStatement(this: VisitState, node: ESTree.ExpressionStatement) {
  this.expressionStatementStarts.add(node.start);
  this.insertStatementCounter(node);
}

/* istanbul ignore next: no node.js support */
function coverAssignmentPattern(this: VisitState, node: ESTree.AssignmentPattern) {
  const b = this.cov.newBranch("default-arg", this.loc(node));
  const increment = this.getBranchIncrement(b, this.loc(unwrap(node.right)));
  this.insertCounter(node.right, increment);
}

function coverFunction(this: VisitState, node: Node) {
  this.insertFunctionCounter(node);
}

function coverVariableDeclarator(this: VisitState, node: ESTree.VariableDeclarator) {
  if (!node.init) {
    return;
  }
  const index = this.cov.newStatement(this.loc(unwrap(node.init)));
  this.insertDeclaratorCounter(node, this.increase("s", index, null));
}

function coverClassPropDeclarator(this: VisitState, node: ESTree.PropertyDefinition) {
  if (!node.value) {
    return;
  }
  this.insertStatementCounter(node.value);
}

// wraps the body of a statement in a block, so that counters can be inserted into it
function blockBody(this: VisitState, node: Node) {
  for (const key of BLOCK_BODY_KEYS[node.type]) {
    const body = (node as any)[key] as Node | null;
    if (body && body.type !== "BlockStatement") {
      this.s.appendRight(body.start, "{");
      this.s.prependLeft(body.end, "}");
    }
  }
}

function convertArrowExpression(this: VisitState, node: ESTree.ArrowFunctionExpression) {
  if (node.body.type !== "BlockStatement") {
    this.convertedArrows.add(node);
    this.s.appendRight(node.body.start, "{");
    this.s.prependLeft(node.body.end, "}");
  }
}

function coverIfBranches(this: VisitState, node: ESTree.IfStatement) {
  const hint = this.hintFor(node);
  const ignoreIf = hint === "if";
  const ignoreElse = hint === "else";
  const branch = this.cov.newBranch("if", this.loc(node));
  const { consequent, alternate } = node;

  if (ignoreIf) {
    this.skipAll.add(consequent);
  } else {
    const increment = this.getBranchIncrement(branch, this.loc(node));
    const pos = consequent.type === "BlockStatement" ? consequent.start + 1 : consequent.start;
    this.insertStatement(pos, increment);
  }

  if (alternate) {
    if (ignoreElse) {
      this.skipAll.add(alternate);
    } else {
      const increment = this.getBranchIncrement(branch, this.loc(alternate));
      const pos = alternate.type === "BlockStatement" ? alternate.start + 1 : alternate.start;
      this.insertStatement(pos, increment);
    }
  } else if (!ignoreElse) {
    // the closing "}" of the consequent goes before this, see `blockBody`
    const increment = this.getBranchIncrement(branch, undefined);
    this.s.prependLeft(node.end, `else{${increment};}`);
  }
}

function coverIf(this: VisitState, node: ESTree.IfStatement) {
  const { consequent } = node;
  // "else" of a missing alternate must be inserted before the closing "}" of the consequent
  if (consequent.type !== "BlockStatement") {
    this.s.appendRight(consequent.start, "{");
  }
  if (node.alternate && node.alternate.type !== "BlockStatement") {
    this.s.appendRight(node.alternate.start, "{");
    this.s.prependLeft(node.alternate.end, "}");
  }
  coverStatement.call(this, node);
  coverIfBranches.call(this, node);
  if (consequent.type !== "BlockStatement") {
    this.s.prependLeft(consequent.end, "}");
  }
}

function createSwitchBranch(this: VisitState, node: ESTree.SwitchStatement) {
  const b = this.cov.newBranch("switch", this.loc(node));
  this.switchBranches.set(node, b);
}

function coverSwitchCase(this: VisitState, node: ESTree.SwitchCase) {
  const b = this.switchBranches.get(this.parents.get(node)!.parent!);
  /* istanbul ignore if: paranoid check */
  if (b === undefined) {
    throw new Error("Unable to get switch branch name");
  }
  const increment = this.getBranchIncrement(b, this.loc(node));
  if (node.consequent.length > 0) {
    this.insertStatement(node.consequent[0].start, increment);
  } else {
    this.s.prependLeft(node.end, increment + ";");
  }
}

function coverTernary(this: VisitState, node: ESTree.ConditionalExpression) {
  const branch = this.cov.newBranch("cond-expr", this.loc(node));
  const cHint = this.hintFor(node.consequent);
  const aHint = this.hintFor(node.alternate);

  if (cHint !== "next") {
    const increment = this.getBranchIncrement(branch, this.loc(unwrap(node.consequent)));
    this.insertCounter(node.consequent, increment);
  }
  if (aHint !== "next") {
    const increment = this.getBranchIncrement(branch, this.loc(unwrap(node.alternate)));
    this.insertCounter(node.alternate, increment);
  }
}

function coverLogicalExpression(this: VisitState, node: ESTree.LogicalExpression) {
  const { parent } = this.parents.get(node)!;
  if (parent && parent.type === "LogicalExpression") {
    return; // already processed
  }
  const leaves: Node[] = [];
  this.findLeaves(node, leaves);
  const b = this.cov.newBranch("binary-expr", this.loc(node), this.reportLogic);
  for (const leaf of leaves) {
    const hint = this.hintFor(leaf);
    if (hint === "next") {
      continue;
    }
    this.insertLogicalCounter(leaf, b);
  }
}

const codeVisitor: Record<string, VisitFunction[]> = {
  ArrowFunctionExpression: [convertArrowExpression, coverFunction],
  AssignmentPattern: [coverAssignmentPattern],
  BlockStatement: [], // ignore processing only
  ExportDefaultDeclaration: [], // ignore processing only
  ExportNamedDeclaration: [], // ignore processing only
  MethodDefinition: [coverFunction],
  ClassDeclaration: [], // ignore processing only
  PropertyDefinition: [coverClassPropDeclarator],
  Property: [coverFunction],
  ExpressionStatement: [coverExpressionStatement],
  BreakStatement: [coverStatement],
  ContinueStatement: [coverStatement],
  DebuggerStatement: [coverStatement],
  ReturnStatement: [coverStatement],
  ThrowStatement: [coverStatement],
  TryStatement: [coverStatement],
  VariableDeclaration: [], // ignore processing only
  VariableDeclarator: [coverVariableDeclarator],
  IfStatement: [coverIf],
  ForStatement: [blockBody, coverStatement],
  ForInStatement: [blockBody, coverStatement],
  ForOfStatement: [blockBody, coverStatement],
  WhileStatement: [blockBody, coverStatement],
  DoWhileStatement: [blockBody, coverStatement],
  SwitchStatement: [createSwitchBranch, coverStatement],
  SwitchCase: [coverSwitchCase],
  WithStatement: [blockBody, coverStatement],
  FunctionDeclaration: [coverFunction],
  FunctionExpression: [coverFunction],
  LabeledStatement: [coverStatement],
  ConditionalExpression: [coverTernary],
  LogicalExpression: [coverLogicalExpression],
};

// the position where code can be inserted at the start of the program
function programStart(code: string, program: ESTree.Program): number {
  const { hashbang } = program;
  if (!hashbang) {
    return 0;
  }
  const match = /\r\n?|[\n\u2028\u2029]/.exec(code.slice(hashbang.end));
  return match ? hashbang.end + match.index + match[0].length : code.length;
}

// names bound in the program scope
function programBindings(program: ESTree.Program): Set<string> {
  const names = new Set<string>();

  const addPattern = (pattern: Node | null | undefined): void => {
    if (!pattern) {
      return;
    }
    switch (pattern.type) {
      case "Identifier":
        names.add(pattern.name);
        break;
      case "ObjectPattern":
        pattern.properties.forEach((p) => addPattern(p.type === "RestElement" ? p : p.value));
        break;
      case "ArrayPattern":
        pattern.elements.forEach(addPattern);
        break;
      case "AssignmentPattern":
        addPattern(pattern.left);
        break;
      case "RestElement":
        addPattern(pattern.argument);
        break;
    }
  };

  // `var` declarations are bound in the program scope even when nested in blocks
  const addStatement = (node: Node | null | undefined, topLevel: boolean): void => {
    if (!node) {
      return;
    }
    switch (node.type) {
      case "VariableDeclaration":
        if (topLevel || node.kind === "var") {
          node.declarations.forEach((d) => addPattern(d.id));
        }
        break;
      case "FunctionDeclaration":
      case "ClassDeclaration":
        if (topLevel && node.id) {
          names.add(node.id.name);
        }
        break;
      case "ImportDeclaration":
        node.specifiers.forEach((s) => names.add(s.local.name));
        break;
      case "ExportNamedDeclaration":
      case "ExportDefaultDeclaration":
        addStatement(node.declaration as Node, topLevel);
        break;
      case "BlockStatement":
      case "StaticBlock":
        node.body.forEach((s) => addStatement(s, false));
        break;
      case "IfStatement":
        addStatement(node.consequent, false);
        addStatement(node.alternate, false);
        break;
      case "ForStatement":
        addStatement(node.init as Node, false);
        addStatement(node.body, false);
        break;
      case "ForInStatement":
      case "ForOfStatement":
        addStatement(node.left as Node, false);
        addStatement(node.body, false);
        break;
      case "WhileStatement":
      case "DoWhileStatement":
      case "LabeledStatement":
      case "WithStatement":
        addStatement(node.body, false);
        break;
      case "TryStatement":
        addStatement(node.block, false);
        addStatement(node.handler && node.handler.body, false);
        addStatement(node.finalizer, false);
        break;
      case "SwitchStatement":
        node.cases.forEach((c) => c.consequent.forEach((s) => addStatement(s, false)));
        break;
    }
  };

  program.body.forEach((statement) => addStatement(statement, true));
  return names;
}

// serializes a JSON compatible value to JavaScript code
function toCode(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(toCode).join(",") + "]";
  }
  const properties = Object.entries(value).map(([key, v]) => {
    const name =
      key === "__proto__"
        ? '["__proto__"]'
        : IDENTIFIER_RE.test(key) || INDEX_RE.test(key)
          ? key
          : JSON.stringify(key);
    return name + ":" + toCode(v);
  });
  return "{" + properties.join(",") + "}";
}

/**
 * instrumentProgram instruments the parsed program by inserting coverage
 * counters into the source code with `magic-string`.
 *
 * Returns `undefined` when the code has already been instrumented, otherwise an
 * object with the following keys:
 *
 * `fileCoverage` - the file coverage object created for the source file.
 * `sourceMappingURL` - any source mapping URL found when processing the file.
 *
 * @param s - the `MagicString` of the source code that is modified in place.
 * @param program - the ESTree AST of the source code.
 * @param comments - the comments of the source code.
 * @param sourceFilePath - the path to source file.
 * @param opts - additional options. See {@link VisitorOptions}.
 */
function instrumentProgram(
  s: MagicString,
  program: ESTree.Program,
  comments: Comment[],
  sourceFilePath = "unknown.js",
  opts: Partial<VisitorOptions> = {},
): VisitorExitResult | undefined {
  const visitorOpts = {
    ...defaults.instrumentVisitor,
    ...opts,
  };
  const code = s.original;
  // the hashbang is not a comment in Babel's AST
  const hashbangStart = program.hashbang ? program.hashbang.start : -1;
  comments = comments.filter((c) => c.start !== hashbangStart);

  const visitState = new VisitState(
    code,
    s,
    comments,
    sourceFilePath,
    visitorOpts.inputSourceMap,
    visitorOpts.ignoreClassMethods,
    visitorOpts.reportLogic,
    visitorOpts.ignoreLines,
  );

  // the rewire plugin (and potentially other middleware)
  // may cause files to be instrumented twice, see:
  // https://github.com/istanbuljs/babel-plugin-istanbul/issues/94
  // we should only instrument code for coverage the first time
  // it's run through @vitest/istanbul-lib-instrument.
  const bindings = programBindings(program);
  if (bindings.has(visitState.varName)) {
    return;
  }

  let sourceMappingURL: string | null = null;
  for (const comment of comments) {
    const groups = comment.value.trim().match(SOURCE_MAP_RE);
    if (groups) {
      sourceMappingURL = groups[1];
    }
  }

  if (comments.some((c) => COMMENT_FILE_RE.test(c.value))) {
    visitState.cov.freeze();
    return { fileCoverage: visitState.cov.toJSON(), sourceMappingURL };
  }

  for (const statement of program.body) {
    visitState.visit(statement, program, "body");
  }

  visitState.cov.freeze();
  const coverageData: InstrumentedCoverageData = visitState.cov.toJSON();
  coverageData[MAGIC_KEY] = MAGIC_VALUE;
  const hash = createHash(SHA).update(JSON.stringify(coverageData)).digest("hex");
  coverageData.hash = hash;
  if (
    coverageData.inputSourceMap &&
    Object.getPrototypeOf(coverageData.inputSourceMap) !== Object.prototype
  ) {
    coverageData.inputSourceMap = {
      ...coverageData.inputSourceMap,
    };
  }
  const coverageNode = toCode(coverageData);
  delete coverageData[MAGIC_KEY];
  delete coverageData.hash;

  let globalTemplate: string;
  if (visitorOpts.coverageGlobalScopeFunc) {
    const scope = JSON.stringify("return " + visitorOpts.coverageGlobalScope);
    globalTemplate =
      (bindings.has("Function") ? "var Function=(function(){}).constructor;" : "") +
      `var global=(new Function(${scope}))();`;
  } else {
    globalTemplate = `var global=${visitorOpts.coverageGlobalScope};`;
  }

  const { varName } = visitState;
  const header =
    `function ${varName}(){` +
    `var path=${JSON.stringify(sourceFilePath)};` +
    `var hash=${JSON.stringify(hash)};` +
    globalTemplate +
    `var gcv=${JSON.stringify(visitorOpts.coverageVariable)};` +
    `var coverageData=${coverageNode};` +
    "var coverage=global[gcv]||(global[gcv]={});" +
    "if(!coverage[path]||coverage[path].hash!==hash){coverage[path]=coverageData;}" +
    "var actualCoverage=coverage[path];" +
    `{${varName}=function(){return actualCoverage;};}` +
    "return actualCoverage;}" +
    // explicitly call the function to ensure coverage is always initialized
    `${varName}();`;
  s.prependRight(visitState.bodyStart(program), header);

  return {
    fileCoverage: coverageData,
    sourceMappingURL,
  };
}

function originalPositionTryBoth(
  sourceMap: TraceMap,
  { line, column }: { line: number; column: number },
) {
  const mapping = originalPositionFor(sourceMap, {
    line,
    column,
    bias: GREATEST_LOWER_BOUND,
  });
  if (mapping.source === null) {
    return originalPositionFor(sourceMap, {
      line,
      column,
      bias: LEAST_UPPER_BOUND,
    });
  } else {
    return mapping;
  }
}

function tryReadFileSync(filename: string): string | undefined {
  try {
    return readFileSync(filename, "utf8");
  } catch (_) {
    return undefined;
  }
}

export default instrumentProgram;
