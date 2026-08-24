import { render } from "preact";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";

import SummaryHeader from "../../src/reports/html-spa/src/summaryHeader";
import { metricsOf } from "./helpers";

let container: HTMLElement;

describe("SummaryHeader", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it("renders only the selected metrics", async () => {
    render(
      <SummaryHeader metrics={metricsOf(80, "high")} metricsToShow={{ branches: true }} />,
      container,
    );
    const screen = page.elementLocator(container);

    await expect.element(screen.getByText("Branches")).toBeVisible();
    await expect.element(screen.getByText("80%")).toBeVisible();
    expect(screen.getByText("Statements").elements()).toHaveLength(0);
    expect(screen.getByText("Lines").elements()).toHaveLength(0);
  });

  it("shows ignored counts when metrics were skipped", async () => {
    const metrics = metricsOf(80, "high");
    metrics.statements.skipped = 3;

    render(
      <SummaryHeader metrics={metrics} metricsToShow={{ statements: true, lines: true }} />,
      container,
    );
    const screen = page.elementLocator(container);

    await expect.element(screen.getByText("Ignored")).toBeVisible();
    await expect.element(screen.getByText(/3 statements/)).toBeVisible();
  });

  it("omits the ignored block when nothing was skipped", async () => {
    render(
      <SummaryHeader metrics={metricsOf(80, "high")} metricsToShow={{ statements: true }} />,
      container,
    );
    const screen = page.elementLocator(container);

    await expect.element(screen.getByText("Statements")).toBeVisible();
    expect(screen.getByText("Ignored").elements()).toHaveLength(0);
  });
});
