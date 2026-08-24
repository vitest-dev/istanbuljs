import fs from "node:fs";
import path from "node:path";

import clone from "clone";
import { assert, describe, it, expect } from "vitest";
import { parseAllDocuments } from "yaml";

import * as guards from "./util/guards";
import * as verifier from "./util/verifier";

const dir = path.resolve(import.meta.dirname, "specs");
const files = fs.readdirSync(dir).filter((f) => {
  let match = true;
  if (process.env.FILTER) {
    match = new RegExp(`.*${process.env.FILTER}.*`).test(f);
  }
  return f.match(/\.yaml$/) && match;
});

class NonPojo {
  constructor(props: object) {
    Object.assign(this, props);
  }
}

function loadDocs() {
  const docs: any[] = [];
  files.forEach((f) => {
    const filePath = path.resolve(dir, f);
    const contents = fs.readFileSync(filePath, "utf8");
    try {
      for (const doc of parseAllDocuments(contents)) {
        if (doc.errors.length > 0) {
          throw doc.errors[0];
        }
        const obj = doc.toJS();
        obj.file = f;
        docs.push(obj);
      }
    } catch (ex: any) {
      docs.push({
        file: f,
        name: "loaderr",
        err: "Unable to load file [" + f + "]\n" + ex.message + "\n" + ex.stack,
      });
    }
  });
  return docs;
}

function generateTests(docs: any[]) {
  docs.forEach((doc) => {
    const guard: string = doc.guard;
    const guardFns = guards as Record<string, () => boolean>;
    let skip = false;
    let skipText = "";

    if (guard && guardFns[guard]) {
      if (!guardFns[guard]()) {
        skip = true;
        skipText = "[SKIP] ";
      }
    }

    describe(skipText + doc.file + "/" + (doc.name || "suite"), () => {
      if (doc.err) {
        it("has errors", () => {
          expect.fail(doc.err);
        });
      } else if (!doc.tests || !doc.tests.length) {
        it("generate only test", () => {
          assert(doc.opts.generateOnly, `Suite ${doc.file} has no tests and is not generateOnly`);
        });
      } else {
        doc.tests.forEach((t: any) => {
          const fn = async function () {
            const genOnly = (doc.opts || {}).generateOnly;
            const noCoverage = (doc.opts || {}).noCoverage;
            if (doc.inputSourceMapClass) {
              doc.inputSourceMap = new NonPojo(doc.inputSourceMap);
            }
            const v = verifier.create(
              doc.code,
              doc.opts || {},
              doc.instrumentOpts,
              doc.inputSourceMap,
            );
            const test = clone(t);
            const args = test.args;
            const out = test.out;
            delete test.args;
            delete test.out;
            if (!genOnly && !noCoverage) {
              await v.verify(args, out, test);
            }
            if (noCoverage) {
              assert.equal(v.code, v.generatedCode);
            }
          };
          if (skip) {
            it.skip(t.name || "default test", fn);
          } else {
            it(t.name || "default test", fn);
          }
        });
      }
    });
  });
}

generateTests(loadDocs());
