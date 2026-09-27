/** glob rule that assigns a tag to matching project-relative file paths */
export interface FileTagRule {
  /** glob relative to project root, e.g. `src/payments/**` */
  glob: string;
  /** display tag, e.g. `payments` or `P0` */
  tag: string;
}

/** Unique tag names in config order. */
export function collectAvailableTags(rules: FileTagRule[] | undefined): string[] {
  if (rules === undefined || rules.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const rule of rules) {
    if (seen.has(rule.tag)) {
      continue;
    }
    seen.add(rule.tag);
    tags.push(rule.tag);
  }
  return tags;
}
