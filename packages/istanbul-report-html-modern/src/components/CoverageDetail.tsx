import { EditorState, Text } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { useEffect, useMemo, useRef } from "preact/hooks";

import {
  coverageHighlight,
  darkCoverageHighlight,
  darkEditorTheme,
  languageExtensionFromPath,
  lightEditorTheme,
} from "../codemirror";
import { annotateBranches, annotateFunctions, annotateStatements } from "../helpers/annotate";
import type { CoverageAnnotation } from "../helpers/annotate";
import { emptyFileCoverage } from "../helpers/empty-coverage";
import { computeLineHits } from "../helpers/line-hits";
import type { ThemeMode } from "../theme-context";
import type { FileCoverageData } from "../types";
import { coverageLineGutter, type LineState } from "./LineNumbers";

const UNCOVERED_HOVER: Record<CoverageAnnotation["type"], string> = {
  S: "Statement not covered",
  F: "Function not covered",
  B: "Branch not covered",
  I: "If path not taken",
  E: "Else path not taken",
};

/** Convert 1-based line/col (coverage annotation) to a CodeMirror document offset. */
function posAt(doc: Text, line: number, col: number): number {
  const clampedLine = Math.min(Math.max(line, 1), doc.lines);
  const lineObj = doc.line(clampedLine);
  return lineObj.from + Math.max(0, Math.min(col - 1, lineObj.length));
}

class BranchWidget extends WidgetType {
  constructor(readonly kind: "I" | "E") {
    super();
  }

  eq(other: BranchWidget): boolean {
    return this.kind === other.kind;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = this.kind === "I" ? "insert-i-decoration" : "insert-e-decoration";
    span.setAttribute("aria-label", UNCOVERED_HOVER[this.kind]);
    span.title = UNCOVERED_HOVER[this.kind];
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function buildCoverageDecorations(doc: Text, annotations: CoverageAnnotation[]) {
  const ranges = [];

  for (const item of annotations) {
    const from = posAt(doc, item.startLine, item.startCol);
    if (item.type === "I" || item.type === "E") {
      ranges.push(
        Decoration.widget({
          widget: new BranchWidget(item.type),
          side: -1,
        }).range(from),
      );
      continue;
    }

    const to = posAt(doc, item.endLine, item.endCol);
    if (to <= from) {
      continue;
    }
    ranges.push(
      Decoration.mark({
        class: item.type === "B" ? "content-class-no-found-branch" : "content-class-no-found",
        attributes: { title: UNCOVERED_HOVER[item.type] },
      }).range(from, to),
    );
  }

  // Sort by `from` + `startSide` — RangeSetBuilder requires pre-sorted input.
  return Decoration.set(ranges, true);
}

function createEditorExtensions(options: {
  filePath: string;
  theme: ThemeMode;
  linesState: LineState[];
  annotations: CoverageAnnotation[];
  doc: Text;
}): Extension[] {
  const { filePath, theme, linesState, annotations, doc } = options;
  const decorationSet = buildCoverageDecorations(doc, annotations);

  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    languageExtensionFromPath(filePath),
    theme === "dark" ? darkEditorTheme : lightEditorTheme,
    theme === "dark" ? darkCoverageHighlight : coverageHighlight,
    coverageLineGutter(linesState),
    EditorView.decorations.of(decorationSet),
  ];
}

const CoverageDetail = ({
  source,
  coverage,
  theme,
}: {
  source: string;
  coverage: FileCoverageData;
  theme: ThemeMode;
}) => {
  const fileCoverage = coverage.path === "" ? emptyFileCoverage : coverage;
  const { lines } = useMemo(() => computeLineHits(fileCoverage, source), [fileCoverage, source]);
  const ref = useRef<HTMLDivElement>(null);

  const linesState = useMemo(
    () =>
      lines.map((line, index) => ({
        lineNumber: index + 1,
        hit: line.executionNumber,
      })),
    [lines],
  );

  const annotations = useMemo(
    () => [
      ...annotateStatements(fileCoverage, source),
      ...annotateFunctions(fileCoverage, source),
      ...annotateBranches(fileCoverage, source),
    ],
    [fileCoverage, source],
  );

  useEffect(() => {
    const dom = ref.current;
    if (dom === null) {
      return;
    }

    const doc = Text.of(source.split(/\r?\n/));
    const view = new EditorView({
      parent: dom,
      state: EditorState.create({
        doc,
        extensions: createEditorExtensions({
          filePath: fileCoverage.path,
          theme,
          linesState,
          annotations,
          doc,
        }),
      }),
    });

    return () => {
      view.destroy();
    };
  }, [source, fileCoverage.path, linesState, annotations, theme]);

  return (
    <div className="coverage-detail-container">
      <div ref={ref} className="coverage-detail-editor" />
    </div>
  );
};

export default CoverageDetail;
