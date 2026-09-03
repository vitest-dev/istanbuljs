import { type FC, useCallback, useMemo } from "react";

import { emptyFileCoverage } from "./helpers/empty-coverage";
import { filesToDataSource } from "./helpers/summary";
import { projectRootBaseName, toRelativePath } from "./paths";
import { Report } from "./Report";
import type { FileDataResponse, ReportAppProps } from "./types";
import { useHashPath } from "./useHashPath";

export const ReportApp: FC<ReportAppProps> = ({
  files = [],
  projectRoot,
  name,
  defaultValue = "",
}) => {
  const [value, setValue] = useHashPath(defaultValue);

  const relativeFiles = useMemo(() => {
    return files.map((item) => ({
      ...item,
      path: toRelativePath(item.path, projectRoot),
    }));
  }, [files, projectRoot]);

  const dataSource = useMemo(() => filesToDataSource(relativeFiles), [relativeFiles]);
  const reportName = name ?? projectRootBaseName(projectRoot);

  const onSelect = useCallback(
    (val: string): Promise<FileDataResponse> => {
      setValue(val);
      const file = relativeFiles.find((item) => item.path === val);
      if (file === undefined) {
        return Promise.resolve({
          fileCoverage: emptyFileCoverage,
          fileContent: "",
        });
      }
      return Promise.resolve({
        fileCoverage: file,
        fileContent: file.source,
      });
    },
    [relativeFiles, setValue],
  );

  return (
    <div style={{ height: "100%" }}>
      <Report name={reportName} value={value} dataSource={dataSource} onSelect={onSelect} />
    </div>
  );
};

export default ReportApp;
