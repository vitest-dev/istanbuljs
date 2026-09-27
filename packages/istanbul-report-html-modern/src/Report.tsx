import type { FunctionalComponent as FC } from "preact";
import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks";

import CoverageDetail from "./components/CoverageDetail";
import SummaryHeader from "./components/SummaryHeader";
import SummaryList from "./components/SummaryList";
import SummaryTree from "./components/SummaryTree";
import TopControl from "./components/TopControl";
import { collectAvailableTags } from "./file-tags";
import { deriveSummaryViews, filterDataSourceBase } from "./helpers/derive-views";
import { emptyFileCoverage } from "./helpers/empty-coverage";
import { ThemeProvider, useTheme } from "./theme-context";
import type { FileCoverageData, ReportProps } from "./types";

const ReportContent: FC<ReportProps> = ({
  value,
  name,
  dataSource,
  onSelect,
  fileTagRules,
  statementWatermarks,
}) => {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [filenameKeywords, setFilenameKeywords] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showMode, setShowMode] = useState("tree");
  const [fileCoverage, setFileCoverage] = useState<FileCoverageData>(emptyFileCoverage);
  const [fileContent, setFileContent] = useState("");
  const rootId = useId().replaceAll(":", "");
  const rootClassName = `report-scope-${rootId} istanbul-html-modern`;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const requestSelect = (path: string) => {
    void onSelectRef.current(path);
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void onSelectRef
      .current(value)
      .then((res) => {
        if (cancelled) {
          return;
        }
        setFileContent(res.fileContent);
        setFileCoverage(res.fileCoverage);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  const isFile = useMemo(() => dataSource.some((item) => item.path === value), [dataSource, value]);
  const mode = isFile ? "file" : showMode;
  const isFileDataReady = isFile && !isLoading;

  const availableTags = useMemo(() => collectAvailableTags(fileTagRules), [fileTagRules]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tag of availableTags) {
      counts.set(tag, 0);
    }
    const baseRows = filterDataSourceBase({ dataSource, filenameKeywords, value });
    for (const row of baseRows) {
      for (const tag of row.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }, [availableTags, dataSource, filenameKeywords, value]);

  const { treeDataSource, rootDataSource, listDataSource } = useMemo(
    () =>
      deriveSummaryViews({
        dataSource,
        filenameKeywords,
        selectedTags,
        value,
      }),
    [dataSource, value, filenameKeywords, selectedTags],
  );

  return (
    <div className={rootClassName}>
      <TopControl
        filenameKeywords={filenameKeywords}
        showMode={showMode}
        onChangeShowMode={setShowMode}
        total={listDataSource.length}
        onChangeKeywords={setFilenameKeywords}
        availableTags={availableTags}
        tagCounts={tagCounts}
        selectedTags={selectedTags}
        onChangeSelectedTags={setSelectedTags}
      />
      <SummaryHeader
        reportName={name}
        data={rootDataSource}
        value={value}
        onSelect={requestSelect}
        statementWatermarks={statementWatermarks}
      />

      {mode === "file" ? (
        <div className="report-editor-body">
          {isFileDataReady ? (
            <CoverageDetail source={fileContent} coverage={fileCoverage} theme={theme} />
          ) : (
            <div className="report-loading" role="status">
              Loading file…
            </div>
          )}
        </div>
      ) : (
        <div className="report-scroll-body">
          {mode === "tree" && (
            <SummaryTree
              dataSource={treeDataSource}
              onSelect={requestSelect}
              statementWatermarks={statementWatermarks}
            />
          )}
          {mode === "list" && (
            <SummaryList
              dataSource={listDataSource}
              onSelect={requestSelect}
              filenameKeywords={filenameKeywords}
              statementWatermarks={statementWatermarks}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const Report: FC<ReportProps> = (props) => (
  <ThemeProvider>
    <ReportContent {...props} />
  </ThemeProvider>
);

export default Report;
export type { ReportProps };
