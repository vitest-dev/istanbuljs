import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "monaco-editor-css";

import { loadDevReportData } from "./load-data.ts";
import ReportShell from "./shell.tsx";

await loadDevReportData();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReportShell />
  </StrictMode>,
);
