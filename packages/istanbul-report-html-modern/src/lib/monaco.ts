import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution";
import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/typescript/register";

export { monaco };

/** Map coverage file paths to Monaco languages (JS/TS only; others use plaintext). */
export function languageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "mts":
    case "cts":
    case "tsx":
      return "typescript";
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return "javascript";
    default:
      return "plaintext";
  }
}
