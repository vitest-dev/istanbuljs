import type { FunctionalComponent as FC } from "preact";

import { getColor, type StatementWatermarks } from "../helpers/color";
import type { DataSourceItem } from "../types";

const SUMMARY_LABELS: Record<string, string> = {
  statements: "Statements",
  branches: "Branches",
  functions: "Functions",
  lines: "Lines",
};

const METRIC_ORDER = ["statements", "branches", "functions", "lines"] as const;

const SummaryNav: FC<{
  reportName: string;
  value: string;
  onClick: (value: string) => void;
}> = ({ value, onClick, reportName }) => {
  const crumbs = value === "" ? [reportName] : `${reportName}/${value}`.split("/");

  return (
    <nav className="summary-nav" aria-label="Coverage path">
      {crumbs.map((item, index) => {
        const pathKey = `${reportName}-${index}-${item}`;
        const isLast = index === crumbs.length - 1;
        return (
          <span key={pathKey} className="summary-nav__crumb">
            <button
              type="button"
              className={isLast ? "summary-nav__link is-current" : "summary-nav__link"}
              onClick={() => onClick(value.split("/").slice(0, index).join("/"))}
            >
              {item}
            </button>
            {!isLast ? <span className="summary-nav__sep">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
};

const SummaryMetric: FC<{ data: DataSourceItem }> = ({ data }) => {
  return (
    <div className="summary-metrics">
      {METRIC_ORDER.map((key) => {
        const value = data[key];
        return (
          <div className="summary-metric" key={key}>
            <span className="summary-metric__pct">{value.pct}%</span>
            <span className="summary-metric__label">{SUMMARY_LABELS[key]}:</span>
            <span className="summary-metric__ratio">
              {value.covered}/{value.total}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const SummaryBar: FC<{ pct: number; statementWatermarks?: StatementWatermarks }> = ({
  pct,
  statementWatermarks,
}) => {
  return (
    <div
      className="summary-bar"
      style={{ backgroundColor: getColor(pct, statementWatermarks) }}
      role="presentation"
      aria-hidden="true"
    />
  );
};

const SummaryHeader: FC<{
  value: string;
  onSelect: (value: string) => void;
  data: DataSourceItem;
  reportName: string;
  statementWatermarks?: StatementWatermarks;
}> = ({ value, onSelect, data, reportName, statementWatermarks }) => {
  return (
    <header className="summary-header">
      <SummaryNav reportName={reportName} value={value} onClick={onSelect} />
      <SummaryMetric data={data} />
      <SummaryBar pct={data.statements.pct} statementWatermarks={statementWatermarks} />
    </header>
  );
};

export default SummaryHeader;
