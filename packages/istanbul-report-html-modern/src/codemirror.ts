import { javascript } from "@codemirror/lang-javascript";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { oneDarkHighlightStyle, oneDarkTheme } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

/** Map coverage file paths to CodeMirror language extensions (JS/TS only). */
export function languageExtensionFromPath(filePath: string): Extension {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "mts":
    case "cts":
    case "tsx":
      return javascript({ typescript: true, jsx: ext === "tsx" });
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return javascript({ jsx: ext === "jsx" });
    default:
      return [];
  }
}

export const coverageHighlight = syntaxHighlighting(defaultHighlightStyle, { fallback: true });

export const darkCoverageHighlight = syntaxHighlighting(oneDarkHighlightStyle, { fallback: true });

const baseEditorChrome = {
  "&": {
    height: "100%",
    fontSize: "12px",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    lineHeight: "18px",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "0",
    caretColor: "transparent",
  },
  ".cm-coverage-gutter": {
    minWidth: "auto",
  },
  ".cm-coverage-gutter .cm-gutterElement": {
    padding: "0 4px 0 0",
  },
} as const;

export const lightEditorTheme = EditorView.theme(
  {
    ...baseEditorChrome,
    ".cm-gutters": {
      border: "none",
      backgroundColor: "var(--report-bg) !important",
    },
  },
  { dark: false },
);

export const darkEditorTheme: Extension = [
  oneDarkTheme,
  EditorView.theme(
    {
      ...baseEditorChrome,
      "&": {
        ...baseEditorChrome["&"],
        backgroundColor: "var(--report-bg) !important",
      },
      ".cm-gutters": {
        border: "none",
        backgroundColor: "var(--report-bg) !important",
      },
    },
    { dark: true },
  ),
];
