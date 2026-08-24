/*
 Copyright 2015, Yahoo Inc.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
import type { TraceMap } from "@jridgewell/trace-mapping";
import * as libCoverage from "@vitest/istanbul-lib-coverage";
import type { CoverageMap, FileCoverage, Location, Range } from "@vitest/istanbul-lib-coverage";
import { createDebug } from "obug";

import getMapping from "./get-mapping";
import type { Mapping } from "./get-mapping";
import { MappedCoverage } from "./mapped";
import { getUniqueKey, getOutput } from "./transform-utils";
import type { MappedCoverageEntry } from "./transform-utils";

const debug = createDebug("istanbuljs");

/**
 * a function that resolves the source map for a file, or a falsy value when
 * no source map applies to the file
 */
export type SourceMapFinder = (
  filePath: string,
  fileCoverage: FileCoverage,
) => TraceMap | null | undefined | Promise<TraceMap | null | undefined>;

/** a function that maps a generated range back to an original source */
export type GetMapping = (
  sourceMap: TraceMap,
  generatedLocation: Range,
  origFile: string,
) => Mapping | null;

export interface SourceMapTransformerOptions {
  baseDir?: string;
  getMapping?: GetMapping;
}

/** a partial position whose members may be missing entirely */
type PartialPosition = Partial<Location> & { end?: unknown };

export class SourceMapTransformer {
  finder: SourceMapFinder;
  baseDir: string;
  resolveMapping: GetMapping;

  constructor(finder: SourceMapFinder, opts: SourceMapTransformerOptions = {}) {
    this.finder = finder;
    this.baseDir = opts.baseDir || process.cwd();
    this.resolveMapping = opts.getMapping || getMapping;
  }

  processFile(
    fc: FileCoverage,
    sourceMap: TraceMap,
    coverageMapper: (source: string) => MappedCoverage,
  ): boolean {
    let changes = 0;

    Object.entries(fc.statementMap).forEach(([s, loc]) => {
      const hits = fc.s[s];
      const mapping = this.resolveMapping(sourceMap, loc, fc.path);

      if (mapping) {
        changes += 1;
        const mappedCoverage = coverageMapper(mapping.source);
        mappedCoverage.addStatement(mapping.loc, hits);
      }
    });

    Object.entries(fc.fnMap).forEach(([f, fnMeta]) => {
      const hits = fc.f[f];
      const mapping = this.resolveMapping(sourceMap, fnMeta.decl, fc.path);

      const spanMapping = this.resolveMapping(sourceMap, fnMeta.loc, fc.path);

      if (mapping && spanMapping && mapping.source === spanMapping.source) {
        changes += 1;
        const mappedCoverage = coverageMapper(mapping.source);
        mappedCoverage.addFunction(fnMeta.name, mapping.loc, spanMapping.loc, hits);
      }
    });

    Object.entries(fc.branchMap).forEach(([b, branchMeta]) => {
      const hits = fc.b[b];
      const locs: Range[] = [];
      const mappedHits: number[] = [];
      let source: string | undefined;
      let skip: boolean | undefined;

      branchMeta.locations.forEach((loc, i) => {
        const mapping = this.resolveMapping(sourceMap, loc, fc.path);
        if (mapping) {
          if (!source) {
            source = mapping.source;
          }

          if (mapping.source !== source) {
            skip = true;
          }

          locs.push(mapping.loc);
          mappedHits.push(hits[i]);
        }
        // Check if this is an implicit else
        else if (
          source &&
          branchMeta.type === "if" &&
          i > 0 &&
          (loc.start as PartialPosition).line === undefined &&
          (loc.start as PartialPosition).end === undefined &&
          (loc.end as PartialPosition).line === undefined &&
          (loc.end as PartialPosition).end === undefined
        ) {
          locs.push(loc);
          mappedHits.push(hits[i]);
        }
      });

      const locMapping = branchMeta.loc
        ? this.resolveMapping(sourceMap, branchMeta.loc, fc.path)
        : null;

      if (!skip && locs.length > 0) {
        changes += 1;
        const mappedCoverage = coverageMapper(source!);
        mappedCoverage.addBranch(
          branchMeta.type,
          locMapping ? locMapping.loc : locs[0],
          locs,
          mappedHits,
        );
      }
    });

    return changes > 0;
  }

  async transform(coverageMap: CoverageMap): Promise<CoverageMap> {
    const uniqueFiles: Record<string, MappedCoverageEntry> = {};
    const getMappedCoverage = (file: string): MappedCoverage => {
      const key = getUniqueKey(file);
      if (!uniqueFiles[key]) {
        uniqueFiles[key] = {
          file,
          mappedCoverage: new MappedCoverage(file),
        };
      }

      return uniqueFiles[key].mappedCoverage;
    };

    for (const file of coverageMap.files()) {
      const fc = coverageMap.fileCoverageFor(file);
      const sourceMap = await this.finder(file, fc);

      if (sourceMap) {
        const changed = this.processFile(fc, sourceMap, getMappedCoverage);
        if (!changed) {
          debug(`File [${file}] ignored, nothing could be mapped`);
        }
      } else {
        uniqueFiles[getUniqueKey(file)] = {
          file,
          mappedCoverage: new MappedCoverage(fc),
        };
      }
    }

    return libCoverage.createCoverageMap(getOutput(uniqueFiles));
  }
}
