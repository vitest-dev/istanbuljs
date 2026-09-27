/*
 Copyright 2012-2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import type { CoverageMap, CoverageSummary, FileCoverage } from "@vitest/istanbul-lib-coverage";
import { createCoverageSummary } from "@vitest/istanbul-lib-coverage";

import Path from "./path";
import { BaseNode, BaseTree } from "./tree";

/** names of the summarizer strategies supported by {@link SummarizerFactory} */
export type Summarizers = "flat" | "nested" | "pkg" | "defaultSummarizer";

class ReportNode extends BaseNode {
  declare path: Path;
  declare parent: ReportNode | null;
  declare fileCoverage: FileCoverage | undefined;
  declare children: ReportNode[];

  declare c_files?: CoverageSummary | null;
  declare c_full?: CoverageSummary | null;

  constructor(path: Path, fileCoverage?: FileCoverage) {
    super();

    this.path = path;
    this.parent = null;
    this.fileCoverage = fileCoverage;
    this.children = [];
  }

  static createRoot(children: ReportNode[]): ReportNode {
    const root = new ReportNode(new Path([]));

    children.forEach((child) => {
      root.addChild(child);
    });

    return root;
  }

  addChild(child: ReportNode): void {
    child.parent = this;
    this.children.push(child);
  }

  asRelative(p: string): string {
    if (p.substring(0, 1) === "/") {
      return p.substring(1);
    }
    return p;
  }

  getQualifiedName(): string {
    return this.asRelative(this.path.toString());
  }

  getRelativeName(): string {
    const parent = this.getParent();
    const myPath = this.path;
    let relPath;
    let i;
    const parentPath = parent ? parent.path : new Path([]);
    if (parentPath.ancestorOf(myPath)) {
      relPath = new Path(myPath.elements());
      for (i = 0; i < parentPath.length; i += 1) {
        relPath.shift();
      }
      return this.asRelative(relPath.toString());
    }
    return this.asRelative(this.path.toString());
  }

  getParent(): ReportNode | null {
    return this.parent;
  }

  getChildren(): ReportNode[] {
    return this.children;
  }

  isSummary(): boolean {
    return !this.fileCoverage;
  }

  getFileCoverage(): FileCoverage {
    return this.fileCoverage as FileCoverage;
  }

  getCoverageSummary(filesOnly?: boolean): CoverageSummary | null {
    const cacheProp = `c_${filesOnly ? "files" : "full"}` as "c_files" | "c_full";
    let summary: CoverageSummary | null;

    if (Object.prototype.hasOwnProperty.call(this, cacheProp)) {
      return this[cacheProp] as CoverageSummary | null;
    }

    if (!this.isSummary()) {
      summary = this.getFileCoverage().toSummary();
    } else {
      let count = 0;
      summary = createCoverageSummary();
      this.getChildren().forEach((child) => {
        if (filesOnly && child.isSummary()) {
          return;
        }
        count += 1;
        summary!.merge(child.getCoverageSummary(filesOnly)!);
      });
      if (count === 0 && filesOnly) {
        summary = null;
      }
    }
    this[cacheProp] = summary;
    return summary;
  }
}

class ReportTree extends BaseTree<ReportNode> {
  constructor(root: ReportNode, childPrefix?: string) {
    super(root);

    const maybePrefix = (node: ReportNode) => {
      if (childPrefix && !node.isRoot()) {
        node.path.unshift(childPrefix);
      }
    };
    this.visit({
      onDetail: maybePrefix,
      onSummary(node) {
        maybePrefix(node);
        node.children.sort((a, b) => {
          const astr = a.path.toString();
          const bstr = b.path.toString();
          return astr < bstr ? -1 : astr > bstr ? 1 : /* istanbul ignore next */ 0;
        });
      },
    });
  }
}

interface InitialListNode {
  filePath: string;
  path: Path;
  fileCoverage: FileCoverage;
}

function findOrCreateParent(
  parentPath: Path,
  nodeMap: Record<string, ReportNode>,
  created: (parentPath: Path, parent: ReportNode) => void = () => {},
): ReportNode {
  let parent = nodeMap[parentPath.toString()];

  if (!parent) {
    parent = new ReportNode(parentPath);
    nodeMap[parentPath.toString()] = parent;
    created(parentPath, parent);
  }

  return parent;
}

function toDirParents(list: InitialListNode[]): ReportNode[] {
  const nodeMap: Record<string, ReportNode> = Object.create(null);
  list.forEach((o) => {
    const parent = findOrCreateParent(o.path.parent(), nodeMap);
    parent.addChild(new ReportNode(o.path, o.fileCoverage));
  });

  return Object.values(nodeMap);
}

function addAllPaths(
  topPaths: ReportNode[],
  nodeMap: Record<string, ReportNode>,
  path: Path,
  node: ReportNode,
): void {
  const parent = findOrCreateParent(path.parent(), nodeMap, (parentPath, parent) => {
    if (parentPath.hasParent()) {
      addAllPaths(topPaths, nodeMap, parentPath, parent);
    } else {
      topPaths.push(parent);
    }
  });

  parent.addChild(node);
}

function foldIntoOneDir(node: ReportNode, parent?: ReportNode): ReportNode {
  const { children } = node;
  if (children.length === 1 && !children[0].fileCoverage) {
    children[0].parent = parent as ReportNode;
    return foldIntoOneDir(children[0], parent);
  }
  node.children = children.map((child) => foldIntoOneDir(child, node));
  return node;
}

function pkgSummaryPrefix(dirParents: ReportNode[], commonParent: Path): string | undefined {
  if (!dirParents.some((dp) => dp.path.length === 0)) {
    return;
  }

  if (commonParent.length === 0) {
    return "root";
  }

  return commonParent.name();
}

class SummarizerFactory {
  declare private _coverageMap: CoverageMap;
  declare private _defaultSummarizer: Summarizers;
  declare private _initialList: InitialListNode[];
  declare private _commonParent: Path;
  declare private _flat: ReportTree | undefined;
  declare private _pkg: ReportTree | undefined;
  declare private _nested: ReportTree | undefined;

  constructor(coverageMap: CoverageMap, defaultSummarizer: Summarizers = "pkg") {
    this._coverageMap = coverageMap;
    this._defaultSummarizer = defaultSummarizer;
    this._initialList = coverageMap.files().map((filePath) => ({
      filePath,
      path: new Path(filePath),
      fileCoverage: coverageMap.fileCoverageFor(filePath),
    }));
    this._commonParent = Path.findCommonParent(this._initialList.map((o) => o.path.parent()));
    if (this._commonParent.length > 0) {
      this._initialList.forEach((o) => {
        o.path.splice(0, this._commonParent.length);
      });
    }
  }

  get defaultSummarizer(): ReportTree {
    return this[this._defaultSummarizer];
  }

  get flat(): ReportTree {
    if (!this._flat) {
      this._flat = new ReportTree(
        ReportNode.createRoot(
          this._initialList.map((node) => new ReportNode(node.path, node.fileCoverage)),
        ),
      );
    }

    return this._flat;
  }

  private _createPkg(): ReportTree {
    const dirParents = toDirParents(this._initialList);
    if (dirParents.length === 1) {
      return new ReportTree(dirParents[0]);
    }

    return new ReportTree(
      ReportNode.createRoot(dirParents),
      pkgSummaryPrefix(dirParents, this._commonParent),
    );
  }

  get pkg(): ReportTree {
    if (!this._pkg) {
      this._pkg = this._createPkg();
    }

    return this._pkg;
  }

  private _createNested(): ReportTree {
    const nodeMap: Record<string, ReportNode> = Object.create(null);
    const topPaths: ReportNode[] = [];
    this._initialList.forEach((o) => {
      const node = new ReportNode(o.path, o.fileCoverage);
      addAllPaths(topPaths, nodeMap, o.path, node);
    });

    const topNodes = topPaths.map((node) => foldIntoOneDir(node));
    if (topNodes.length === 1) {
      return new ReportTree(topNodes[0]);
    }

    return new ReportTree(ReportNode.createRoot(topNodes));
  }

  get nested(): ReportTree {
    if (!this._nested) {
      this._nested = this._createNested();
    }

    return this._nested;
  }
}

export default SummarizerFactory;
export { ReportNode, ReportTree };
