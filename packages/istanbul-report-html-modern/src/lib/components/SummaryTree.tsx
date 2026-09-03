import { FileOutlined, FolderFilled } from "@ant-design/icons";
import { ConfigProvider, Progress, Table } from "antd";
import type { TableColumnsType } from "antd";
import type { CSSProperties, FC } from "react";

import { getColor } from "../helpers/color";
import type { DataSourceItem } from "../types";

function isSourceFile(path: string): boolean {
  return /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts|vue|json|css|scss|less|html|md)$/i.test(path);
}

const SummaryTree: FC<{
  dataSource: DataSourceItem[];
  onSelect: (path: string) => void;
  style?: CSSProperties;
}> = ({ dataSource, onSelect, style }) => {
  const columns: TableColumnsType<DataSourceItem> = [
    {
      title: "Files",
      key: "path",
      dataIndex: "path",
      render(text: string) {
        return (
          <a
            style={{
              display: "inline-flex",
              gap: "2px",
              alignItems: "center",
            }}
            onClick={() => {
              onSelect(text);
            }}
          >
            {isSourceFile(text) ? (
              <FileOutlined style={{ fontSize: "16px" }} />
            ) : (
              <FolderFilled style={{ fontSize: "16px" }} />
            )}
            {text.split("/").at(-1)}
          </a>
        );
      },
    },
    {
      title: "Total",
      key: "total",
      dataIndex: ["statements", "total"],
      sorter: (a, b) => a.statements.total - b.statements.total,
    },
    {
      title: "Covered",
      key: "covered",
      dataIndex: ["statements", "covered"],
      sorter: (a, b) => a.statements.covered - b.statements.covered,
    },
    {
      title: "Coverage %",
      width: "240px",
      key: "c",
      dataIndex: ["statements", "pct"],
      sorter: (a, b) => a.statements.pct - b.statements.pct,
      render(text: number) {
        return (
          <Progress
            percent={text}
            strokeLinecap="butt"
            size="small"
            strokeColor={getColor(text)}
            style={{ paddingRight: "5px" }}
            status="normal"
          />
        );
      },
    },
  ];

  return (
    <div style={style}>
      <ConfigProvider
        theme={{
          token: {
            borderRadius: 0,
          },
        }}
      >
        <Table
          rowKey="path"
          bordered={true}
          pagination={false}
          size="small"
          dataSource={dataSource}
          columns={columns}
        />
      </ConfigProvider>
    </div>
  );
};

export default SummaryTree;
