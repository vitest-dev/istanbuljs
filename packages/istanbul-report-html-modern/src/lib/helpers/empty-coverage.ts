import type { FileCoverageData } from "../types";

export const emptyFileCoverage: FileCoverageData = {
  path: "",
  statementMap: {},
  fnMap: {},
  branchMap: {},
  s: {},
  f: {},
  b: {},
};
