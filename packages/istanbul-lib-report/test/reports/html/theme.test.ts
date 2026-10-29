import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, it, onTestFinished } from "vitest";

import { createContext } from "../../../src/index";
import HtmlSpaReport from "../../../src/reports/html-spa/index";
import HtmlReport from "../../../src/reports/html/index";
import type { HtmlOptions } from "../../../src/reports/html/index";
import { empty } from "../../helpers/coverage-map";

function renderIndex(opts: HtmlOptions, report = new HtmlReport(opts)): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "html-theme-"));
  onTestFinished(() => fs.rmSync(dir, { recursive: true, force: true }));

  const context = createContext({ dir, coverageMap: empty });
  report.execute(context);

  return fs.readFileSync(path.join(dir, "index.html"), "utf8");
}

it("lets the viewer pick the theme by default", () => {
  const html = renderIndex({});
  expect(html).toContain('<html lang="en">');
  expect(html).toContain('<select id="themeSelect" autocomplete="off">');
  expect(html).toContain('<script src="theme.js"></script>');
});

it.for(["light", "dark", "legacy"] as const)("fixes the `%s` theme option", (theme) => {
  const html = renderIndex({ theme });
  expect(html).toContain(`<html lang="en" data-theme="${theme}">`);
  expect(html).not.toContain("themeSelect");
  expect(html).not.toContain("theme.js");
});

it("fixes html-spa file pages to the legacy theme", () => {
  const html = renderIndex({}, new HtmlSpaReport({}).htmlReport);
  expect(html).toContain('<html lang="en" data-theme="legacy">');
  expect(html).not.toContain("themeSelect");
  expect(html).not.toContain("theme.js");
});
