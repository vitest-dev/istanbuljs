import { renderToStaticMarkup } from "react-dom/server";

interface LineState {
  lineNumber: number;
  hit: number;
}

function hitBackground(hit: number): string {
  if (hit > 0) {
    return "var(--report-line-hit-covered)";
  }
  if (hit === 0) {
    return "var(--report-line-hit-uncovered)";
  }
  return "var(--report-line-hit-neutral)";
}

function LineNumberWrapper({
  lineNumber,
  line,
  maxHitWidth,
}: {
  lineNumber: number;
  line: LineState;
  maxHitWidth: number;
}) {
  return (
    <div className="line-number-wrapper">
      <span className="line-number">{lineNumber}</span>
      <span
        className="line-coverage"
        style={{
          background: hitBackground(line.hit),
          width: `${maxHitWidth}px`,
        }}
      >
        {line.hit > 0 ? `${line.hit}x` : ""}
      </span>
    </div>
  );
}

/** Render Monaco line-number gutter HTML for a single line. */
export function renderLineNumberGutter(lineNumber: number, linesState: LineState[]): string {
  const line = linesState.find((item) => item.lineNumber === lineNumber) ?? {
    hit: -1,
    lineNumber,
  };

  const maxHit = Math.max(0, ...linesState.map((item) => item.hit));
  const digitWidth = maxHit.toString().length;
  const maxHitWidth = (digitWidth + 2) * 7.2;

  return renderToStaticMarkup(
    <LineNumberWrapper lineNumber={lineNumber} line={line} maxHitWidth={maxHitWidth} />,
  );
}
