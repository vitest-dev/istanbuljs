import type { ComponentChildren, FunctionalComponent as FC } from "preact";

/** Highlight case-insensitive substring matches; no-op when query is empty. */
export function highlightMatch(text: string, query: string): ComponentChildren {
  const needle = query.trim();
  if (!needle) {
    return text;
  }

  const lower = text.toLowerCase();
  const q = needle.toLowerCase();
  const parts: ComponentChildren[] = [];
  let start = 0;
  let index = lower.indexOf(q);

  while (index !== -1) {
    if (index > start) {
      parts.push(text.slice(start, index));
    }
    parts.push(
      <mark key={`${index}-${q}`} className="search-mark">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    start = index + needle.length;
    index = lower.indexOf(q, start);
  }

  if (start < text.length) {
    parts.push(text.slice(start));
  }

  return parts.length > 0 ? parts : text;
}

type SortKey = "path" | "total" | "covered" | "pct";
type SortDir = "asc" | "desc";

export function sortCoverageRows<
  T extends { path: string; statements: { total: number; covered: number; pct: number } },
>(rows: T[], key: SortKey, dir: SortDir): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "path") {
      return a.path.localeCompare(b.path) * factor;
    }
    if (key === "total") {
      return (a.statements.total - b.statements.total) * factor;
    }
    if (key === "covered") {
      return (a.statements.covered - b.statements.covered) * factor;
    }
    return (a.statements.pct - b.statements.pct) * factor;
  });
}

export const SortableTh: FC<{
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}> = ({ label, sortKey, activeKey, dir, onSort, className }) => {
  const active = activeKey === sortKey;
  return (
    <th className={className}>
      <button type="button" className="coverage-th-btn" onClick={() => onSort(sortKey)}>
        {label}
        {active ? <span className="coverage-th-btn__dir">{dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
};

export type { SortKey, SortDir };
