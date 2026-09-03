import type { DataSourceItem } from "../types";
import { buildSummaryTree } from "./summary";

function matchesKeywords(item: { path: string }, keywords: string): boolean {
  if (keywords === "") {
    return true;
  }
  return item.path.toLowerCase().includes(keywords.toLowerCase());
}

function underPath(item: { path: string }, startValue: string): boolean {
  if (startValue === "") {
    return true;
  }
  return item.path === startValue || item.path.startsWith(`${startValue}/`);
}

/** Filter and group coverage rows for tree / list / header views. */
export function deriveSummaryViews({
  dataSource,
  filenameKeywords,
  value,
}: {
  dataSource: DataSourceItem[];
  filenameKeywords: string;
  value: string;
}): {
  treeDataSource: DataSourceItem[];
  rootDataSource: DataSourceItem;
  listDataSource: DataSourceItem[];
} {
  const listDataSource = dataSource.filter(
    (item) => underPath(item, value) && matchesKeywords(item, filenameKeywords),
  );
  const tree = buildSummaryTree(value, listDataSource);
  return {
    treeDataSource: tree.children,
    rootDataSource: {
      path: tree.path,
      ...tree.summary,
    },
    listDataSource,
  };
}
