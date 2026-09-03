import Icon, { BarsOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Button, Divider, Input, Segmented, Space, Tooltip } from "antd";
import type { FC } from "react";

import TreeViewIcon from "../icons/TreeViewIcon";
import { useTheme } from "../theme-context";

const TopControl: FC<{
  total: number;
  showMode: string;
  filenameKeywords: string;
  onChangeShowMode: (mode: string) => void;
  onChangeKeywords: (word: string) => void;
}> = ({ total, showMode, onChangeShowMode, onChangeKeywords, filenameKeywords }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <div
        style={{
          display: "flex",
          marginBottom: "6px",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexDirection: "column" }}>
          <Space>
            <Segmented
              size="small"
              value={showMode}
              onChange={(v) => {
                onChangeShowMode(String(v));
              }}
              options={[
                {
                  label: "Code Tree",
                  value: "tree",
                  icon: <Icon component={TreeViewIcon} />,
                },
                {
                  label: "File List",
                  value: "list",
                  icon: <BarsOutlined />,
                },
              ]}
            />
            <span style={{ fontSize: "14px" }}>
              {total} {"Total Files"}
            </span>
          </Space>
        </div>
        <Space>
          <Tooltip title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
            <Button
              type="text"
              size="small"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              icon={theme === "dark" ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
            />
          </Tooltip>
          <Input
            placeholder="Search for files"
            value={filenameKeywords}
            style={{ width: "240px" }}
            size="small"
            onChange={(val) => {
              onChangeKeywords(val.target.value);
            }}
          />
        </Space>
      </div>
      <Divider style={{ margin: "0", marginBottom: "6px" }} />
    </div>
  );
};

export default TopControl;
