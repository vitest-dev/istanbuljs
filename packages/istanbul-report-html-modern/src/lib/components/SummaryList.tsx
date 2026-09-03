import { ConfigProvider, Progress, Table } from "antd";
import type { TableColumnsType } from "antd";
import type { CSSProperties, FC } from "react";
import Highlighter from "react-highlight-words";

import { getColor } from "../helpers/color";
import type { DataSourceItem } from "../types";

const SummaryList: FC<{
  dataSource: DataSourceItem[];
  onSelect: (path: string) => void;
  filenameKeywords: string;
  style?: CSSProperties;
}> = ({ dataSource, onSelect, filenameKeywords, style }) => {
  const columns: TableColumnsType<DataSourceItem> = [
    {
      title: "Files",
      key: "path",
      dataIndex: "path",
      render(text: string) {
        return (
          <a
            onClick={() => {
              onSelect(text);
            }}
          >
            <Highlighter
              highlightClassName="YourHighlightClass"
              searchWords={[filenameKeywords]}
              autoEscape={true}
              textToHighlight={text}
            />
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
      sorter: (a, b) => a.statements.pct - b.statements.pct,
      dataIndex: ["statements", "pct"],
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
          bordered={true}
          pagination={{
            defaultPageSize: 15,
            pageSizeOptions: [50, 100],
          }}
          size="small"
          dataSource={dataSource}
          rowKey="path"
          columns={columns}
        />
      </ConfigProvider>
    </div>
  );
};

export default SummaryList;
