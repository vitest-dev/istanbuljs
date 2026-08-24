import type {
  ActiveSort,
  ActiveFilters,
  CoverageNode,
  MetricKey,
  MetricsToShow,
  MetricSummary,
} from "./types";

function addPath(node: CoverageNode, parentPath?: string): CoverageNode {
  if (!parentPath) {
    return node;
  }
  return { ...node, file: parentPath + "/" + node.file };
}

function flatten(nodes: CoverageNode[], parentPath?: string): CoverageNode[] {
  let children: CoverageNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const child = nodes[i];
    if (child.children) {
      children = [
        ...children,
        ...flatten(child.children, (parentPath ? parentPath + "/" : "") + child.file),
      ];
    } else {
      children.push(addPath(child, parentPath));
    }
  }
  return children;
}

function filterByFile(
  nodes: CoverageNode[],
  fileFilter: string,
  parentPath?: string,
): CoverageNode[] {
  let children: CoverageNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const child = nodes[i];
    const childFullPath = (parentPath ? parentPath + "/" : "") + child.file;

    const isChildUnderFilter =
      fileFilter === childFullPath || fileFilter.indexOf(childFullPath + "/") === 0;
    const isChildAboveFilter = childFullPath.indexOf(fileFilter + "/") === 0;

    if (isChildUnderFilter) {
      // flatten and continue looking underneath
      children = [...children, ...filterByFile(child.children || [], fileFilter, childFullPath)];
    } else if (isChildAboveFilter) {
      // remove the parent path and add everything underneath
      const charsToRemoveFromFile = fileFilter.length - (parentPath ? parentPath.length : 0);
      let childFilename = child.file.slice(charsToRemoveFromFile);
      if (childFilename[0] === "/") {
        childFilename = childFilename.slice(1);
      }
      children.push({
        ...child,
        file: childFilename,
      });
    }
  }
  return children;
}

function sort(childData: CoverageNode[], activeSort: ActiveSort): CoverageNode[] {
  const top = activeSort.order === "asc" ? 1 : -1;
  const bottom = activeSort.order === "asc" ? -1 : 1;
  childData.sort((a, b) => {
    let valueA: string | number;
    let valueB: string | number;
    if (activeSort.sortKey === "file") {
      valueA = a.file;
      valueB = b.file;
    } else {
      const [metricType, valueType] = activeSort.sortKey.split(".") as [
        MetricKey,
        keyof MetricSummary,
      ];
      valueA = a.metrics[metricType][valueType];
      valueB = b.metrics[metricType][valueType];
    }

    if (valueA === valueB) {
      return 0;
    }
    return valueA < valueB ? top : bottom;
  });

  for (let i = 0; i < childData.length; i++) {
    const child = childData[i];
    if (child.children) {
      childData[i] = {
        ...child,
        children: sort(child.children, activeSort),
      };
    }
  }
  return childData;
}

function filter(
  nodes: CoverageNode[],
  metricsMap: MetricsToShow,
  activeFilters: ActiveFilters,
): CoverageNode[] {
  const children: CoverageNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    let child = nodes[i];
    if (child.children) {
      const newSubChildren = filter(child.children, metricsMap, activeFilters);
      if (newSubChildren.length) {
        child = { ...child, children: newSubChildren };
        children.push(child);
      }
    } else {
      if (
        (metricsMap.statements && activeFilters[child.metrics.statements.classForPercent]) ||
        (metricsMap.branches && activeFilters[child.metrics.branches.classForPercent]) ||
        (metricsMap.functions && activeFilters[child.metrics.functions.classForPercent]) ||
        (metricsMap.lines && activeFilters[child.metrics.lines.classForPercent])
      ) {
        children.push(child);
      }
    }
  }
  return children;
}

export default function getChildData(
  sourceData: CoverageNode,
  metricsToShow: MetricsToShow,
  activeSort: ActiveSort | null,
  isFlat: boolean,
  activeFilters: ActiveFilters,
  fileFilter: string | null,
): CoverageNode[] {
  let childData = sourceData.children || [];

  if (isFlat) {
    childData = flatten(childData.slice(0));
  }

  if (fileFilter) {
    childData = filterByFile(childData, fileFilter);
  }

  if (activeFilters.low) {
    activeFilters = { ...activeFilters, empty: true };
  }
  childData = filter(childData, metricsToShow, activeFilters);

  if (activeSort) {
    childData = sort(childData, activeSort);
  }
  return childData;
}
