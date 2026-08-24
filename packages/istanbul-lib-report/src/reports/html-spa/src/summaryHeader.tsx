import type { CoverageNode, MetricKey, MetricsToShow, MetricSummary } from "./types";

interface IgnoresProps {
  metrics: CoverageNode["metrics"];
  metricsToShow: MetricsToShow;
}

function Ignores({ metrics, metricsToShow }: IgnoresProps) {
  const metricKeys = Object.keys(metricsToShow) as MetricKey[];
  const result: string[] = [];

  for (let i = 0; i < metricKeys.length; i++) {
    const metricKey = metricKeys[i];
    if (metricsToShow[metricKey]) {
      const skipped = metrics[metricKey].skipped;
      if (skipped > 0) {
        result.push(
          `${skipped} ${metricKey}${skipped === 1 ? "" : metricKey === ("branch" as string) ? "es" : "s"}`,
        );
      }
    }
  }

  if (result.length === 0) {
    return null;
  }

  return (
    <div className="toolbar__item">
      <span className="strong">{result.join(", ")}</span>
      <span className="quiet">Ignored</span>
    </div>
  );
}

interface StatusMetricProps {
  data: MetricSummary;
  name: string;
}

function StatusMetric({ data, name }: StatusMetricProps) {
  return (
    <div className="toolbar__item">
      <span className="strong">{data.pct}%</span> <span className="quiet">{name}</span>{" "}
      <span className={"fraction " + data.classForPercent}>
        {data.covered}/{data.total}
      </span>
    </div>
  );
}

interface SummaryHeaderProps {
  metrics: CoverageNode["metrics"];
  metricsToShow: MetricsToShow;
}

export default function SummaryHeader({ metrics, metricsToShow }: SummaryHeaderProps) {
  return (
    <div className="toolbar">
      {metricsToShow.statements && <StatusMetric data={metrics.statements} name="Statements" />}
      {metricsToShow.branches && <StatusMetric data={metrics.branches} name="Branches" />}
      {metricsToShow.functions && <StatusMetric data={metrics.functions} name="Functions" />}
      {metricsToShow.lines && <StatusMetric data={metrics.lines} name="Lines" />}
      <Ignores metrics={metrics} metricsToShow={metricsToShow} />
    </div>
  );
}
