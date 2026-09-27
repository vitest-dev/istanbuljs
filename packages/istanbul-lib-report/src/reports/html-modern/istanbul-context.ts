import type { Context, Summarizers } from "../../index";
import type { IstanbulReportContext } from "./types";

interface ContextWithSummarizerFactory {
  _summarizerFactory?: {
    _defaultSummarizer: Summarizers;
  };
}

function getDefaultSummarizer(context: Context): Summarizers {
  const factory = (context as unknown as ContextWithSummarizerFactory)._summarizerFactory;
  return factory?._defaultSummarizer ?? "pkg";
}

function getSourceFinderKind(sourceFinder: (filePath: string) => string): "filesystem" | "custom" {
  const { name } = sourceFinder;
  if (name === "defaultSourceLookup" || name === "bound defaultSourceLookup") {
    return "filesystem";
  }

  return "custom";
}

/** extract serializable istanbul context fields for the HTML report */
export function extractIstanbulContext(
  context: Context,
  summarizer?: Summarizers,
): IstanbulReportContext {
  const defaultSummarizer = getDefaultSummarizer(context);

  return {
    dir: context.dir,
    watermarks: context.watermarks,
    defaultSummarizer,
    sourceFinder: getSourceFinderKind(context.sourceFinder),
    ...(summarizer !== undefined ? { summarizer } : {}),
  };
}
