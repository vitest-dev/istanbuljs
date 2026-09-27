import picomatch from "picomatch";

import type { FileTagRule } from "./file-tags";

export { collectAvailableTags } from "./file-tags";

/** Map project-relative paths to tags matched by {@link rules}. */
export function resolveFileTags(
  relativePaths: readonly string[],
  rules: FileTagRule[] | undefined,
  options: { verbose?: boolean } = {},
): Record<string, string[]> {
  if (rules === undefined || rules.length === 0) {
    return {};
  }

  const seenTags = new Set<string>();
  const matchers = rules.map((rule) => {
    if (seenTags.has(rule.tag) && options.verbose) {
      console.warn(`@vitest/istanbul-report-html-modern: duplicate fileTags tag "${rule.tag}"`);
    }
    seenTags.add(rule.tag);
    return {
      tag: rule.tag,
      isMatch: picomatch(rule.glob, { dot: true }),
    };
  });

  const fileTagsByPath: Record<string, string[]> = {};
  for (const relativePath of relativePaths) {
    const normalizedPath = relativePath.replaceAll("\\", "/");
    const tags: string[] = [];
    for (const matcher of matchers) {
      if (matcher.isMatch(normalizedPath)) {
        tags.push(matcher.tag);
      }
    }
    if (tags.length > 0) {
      fileTagsByPath[normalizedPath] = tags;
    }
  }

  return fileTagsByPath;
}
