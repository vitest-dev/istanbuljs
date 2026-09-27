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

function matchesAnyTag(item: DataSourceItem, selectedTags: readonly string[]): boolean {
  if (selectedTags.length === 0) {
    return true;
  }
  const tags = item.tags;
  if (tags === undefined || tags.length === 0) {
    return false;
  }
  return selectedTags.some((tag) => tags.includes(tag));
}

/** Rows visible before tag filtering (path + keyword only). */
export function filterDataSourceBase({
  dataSource,
  filenameKeywords,
  value,
}: {
  dataSource: DataSourceItem[];
  filenameKeywords: string;
  value: string;
}): DataSourceItem[] {
  return dataSource.filter(
    (item) => underPath(item, value) && matchesKeywords(item, filenameKeywords),
  );
}

/** Filter and group coverage rows for tree / list / header views. */
export function deriveSummaryViews({
  dataSource,
  filenameKeywords,
  selectedTags = [],
  value,
}: {
  dataSource: DataSourceItem[];
  filenameKeywords: string;
  selectedTags?: string[];
  value: string;
}): {
  treeDataSource: DataSourceItem[];
  rootDataSource: DataSourceItem;
  listDataSource: DataSourceItem[];
} {
  const listDataSource = dataSource.filter(
    (item) =>
      underPath(item, value) &&
      matchesKeywords(item, filenameKeywords) &&
      matchesAnyTag(item, selectedTags),
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
