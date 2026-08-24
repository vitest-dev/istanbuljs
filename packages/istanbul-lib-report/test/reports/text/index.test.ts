import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import * as istanbulLibCoverage from "@vitest/istanbul-lib-coverage";
import {
  afterAll as after,
  assert,
  beforeAll as before,
  beforeEach,
  describe,
  it,
  vi,
} from "vitest";

import * as istanbulLibReport from "../../../src/index";
import { FileWriter } from "../../../src/index";
import TextReport from "../../../src/reports/text/index";

const require = createRequire(import.meta.url);

describe("TextReport", () => {
  before(() => {
    // the fixtures contain ANSI colour codes, so force colours regardless of
    // whether the test runner's stdout is a TTY
    vi.stubEnv("FORCE_COLOR", "1");
    FileWriter.startCapture();
  });
  after(() => {
    FileWriter.stopCapture();
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    FileWriter.resetOutput();
  });

  function createTest(file: string) {
    const fixture = require(path.resolve(import.meta.dirname, "../fixtures/specs/" + file));
    it(fixture.title, () => {
      const context = istanbulLibReport.createContext({
        dir: "./",
        coverageMap: istanbulLibCoverage.createCoverageMap(fixture.map),
      });
      const tree = context.getTree("pkg");
      const report = new TextReport(fixture.opts);
      tree.visit(report, context);
      const output = FileWriter.getOutput();
      assert.equal(output, fixture.textReportExpected);
    });
  }

  fs.readdirSync(path.resolve(import.meta.dirname, "../fixtures/specs")).forEach((file) => {
    if (file.indexOf(".json") !== -1) {
      createTest(file);
    }
  });
});
