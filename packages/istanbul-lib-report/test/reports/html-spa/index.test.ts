import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import * as istanbulLibCoverage from "@vitest/istanbul-lib-coverage";
import { afterAll as after, afterEach, assert, beforeAll as before, describe, it } from "vitest";

import * as istanbulLibReport from "../../../src/index";
import { FileWriter } from "../../../src/index";
import type { ContentWriter } from "../../../src/index";
import HtmlSpaReport from "../../../src/reports/html-spa/index";

const require = createRequire(import.meta.url);

interface CopyOperation {
  type: "copy";
  source: string;
  dest: string;
  header?: string;
}

interface WriteOperation {
  type: "write";
  contents: string;
  file: string | null;
  baseDir: string;
}

type Operation = CopyOperation | WriteOperation;

describe("html-spa", () => {
  let fileWriterCopyFile: typeof FileWriter.prototype.copyFile;
  let fileWriterWriteFile: typeof FileWriter.prototype.writeFile;
  let operations: Operation[] = [];
  before(() => {
    fileWriterCopyFile = FileWriter.prototype.copyFile;
    fileWriterWriteFile = FileWriter.prototype.writeFile;

    FileWriter.prototype.copyFile = function (source, dest, header) {
      operations.push({
        type: "copy",
        source,
        dest,
        header,
      });
    };
    FileWriter.prototype.writeFile = function (file) {
      const writeFileOp: WriteOperation = {
        type: "write",
        contents: "",
        file,
        baseDir: this.baseDir,
      };
      operations.push(writeFileOp);
      return {
        write(str: string) {
          writeFileOp.contents += str;
        },
        close() {},
      } as ContentWriter;
    };
  });
  afterEach(() => {
    operations = [];
  });
  after(() => {
    FileWriter.prototype.copyFile = fileWriterCopyFile;
    FileWriter.prototype.writeFile = fileWriterWriteFile;
  });

  function createTest(file: string) {
    const fixture = require(path.resolve(import.meta.dirname, "../fixtures/specs/" + file));
    it(fixture.title, () => {
      const context = istanbulLibReport.createContext({
        dir: "./",
        coverageMap: istanbulLibCoverage.createCoverageMap(fixture.map),
      });
      const tree = context.getTree("nested");
      const report = new HtmlSpaReport(fixture.opts);
      tree.visit(report, context);

      // copy operations should always be the same
      assert.deepEqual(
        operations.filter((op) => op.type === "copy"),
        [
          {
            type: "copy",
            source: path.join(import.meta.dirname, "../../../src/reports/html/assets/base.css"),
            dest: "./base.css",
            header: undefined,
          },
          {
            type: "copy",
            source: path.join(
              import.meta.dirname,
              "../../../src/reports/html/assets/block-navigation.js",
            ),
            dest: "./block-navigation.js",
            header: "/* eslint-disable */\n",
          },
          {
            type: "copy",
            source: path.join(import.meta.dirname, "../../../src/reports/html/assets/favicon.png"),
            dest: "./favicon.png",
            header: undefined,
          },
          {
            type: "copy",
            source: path.join(
              import.meta.dirname,
              "../../../src/reports/html/assets/sort-arrow-sprite.png",
            ),
            dest: "./sort-arrow-sprite.png",
            header: undefined,
          },
          {
            type: "copy",
            source: path.join(import.meta.dirname, "../../../src/reports/html/assets/sorter.js"),
            dest: "./sorter.js",
            header: "/* eslint-disable */\n",
          },
          {
            type: "copy",
            source: path.join(
              import.meta.dirname,
              "../../../src/reports/html/assets/vendor/prettify.css",
            ),
            dest: "./prettify.css",
            header: undefined,
          },
          {
            type: "copy",
            source: path.join(
              import.meta.dirname,
              "../../../src/reports/html/assets/vendor/prettify.js",
            ),
            dest: "./prettify.js",
            header: "/* eslint-disable */\n",
          },
          {
            type: "copy",
            source: path.join(
              import.meta.dirname,
              "../../../src/reports/html-spa/assets/sort-arrow-sprite.png",
            ),
            dest: "./sort-arrow-sprite.png",
            header: undefined,
          },
          {
            type: "copy",
            source: path.join(import.meta.dirname, "../../../src/reports/html-spa/assets/spa.css"),
            dest: "./spa.css",
            header: undefined,
          },
        ],
      );

      assert.deepEqual(
        operations
          .filter((op): op is WriteOperation => op.type === "write")
          .map((op) => path.join(op.baseDir, op.file as string)),
        fixture.htmlSpaFiles.map((p: string | string[]) =>
          path.join(...([] as string[]).concat(p)),
        ),
      );

      assert.deepEqual(
        JSON.parse(
          operations
            .filter(
              (op): op is WriteOperation => op.type === "write" && op.file === "index.html",
            )[0]
            .contents.match(/window\.data = ([^;]+);/)![1],
        ),
        fixture.htmlSpaCoverageData,
      );
    });
  }

  fs.readdirSync(path.resolve(import.meta.dirname, "../fixtures/specs")).forEach((file) => {
    if (file.indexOf(".json") !== -1) {
      createTest(file);
    }
  });
});
