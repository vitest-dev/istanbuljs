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

  it("replaces an empty skipFull table with a fully-covered summary", () => {
    const fixture = require(
      path.resolve(import.meta.dirname, "../fixtures/specs/100-line-100-branch.json"),
    );
    const context = istanbulLibReport.createContext({
      dir: "./",
      coverageMap: istanbulLibCoverage.createCoverageMap(fixture.map),
    });
    const tree = context.getTree("pkg");
    const report = new TextReport({ ...fixture.opts, skipFull: true });
    tree.visit(report, context);
    assert.equal(
      FileWriter.getOutput(),
      "No files with missing coverage.\n1 file fully covered.\n",
    );
  });

  describe("skipFull with multiple files", () => {
    function fixtureFile(spec: string, filePath: string) {
      const fixture = require(path.resolve(import.meta.dirname, "../fixtures/specs/" + spec));
      const fileCoverage = Object.values(fixture.map)[0] as istanbulLibCoverage.FileCoverageData;
      return { [filePath]: { ...fileCoverage, path: filePath } };
    }

    function render(files: Record<string, istanbulLibCoverage.FileCoverageData>[]) {
      const context = istanbulLibReport.createContext({
        dir: "./",
        coverageMap: istanbulLibCoverage.createCoverageMap(Object.assign({}, ...files)),
      });
      context.getTree("pkg").visit(new TextReport({ maxCols: 80, skipFull: true }), context);
      return FileWriter.getOutput();
    }

    const full = (filePath: string) => fixtureFile("100-line-100-branch.json", filePath);
    const empty = (filePath: string) => fixtureFile("empty-file.json", filePath);
    const partial = (filePath: string) => fixtureFile("missing-line-missing-branch.json", filePath);

    it("counts fully covered and empty files separately", () => {
      const output = render([full("/src/a.js"), full("/src/nested/b.js"), empty("/src/e.js")]);
      assert.equal(
        output,
        "No files with missing coverage.\n2 files fully covered.\n1 empty file skipped.\n",
      );
    });

    it("only reports empty files when nothing is fully covered", () => {
      const output = render([empty("/src/e.js"), empty("/src/f.js")]);
      assert.equal(output, "No files with missing coverage.\n2 empty files skipped.\n");
    });

    it("prints the table when a file is partially covered", () => {
      const output = render([full("/src/full.js"), empty("/src/e.js"), partial("/src/partial.js")]);
      assert.include(output, "partial.js");
      assert.notInclude(output, "full.js");
      assert.notInclude(output, "e.js");
      assert.notInclude(output, "No files with missing coverage.");
    });
  });
});
