declare module "monaco-editor-css" {}

declare module "@repo/fixtures/report-data.json" {
  const reportData: {
    html: Record<string, unknown>;
    istanbul: Record<string, unknown>;
    stats: {
      coverageFileCount: number;
      sourceFileCount: number;
    };
    projectRoot: string;
    coverage: Record<string, unknown>;
    sources: Record<string, string>;
  };
  export default reportData;
}
