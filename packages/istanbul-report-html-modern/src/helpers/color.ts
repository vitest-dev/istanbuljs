/** istanbul default for `statements` watermarks: `[low, high]` */
export type StatementWatermarks = readonly [low: number, high: number];

export const DEFAULT_STATEMENT_WATERMARKS: StatementWatermarks = [50, 80];

const COLORS = {
  high: "rgb(33, 181, 119)",
  medium: "rgb(244, 176, 27)",
  low: "rgb(245, 32, 32)",
} as const;

/** Map coverage percentage to a color using istanbul-style `[low, high]` watermarks. */
export function getColor(
  pct: number,
  watermarks: StatementWatermarks = DEFAULT_STATEMENT_WATERMARKS,
): string {
  const [low, high] = watermarks;
  if (pct >= high) {
    return COLORS.high;
  }
  if (pct >= low) {
    return COLORS.medium;
  }
  return COLORS.low;
}
