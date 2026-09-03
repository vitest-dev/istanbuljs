import { Tag, Typography } from "antd";
import type { FC } from "react";

import { getColor } from "../helpers/color";
import type { DataSourceItem } from "../types";

const { Text } = Typography;

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
    <div
      style={{
        display: "flex",
        gap: "3px",
        marginBottom: "6px",
        fontSize: "16px",
        fontWeight: "bold",
      }}
    >
      {crumbs.map((item, index) => {
        const pathKey = `${reportName}-${index}-${item}`;
        return (
          <div key={pathKey} style={{ display: "flex", gap: "3px" }}>
            <a
              onClick={() => {
                onClick(value.split("/").slice(0, index).join("/"));
              }}
            >
              {item}
            </a>
            {index === value.split("/").length || !value ? null : <span>/</span>}
          </div>
        );
      })}
    </div>
  );
};

const SummaryMetric: FC<{ data: DataSourceItem }> = ({ data }) => {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "6px",
          marginBottom: "6px",
          maxWidth: "1000px",
          flexWrap: "wrap",
        }}
      >
        {METRIC_ORDER.map((key) => {
          const value = data[key];
          return (
            <div
              style={{
                display: "flex",
                gap: "3px",
                alignItems: "center",
              }}
              key={key}
            >
              <span style={{ fontWeight: "600", fontSize: "14px" }}>{value.pct}%</span>
              <Text style={{ fontSize: "14px" }} type="secondary">
                {SUMMARY_LABELS[key]}:
              </Text>
              <Tag variant="filled">
                {value.covered}/{value.total}
              </Tag>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SummaryBar: FC<{ pct: number }> = ({ pct }) => {
  return (
    <div
      style={{
        height: "8px",
        width: "100%",
        marginBottom: "6px",
        backgroundColor: getColor(pct),
      }}
    />
  );
};

const SummaryHeader: FC<{
  value: string;
  onSelect: (value: string) => void;
  data: DataSourceItem;
  reportName: string;
}> = ({ value, onSelect, data, reportName }) => {
  return (
    <div>
      <SummaryNav reportName={reportName} value={value} onClick={onSelect} />
      <SummaryMetric data={data} />
      <SummaryBar pct={data.statements.pct} />
    </div>
  );
};

export default SummaryHeader;
