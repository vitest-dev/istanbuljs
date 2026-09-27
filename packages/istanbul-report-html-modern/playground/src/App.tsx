import reportData from "@repo/fixtures/report-data.json";
import { resolveFileTags } from "@vitest/istanbul-lib-report";

import "@vitest/istanbul-report-html-modern/style.css";
import { buildReportFiles, ReportApp } from "@vitest/istanbul-report-html-modern";
import type { FileCoverageData, FileTagRule } from "@vitest/istanbul-report-html-modern";
import { useMemo } from "preact/hooks";

import { toRelativePath } from "../../src/paths";

const playgroundFileTags: FileTagRule[] = [
  { glob: "src/**", tag: "src" },
  { glob: "src/helpers/**", tag: "helpers" },
  { glob: "src/components/**", tag: "ui" },
  { glob: "test/**", tag: "tests" },
];

export function App() {
  const prepared = useMemo(() => {
    const built = buildReportFiles({
      projectRoot: reportData.projectRoot,
      coverage: reportData.coverage as Record<string, FileCoverageData>,
      sources: reportData.sources,
      fileTagRules: playgroundFileTags,
    });

    const relativePaths = built.files.map((file) => toRelativePath(file.path, built.projectRoot));
    const fileTagsByPath = resolveFileTags(relativePaths, playgroundFileTags);

    return {
      ...built,
      fileTagRules: playgroundFileTags,
      fileTagsByPath,
    };
  }, []);

  return (
    <ReportApp
      files={prepared.files}
      projectRoot={prepared.projectRoot}
      name={prepared.name || "playground"}
      fileTagRules={prepared.fileTagRules}
      fileTagsByPath={prepared.fileTagsByPath}
    />
  );
}
