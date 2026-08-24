import type { ActiveSort, MetricsToShow } from "./types";

function getSortDetails(sortKey: string, activeSort: ActiveSort) {
  let newSort: ActiveSort = { sortKey, order: "desc" };
  let sortClass = "";
  if (activeSort && activeSort.sortKey === sortKey) {
    sortClass = "sorted";
    if (activeSort.order === "desc") {
      sortClass += "-desc";
      newSort.order = "asc";
    } else {
      if (sortKey !== "file") {
        newSort = { sortKey: "file", order: "desc" };
      }
    }
  }

  return {
    newSort,
    sortClass,
  };
}

interface SummaryTableHeaderCellProps {
  name: string;
  onSort: (sort: ActiveSort) => void;
  sortKey: string;
  activeSort: ActiveSort;
}

function SummaryTableHeaderCell({
  name,
  onSort,
  sortKey,
  activeSort,
}: SummaryTableHeaderCellProps) {
  const { newSort, sortClass } = getSortDetails(sortKey, activeSort);
  return (
    <th className={"sortable headercell " + sortClass} onClick={() => onSort(newSort)}>
      {name}
      <span className="sorter" />
    </th>
  );
}

interface FileHeaderCellProps {
  onSort: (sort: ActiveSort) => void;
  activeSort: ActiveSort;
}

function FileHeaderCell({ onSort, activeSort }: FileHeaderCellProps) {
  const { newSort, sortClass } = getSortDetails("file", activeSort);

  return (
    <th className={"sortable file " + sortClass} onClick={() => onSort(newSort)}>
      File
      <span className="sorter" />
    </th>
  );
}

interface SubHeadingsProps {
  sortKeyPrefix: string;
  onSort: (sort: ActiveSort) => void;
  activeSort: ActiveSort;
}

function SubHeadings({ sortKeyPrefix, onSort, activeSort }: SubHeadingsProps) {
  return (
    <>
      <SummaryTableHeaderCell
        name="%"
        onSort={onSort}
        sortKey={sortKeyPrefix + ".pct"}
        activeSort={activeSort}
      />
      <th className="headercell"></th>
      <SummaryTableHeaderCell
        name="Covered"
        onSort={onSort}
        sortKey={sortKeyPrefix + ".covered"}
        activeSort={activeSort}
      />
      <SummaryTableHeaderCell
        name="Missed"
        onSort={onSort}
        sortKey={sortKeyPrefix + ".missed"}
        activeSort={activeSort}
      />
      <SummaryTableHeaderCell
        name="Total"
        onSort={onSort}
        sortKey={sortKeyPrefix + ".total"}
        activeSort={activeSort}
      />
    </>
  );
}

interface SummaryTableHeaderProps {
  onSort: (sort: ActiveSort) => void;
  activeSort: ActiveSort;
  metricsToShow: MetricsToShow;
}

export default function SummaryTableHeader({
  onSort,
  activeSort,
  metricsToShow,
}: SummaryTableHeaderProps) {
  return (
    <thead>
      <tr className="topheading">
        <th></th>
        {metricsToShow.statements && <th colSpan={5}>Statements</th>}
        {metricsToShow.branches && <th colSpan={5}>Branches</th>}
        {metricsToShow.functions && <th colSpan={5}>Functions</th>}
        {metricsToShow.lines && <th colSpan={5}>Lines</th>}
      </tr>
      <tr className="subheading">
        <FileHeaderCell onSort={onSort} activeSort={activeSort} />
        {metricsToShow.statements && (
          <SubHeadings sortKeyPrefix="statements" onSort={onSort} activeSort={activeSort} />
        )}
        {metricsToShow.branches && (
          <SubHeadings sortKeyPrefix="branches" onSort={onSort} activeSort={activeSort} />
        )}
        {metricsToShow.functions && (
          <SubHeadings sortKeyPrefix="functions" onSort={onSort} activeSort={activeSort} />
        )}
        {metricsToShow.lines && (
          <SubHeadings sortKeyPrefix="lines" onSort={onSort} activeSort={activeSort} />
        )}
      </tr>
    </thead>
  );
}
