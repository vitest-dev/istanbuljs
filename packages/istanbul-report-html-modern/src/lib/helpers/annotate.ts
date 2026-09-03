import type { FileCoverageData } from "../types";

export interface CoverageAnnotation {
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  type: "S" | "F" | "B" | "I" | "E";
}

export function annotateStatements(
  fileCoverage: FileCoverageData,
  structuredText: string,
): CoverageAnnotation[] {
  const annotateStatementsList: CoverageAnnotation[] = [];
  const statementStats = fileCoverage.s;
  const statementMeta = fileCoverage.statementMap;
  const rows = structuredText.split("\n");

  for (const [stName, count] of Object.entries(statementStats)) {
    const meta = statementMeta[stName];
    if (meta === undefined) {
      continue;
    }
    if (count > 0) {
      continue;
    }
    const startCol = meta.start.column;
    const endCol = meta.end.column + 1;
    const startLine = meta.start.line;
    const endLine = meta.end.line;
    const lineText = rows[startLine - 1] ?? "";
    const realEndCol = startCol > endCol ? lineText.length : endCol;
    annotateStatementsList.push({
      startLine,
      endLine,
      startCol: startCol + 1,
      endCol: realEndCol + 1,
      type: "S",
    });
  }
  return annotateStatementsList;
}

export function annotateFunctions(
  fileCoverage: FileCoverageData,
  structuredText: string,
): CoverageAnnotation[] {
  const fnStats = fileCoverage.f;
  const fnMeta = fileCoverage.fnMap;
  if (fnStats === undefined) {
    return [];
  }
  const rows = structuredText.split("\n");
  const list: CoverageAnnotation[] = [];

  for (const [fName, count] of Object.entries(fnStats)) {
    const meta = fnMeta[fName];
    if (meta === undefined || count > 0) {
      continue;
    }
    const decl = meta.decl ?? meta.loc;
    const startCol = decl.start.column;
    let endCol = decl.end.column + 1;
    const startLine = decl.start.line;
    const endLine = decl.end.line;
    if (endLine !== startLine) {
      endCol = (rows[startLine - 1] ?? "").length;
    }
    list.push({
      startLine,
      endLine,
      startCol: startCol + 1,
      endCol: endCol + 1,
      type: "F",
    });
  }
  return list;
}

export function annotateBranches(
  fileCoverage: FileCoverageData,
  structuredText: string,
): CoverageAnnotation[] {
  const branchStats = fileCoverage.b;
  const branchMeta = fileCoverage.branchMap;
  if (branchStats === undefined) {
    return [];
  }

  const rows = structuredText.split("\n");
  const arr: CoverageAnnotation[] = [];

  for (const [branchName, branchArray] of Object.entries(branchStats)) {
    const meta = branchMeta[branchName];
    if (meta === undefined) {
      continue;
    }
    const sumCount = branchArray.reduce((p, n) => p + n, 0);
    const metaArray = [...meta.locations];

    if (!(sumCount > 0 || (sumCount === 0 && branchArray.length === 1))) {
      continue;
    }

    if (
      meta.type === "if" &&
      branchArray.length === 2 &&
      metaArray.length === 1 &&
      branchArray[1] === 0
    ) {
      metaArray[1] = {
        start: { line: 0, column: 0 },
        end: { line: 0, column: 0 },
      };
    }

    for (let i = 0; i < branchArray.length && i < metaArray.length; i += 1) {
      const count = branchArray[i];
      let loc = metaArray[i];
      if (count === undefined || loc === undefined) {
        continue;
      }

      if (count === 0 && loc.start.line === 0 && meta.type === "if" && i > 0) {
        const prevMeta = metaArray[i - 1];
        if (prevMeta !== undefined) {
          loc = prevMeta;
        }
      }

      if (count !== 0) {
        continue;
      }

      const startLine = loc.start.line;
      if (rows[startLine - 1] === undefined) {
        continue;
      }

      const startCol = loc.start.column;
      const endCol = loc.end.column + 1;
      const endLine = loc.end.line;

      if (meta.type === "if") {
        arr.push({
          startLine,
          endLine,
          startCol: startCol + 1,
          endCol: endCol + 1,
          type: i === 0 ? "I" : "E",
        });
      } else {
        arr.push({
          startLine,
          endLine,
          startCol: startCol + 1,
          endCol: endCol + 1,
          type: "B",
        });
      }
    }
  }
  return arr;
}
