/**
 * Browser-side view of the data the report embeds into the page as
 * `window.data`; structurally compatible with the `SpaDataStructure`
 * the html-spa report produces.
 */

export type MetricKey = "statements" | "branches" | "functions" | "lines";

/** a single coverage metric of a node */
export interface MetricSummary {
  total: number;
  covered: number;
  skipped: number;
  missed: number;
  pct: number | "Unknown";
  classForPercent: string;
}

/** a file or directory node in the coverage tree */
export interface CoverageNode {
  file: string;
  isEmpty?: boolean;
  metrics: Record<MetricKey, MetricSummary>;
  /** child nodes for directories; falsy for files */
  children?: false | CoverageNode[];
}

/** the metrics selected for display, see the report's `metricsToShow` option */
export type MetricsToShow = Partial<Record<MetricKey, boolean>>;

/** active table sorting */
export interface ActiveSort {
  sortKey: string;
  order: "asc" | "desc";
}

/** active coverage-class filters, indexed by a node's `classForPercent` */
export interface ActiveFilters {
  low: boolean;
  medium: boolean;
  high: boolean;
  empty?: boolean;
  [classForPercent: string]: boolean | undefined;
}
