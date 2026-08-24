import type { CoverageNode, MetricKey, MetricSummary } from "../../src/reports/html-spa/src/types";

export function metric(
  pct: number,
  classForPercent: string,
  covered: number,
  total: number,
  skipped = 0,
): MetricSummary {
  return { total, covered, skipped, missed: total - covered, pct, classForPercent };
}

export function metricsOf(
  pct: number,
  classForPercent: string,
  covered = Math.round(pct),
  total = 100,
): Record<MetricKey, MetricSummary> {
  return {
    statements: metric(pct, classForPercent, covered, total),
    branches: metric(pct, classForPercent, covered, total),
    functions: metric(pct, classForPercent, covered, total),
    lines: metric(pct, classForPercent, covered, total),
  };
}

/**
 * a small coverage tree:
 *
 *     ├── src
 *     │   ├── high.js   (high)
 *     │   └── nested
 *     │       └── low.js (low)
 *     └── top.js        (medium)
 */
export function coverageFixture(): CoverageNode {
  return {
    file: "",
    isEmpty: false,
    metrics: metricsOf(72.5, "medium"),
    children: [
      {
        file: "src",
        isEmpty: false,
        metrics: metricsOf(50, "medium"),
        children: [
          {
            file: "high.js",
            isEmpty: false,
            metrics: metricsOf(95, "high"),
            children: false,
          },
          {
            file: "nested",
            isEmpty: false,
            metrics: metricsOf(30, "low"),
            children: [
              {
                file: "low.js",
                isEmpty: false,
                metrics: metricsOf(30, "low"),
                children: false,
              },
            ],
          },
        ],
      },
      {
        file: "top.js",
        isEmpty: false,
        metrics: metricsOf(60, "medium"),
        children: false,
      },
    ],
  };
}
