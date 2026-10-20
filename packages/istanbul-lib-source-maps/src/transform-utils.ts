/*
 Copyright 2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import type { MappedCoverage } from "./mapped";

/** cache entry tracking the mapped coverage produced for a unique file */
export interface MappedCoverageEntry {
  file: string;
  mappedCoverage: MappedCoverage;
}

export function getUniqueKey(pathname: string): string {
  return pathname.replace(/[\\/]/g, "_");
}

export function getOutput(
  cache: Record<string, MappedCoverageEntry>,
): Record<string, MappedCoverage> {
  const output: Record<string, MappedCoverage> = {};

  for (const { file, mappedCoverage } of Object.values(cache)) {
    output[file] = mappedCoverage;
  }

  return output;
}
