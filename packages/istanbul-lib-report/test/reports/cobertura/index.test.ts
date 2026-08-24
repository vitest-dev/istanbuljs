import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import * as istanbulLibCoverage from "@vitest/istanbul-lib-coverage";
import { afterAll as after, assert, beforeAll as before, beforeEach, describe, it } from "vitest";

import * as istanbulLibReport from "../../../src/index";
import { FileWriter } from "../../../src/index";
import CoberturaReport from "../../../src/reports/cobertura/index";

const require = createRequire(import.meta.url);

/**
 * `filename` attributes come from `path.relative()`, which uses backslashes
 * on Windows. The fixtures were generated on POSIX, so compare with forward
 * slashes on every platform.
 */
function normalizeFilenames(xml: string): string {
  return xml.replace(/filename="([^"]*)"/g, (_, filename: string) => {
    return `filename="${filename.replaceAll("\\", "/")}"`;
  });
}

describe("CoberturaReport", () => {
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
      const report = new CoberturaReport({
        file: "-",
        timestamp: "123456789",
        ...fixture.opts,
      });
      tree.visit(report, context);
      const output = FileWriter.getOutput();
      assert.equal(normalizeFilenames(output), fixture.coberturaCoverageData);
    });
  }

  fs.readdirSync(path.resolve(import.meta.dirname, "../fixtures/specs")).forEach((file) => {
    if (file.indexOf(".json") !== -1) {
      createTest(file);
    }
  });
});
