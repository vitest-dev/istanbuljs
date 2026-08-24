import { assert, describe, it } from "vitest";

import Context from "../src/context";
import FileWriter from "../src/file-writer";
import ReportBase from "../src/report-base";
import type { ReportNode } from "../src/summarizer-factory";
import { multiDir } from "./helpers/coverage-map";

describe("ReportBase", () => {
  it("has basic functionality", () => {
    const r = new ReportBase();
    assert.ok(r);

    const reached: { getTree?: boolean; visit?: boolean } = {};
    const context = {
      getTree() {
        assert.strictEqual(this, context);
        reached.getTree = true;
        const getTree = {
          visit(report: unknown, visitContext: unknown) {
            assert.strictEqual(this, getTree);
            assert.strictEqual(report, r);
            assert.strictEqual(visitContext, context);
            reached.visit = true;
          },
        };
        return getTree;
      },
    };
    r.execute(context as unknown as Context);
    assert.ok(reached.getTree);
    assert.ok(reached.visit);
  });

  it("works with real context", () => {
    const coverageMap = multiDir();
    const context = new Context({ coverageMap });
    const tree = context.getTree();
    const cw = context.writer.writeFile(null);

    class TestReport extends ReportBase {
      onStart(root: ReportNode, c: Context) {
        cw.println("[");
        assert.strictEqual(root, tree.root);
        assert.strictEqual(c, context);
      }

      onSummary(node: ReportNode, c: Context) {
        cw.println(`["onSummary", ${JSON.stringify(node.path.toString())}],`);
        assert.strictEqual(c, context);
      }

      onDetail(node: ReportNode, c: Context) {
        cw.println(`["onDetail", ${JSON.stringify(node.path.toString())}],`);
        assert.strictEqual(c, context);
      }

      onEnd(root: ReportNode, c: Context) {
        cw.println("null]");
        assert.strictEqual(root, tree.root);
        assert.strictEqual(c, context);
      }
    }
    FileWriter.startCapture();
    const r = new TestReport();
    r.execute(context);
    FileWriter.stopCapture();
    const content = FileWriter.getOutput();
    assert.match(content, /onSummary/);
    assert.match(content, /lib1\/file4\.js/);
    assert.match(content, /onDetail/);
    assert.match(content, /lib2\/sub1\/file2.js/);
    FileWriter.resetOutput();
  });
});
