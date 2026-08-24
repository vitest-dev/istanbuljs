import { fileURLToPath } from "node:url";

import { createCoverageMap } from "@vitest/istanbul-lib-coverage";
import { describe, it, expect } from "vitest";

import { create, createAsync, createContext, ReportBase } from "../src/index";
import type { PartialVisitor, ReportNode } from "../src/index";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/custom-reports/${name}`, import.meta.url));

describe("create", () => {
  it("creates built-in reports", () => {
    expect(create("text")).toBeInstanceOf(ReportBase);
    expect(create("json", { file: "out.json" })).toBeInstanceOf(ReportBase);
  });

  it("throws for unknown reports", () => {
    expect(() => create("does-not-exist" as "text")).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unknown report "does-not-exist". Use createAsync() to load custom reports.]`,
    );
  });

  it("does not resolve names via the Object prototype", () => {
    expect(() => create("constructor" as "text")).toThrow(/Unknown report/);
  });
});

describe("createAsync", () => {
  it("creates built-in reports", async () => {
    const report = await createAsync("text");
    expect(report).toBeInstanceOf(ReportBase);
  });

  it("does not resolve names via the Object prototype", async () => {
    await expect(createAsync("toString")).rejects.toThrow();
  });

  it.each([
    ["CommonJS", "cjs.cjs", "CjsReport"],
    ["CommonJS transpiled from ESM", "cjs-transpiled.cjs", "TranspiledReport"],
    ["ESM", "esm.mjs", "EsmReport"],
    ["ESM with top-level await", "esm-tla.mjs", "EsmTlaReport"],
  ])("loads a custom %s report from an absolute path", async (_, file, className) => {
    const cfg = { file: "out.md" };
    const report = (await createAsync(fixture(file), cfg)) as unknown as { opts: object };

    expect(report.constructor.name).toBe(className);
    expect(report.opts).toBe(cfg);
  });

  it("loads a custom report from a file:// URL", async () => {
    const url = new URL("./fixtures/custom-reports/esm.mjs", import.meta.url).href;
    const report = await createAsync(url);
    expect(report.constructor.name).toBe("EsmReport");
  });

  it.each([
    ["CommonJS", "cjs.cjs", ["start cjs", "end cjs"]],
    ["ESM", "esm.mjs", ["start esm", "end esm"]],
  ])("runs a custom %s report through the report tree", async (_, file, lines) => {
    const report = (await createAsync(fixture(file))) as unknown as PartialVisitor<ReportNode> & {
      lines: string[];
    };
    const context = createContext({ coverageMap: createCoverageMap({}) });

    context.getTree().visit(report, context);

    expect(report.lines).toEqual(lines);
  });

  it("rejects modules without a report class as default export", async () => {
    await expect(createAsync(fixture("named-only.mjs"))).rejects.toThrow(
      /must export a report class as its default export/,
    );
  });

  it("rejects unresolvable reports", async () => {
    await expect(createAsync("@vitest/this-report-does-not-exist")).rejects.toThrow();
  });
});
