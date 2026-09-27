import { File, Folder } from "lucide-preact";
import type { FunctionalComponent as FC } from "preact";
import { useMemo, useState } from "preact/hooks";

import type { StatementWatermarks } from "../helpers/color";
import type { DataSourceItem } from "../types";
import { CoverageMeter } from "./CoverageMeter";
import { SortableTh, sortCoverageRows, type SortDir, type SortKey } from "./table-utils";

function isSourceFile(path: string): boolean {
  return /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts|vue|json|css|scss|less|html|md)$/i.test(path);
}

const SummaryTree: FC<{
  dataSource: DataSourceItem[];
  onSelect: (path: string) => void;
  statementWatermarks?: StatementWatermarks;
}> = ({ dataSource, onSelect, statementWatermarks }) => {
  const [sortKey, setSortKey] = useState<SortKey>("path");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows = useMemo(
    () => sortCoverageRows(dataSource, sortKey, sortDir),
    [dataSource, sortKey, sortDir],
  );

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "path" ? "asc" : "desc");
  };

  return (
    <div className="coverage-table-wrap">
      <table className="coverage-table">
        <thead>
          <tr>
            <SortableTh
              label="File"
              sortKey="path"
              activeKey={sortKey}
              dir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label="Total"
              sortKey="total"
              activeKey={sortKey}
              dir={sortDir}
              onSort={onSort}
              className="is-num"
            />
            <SortableTh
              label="Covered"
              sortKey="covered"
              activeKey={sortKey}
              dir={sortDir}
              onSort={onSort}
              className="is-num"
            />
            <SortableTh
              label="Coverage"
              sortKey="pct"
              activeKey={sortKey}
              dir={sortDir}
              onSort={onSort}
              className="is-coverage"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = row.path.split("/").at(-1) || row.path;
            return (
              <tr key={row.path}>
                <td>
                  <button type="button" className="path-link" onClick={() => onSelect(row.path)}>
                    {isSourceFile(row.path) ? (
                      <File className="path-icon" size={14} aria-hidden />
                    ) : (
                      <Folder className="path-icon" size={14} aria-hidden />
                    )}
                    <span>{name}</span>
                  </button>
                </td>
                <td className="is-num">{row.statements.total}</td>
                <td className="is-num">{row.statements.covered}</td>
                <td className="is-coverage">
                  <CoverageMeter
                    pct={row.statements.pct}
                    statementWatermarks={statementWatermarks}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="empty-hint">No files match the current filters.</p> : null}
    </div>
  );
};

export default SummaryTree;
