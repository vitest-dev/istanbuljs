import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import * as istanbulLibCoverage from "@vitest/istanbul-lib-coverage";
import { afterAll as after, assert, beforeAll as before, beforeEach, describe, it } from "vitest";

import * as istanbulLibReport from "../../../src/index";
import { FileWriter } from "../../../src/index";
import LcovOnlyReport from "../../../src/reports/lcovonly/index";

const require = createRequire(import.meta.url);

describe("LcovOnlyReport", () => {
  before(() => {
    FileWriter.startCapture();
  });
  after(() => {
    FileWriter.stopCapture();
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
      const report = new LcovOnlyReport({ file: "-", ...fixture.opts });
      tree.visit(report, context);
      const output = FileWriter.getOutput().replace(/SF:.*/, "SF:");
      if (fixture.lcovonlyExpected) {
        assert.equal(output, fixture.lcovonlyExpected);
      }
    });
  }

  fs.readdirSync(path.resolve(import.meta.dirname, "../fixtures/specs")).forEach((file) => {
    if (file.indexOf(".json") !== -1) {
      createTest(file);
    }
  });
});
