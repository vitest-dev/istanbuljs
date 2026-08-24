import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import App from "../../src/reports/html-spa/src/app";
import { coverageFixture } from "./helpers";

let container: HTMLElement;

function rowFiles(): string[] {
  return [...container.querySelectorAll("tbody td.file")].map(
    (cell) => cell.querySelector("a")!.textContent,
  );
}

describe("html-spa app", () => {
  beforeEach(() => {
    history.replaceState(null, "", "#");
    window.data = coverageFixture();
    window.metricsToShow = ["statements", "lines"];
    window.generatedDatetime = "Sat Aug 22 2026 12:00:00 GMT+0300";

    container = document.createElement("div");
    document.body.appendChild(container);
    render(<App />, container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
    history.replaceState(null, "", "#");
  });

  it("renders the overall metrics for the selected metrics only", async () => {
    const screen = page.elementLocator(container);

    await expect.element(screen.getByText("Statements").first()).toBeVisible();
    await expect.element(screen.getByText("Lines").first()).toBeVisible();
    expect(screen.getByText("Branches").elements()).toHaveLength(0);
    expect(screen.getByText("Functions").elements()).toHaveLength(0);

    // the overall percentage is shown once per selected metric
    expect(screen.getByText("72.5%").elements()).toHaveLength(2);
  });

  it("renders a summary row per top-level child", async () => {
    const screen = page.elementLocator(container);

    await expect.element(screen.getByRole("link", { name: "src" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "top.js" })).toBeVisible();
    expect(rowFiles()).toEqual(["src", "top.js"]);
  });

  it("expands and collapses directories", async () => {
    const screen = page.elementLocator(container);

    await screen.getByRole("button", { name: "+" }).click();

    await expect.element(screen.getByRole("link", { name: "high.js" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "nested" })).toBeVisible();

    await screen.getByRole("button", { name: "–" }).first().click();
    await expect.element(screen.getByRole("link", { name: "high.js" })).not.toBeInTheDocument();
    expect(rowFiles()).toEqual(["src", "top.js"]);
  });

  it("filters rows by coverage class", async () => {
    const screen = page.elementLocator(container);

    await screen.getByRole("button", { name: "Medium" }).click();
    await expect.element(screen.getByRole("link", { name: "top.js" })).not.toBeInTheDocument();
    await expect.element(screen.getByRole("link", { name: "src" })).toBeVisible();

    await screen.getByRole("button", { name: "Medium" }).click();
    await expect.element(screen.getByRole("link", { name: "top.js" })).toBeVisible();
  });

  it("flattens the tree", async () => {
    const screen = page.elementLocator(container);

    await screen.getByRole("button", { name: "Flat" }).click();

    await expect.element(screen.getByRole("link", { name: "src/high.js" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "src/nested/low.js" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "top.js" })).toBeVisible();
    expect(screen.getByRole("button", { name: "+" }).elements()).toHaveLength(0);
  });

  it("drills into a directory and back out through breadcrumbs", async () => {
    const screen = page.elementLocator(container);

    await screen.getByRole("link", { name: "src" }).click();

    await expect.element(screen.getByRole("link", { name: "all files" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "high.js" })).toBeVisible();
    await expect.element(screen.getByRole("link", { name: "top.js" })).not.toBeInTheDocument();
    await expect.poll(() => location.hash).toContain("src");

    await screen.getByRole("link", { name: "all files" }).click();
    await expect.element(screen.getByRole("link", { name: "top.js" })).toBeVisible();
  });

  it("sorts by file name when the header is clicked", async () => {
    const screen = page.elementLocator(container);

    expect(rowFiles()).toEqual(["src", "top.js"]);

    await screen.getByRole("columnheader", { name: "File" }).click();
    await expect.poll(() => rowFiles()).toEqual(["top.js", "src"]);
  });

  it("renders the generation info", async () => {
    const screen = page.elementLocator(container);

    await expect
      .element(screen.getByText("Sat Aug 22 2026 12:00:00 GMT+0300", { exact: false }))
      .toBeVisible();
  });
});
