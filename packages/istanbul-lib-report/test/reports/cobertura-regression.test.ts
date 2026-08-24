import * as istanbulLibCoverage from "@vitest/istanbul-lib-coverage";
import { it } from "vitest";

import * as istanbulLibReport from "../../src/index";
import { FileWriter } from "../../src/index";
import Report from "../../src/reports/cobertura/index";

it("issue 384", () => {
  const context = istanbulLibReport.createContext({
    dir: "./",
    coverageMap: istanbulLibCoverage.createCoverageMap({}),
  });
  const tree = context.getTree("pkg");
  const report = new Report({ file: "-" });

  FileWriter.startCapture();
  tree.visit(report, context);
  FileWriter.stopCapture();
});
