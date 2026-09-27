import { render } from "preact";

import { loadDevReportData } from "./load-data";
import ReportShell from "./shell";

await loadDevReportData();

render(<ReportShell />, document.getElementById("root")!);
