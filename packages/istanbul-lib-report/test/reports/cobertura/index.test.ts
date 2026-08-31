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
  expect,
  it,
} from "vitest";

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

  it("emits unique method names when fnMap has collisions", () => {
    const context = istanbulLibReport.createContext({
      dir: "./",
      coverageMap: istanbulLibCoverage.createCoverageMap({
        "/tmp/models.js": {
          path: "/tmp/models.js",
          statementMap: {},
          fnMap: {
            0: {
              name: "constructor",
              decl: {
                start: { line: 2, column: 4 },
                end: { line: 2, column: 20 },
              },
              loc: {
                start: { line: 2, column: 4 },
                end: { line: 4, column: 5 },
              },
              line: 2,
            },
            1: {
              name: "constructor",
              decl: {
                start: { line: 8, column: 4 },
                end: { line: 8, column: 20 },
              },
              loc: {
                start: { line: 8, column: 4 },
                end: { line: 10, column: 5 },
              },
              line: 8,
            },
            2: {
              name: "(anonymous_0)",
              decl: {
                start: { line: 12, column: 0 },
                end: { line: 12, column: 10 },
              },
              loc: {
                start: { line: 12, column: 0 },
                end: { line: 14, column: 1 },
              },
              line: 12,
            },
            3: {
              name: "(anonymous_0)",
              decl: {
                start: { line: 16, column: 0 },
                end: { line: 16, column: 10 },
              },
              loc: {
                start: { line: 16, column: 0 },
                end: { line: 18, column: 1 },
              },
              line: 16,
            },
          },
          branchMap: {},
          s: {},
          f: { 0: 1, 1: 1, 2: 1, 3: 1 },
          b: {},
        },
      }),
    });
    const tree = context.getTree("pkg");
    const report = new CoberturaReport({
      file: "-",
      timestamp: "123456789",
      projectRoot: "/tmp",
    });
    tree.visit(report, context);
    const output = FileWriter.getOutput();
    const names: string[] = [];
    const re = /<method name="([^"]+)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(output))) {
      names.push(match[1]);
    }
    expect(names).toEqual(["constructor", "constructor_2", "(anonymous_0)", "(anonymous_1)"]);
  });
});
