import { base64ToUint8Array, decompressGzip } from "./decompress.ts";
import type { ReportData } from "./report-data.ts";

/**
 * Decode gzip+base64 `window.reportData` (as embedded by the html-modern reporter)
 * into a plain object. No-op when data is already an object.
 */
export async function loadReportData(): Promise<void> {
  const embeddedReportData = window.reportData as ReportData | string | undefined;

  if (typeof embeddedReportData !== "string") {
    return;
  }

  const decompressedText = await decompressGzip(base64ToUint8Array(embeddedReportData));
  window.reportData = JSON.parse(decompressedText) as ReportData;
}

/** Load mock report data in Vite dev (same source as the playground). */
export async function loadDevReportData(): Promise<void> {
  if (import.meta.env.DEV) {
    const { default: reportData } = await import("@repo/fixtures/report-data.json");
    window.reportData = reportData as ReportData;
    return;
  }

  await loadReportData();
}
