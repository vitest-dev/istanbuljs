import type { ActiveFilters, ActiveSort } from "./types";

/** the UI state encoded into the URL hash */
export interface RoutingState {
  activeSort: ActiveSort;
  isFlat: boolean;
  activeFilters: ActiveFilters;
  fileFilter: string;
  expandedLines: string[];
}

export function setLocation(
  isReplace: boolean,
  activeSort: ActiveSort,
  isFlat: boolean,
  activeFilters: ActiveFilters,
  fileFilter: string,
  expandedLines: string[],
): void {
  const params = [
    activeSort.sortKey,
    activeSort.order,
    isFlat,
    activeFilters.low,
    activeFilters.medium,
    activeFilters.high,
    encodeURIComponent(fileFilter),
    expandedLines.map(encodeURIComponent).join(","),
  ];
  const newUrl = `#${params.join("/")}`;

  if (newUrl === location.hash) {
    return;
  }

  window.history[isReplace ? "replaceState" : "pushState"](null, "", newUrl);
}

export function decodeLocation(): RoutingState | null {
  const items = location.hash.slice(1).split("/");
  if (items.length !== 8) {
    return null;
  }

  try {
    return {
      activeSort: {
        sortKey: items[0],
        order: items[1] as ActiveSort["order"],
      },
      isFlat: JSON.parse(items[2]) as boolean,
      activeFilters: {
        low: JSON.parse(items[3]) as boolean,
        medium: JSON.parse(items[4]) as boolean,
        high: JSON.parse(items[5]) as boolean,
      },
      fileFilter: decodeURIComponent(items[6]),
      expandedLines: items[7].split(",").map(decodeURIComponent),
    };
  } catch {
    return null;
  }
}
