/*
Copyright 2012-2015, Yahoo Inc.
Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
*/

import { CoverageSummary } from "./coverage-summary";
import { FileCoverage } from "./file-coverage";
import type { FileCoverageData } from "./file-coverage";

/**
 * Raw, JSON-serializable data underlying a `CoverageMap`: `FileCoverage`
 * objects or their raw data keyed by file path. This can be the raw global
 * coverage object.
 */
export interface CoverageMapData {
  [path: string]: FileCoverage | FileCoverageData;
}

export function isCoverageMap(obj: unknown): obj is CoverageMap {
  if (obj instanceof CoverageMap) {
    return true;
  }

  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof (obj as CoverageMap).data === "object" &&
    typeof (obj as CoverageMap).fileCoverageFor === "function" &&
    typeof (obj as CoverageMap).addFileCoverage === "function"
  );
}

function loadMap(source?: CoverageMapData): Record<string, FileCoverage> {
  const data: Record<string, FileCoverage> = Object.create(null);
  if (!source) {
    return data;
  }

  Object.entries(source).forEach(([k, cov]) => {
    data[k] = cov instanceof FileCoverage ? cov : new FileCoverage(cov);
  });

  return data;
}

/** CoverageMap is a map of `FileCoverage` objects keyed by file paths. */
class CoverageMap {
  data: Record<string, FileCoverage>;

  /**
   * @constructor
   * @param obj A coverage map from which to initialize this
   * map's contents. This can be the raw global coverage object.
   */
  constructor(obj?: CoverageMap | CoverageMapData) {
    if (obj instanceof CoverageMap) {
      this.data = obj.data;
    } else if (isCoverageMap(obj)) {
      this.data = loadMap(obj.data);
    } else {
      this.data = loadMap(obj);
    }
  }

  /**
   * merges a second coverage map into this one
   * @param obj - a CoverageMap or its raw data. Coverage is merged
   *  correctly for the same files and additional file coverage keys are created
   *  as needed.
   */
  merge(obj: CoverageMap | CoverageMapData): void {
    const other = obj instanceof CoverageMap ? obj : new CoverageMap(obj);
    Object.values(other.data).forEach((fc) => {
      this.addFileCoverage(fc);
    });
  }

  /**
   * filter the coveragemap based on the callback provided
   * @param callback - Returns true if the path
   *  should be included in the coveragemap. False if it should be
   *  removed.
   */
  filter(callback: (path: string) => boolean): void {
    Object.keys(this.data).forEach((k) => {
      if (!callback(k)) {
        delete this.data[k];
      }
    });
  }

  /**
   * returns a JSON-serializable POJO for this coverage map
   */
  toJSON(): CoverageMapData {
    return this.data;
  }

  /**
   * returns an array for file paths for which this map has coverage
   * @returns array of files
   */
  files(): string[] {
    return Object.keys(this.data);
  }

  /**
   * returns the file coverage for the specified file.
   * @param file
   */
  fileCoverageFor(file: string): FileCoverage {
    const fc = this.data[file];
    if (!fc) {
      throw new Error(`No file coverage available for: ${file}`);
    }
    return fc;
  }

  /**
   * adds a file coverage object to this map. If the path for the object,
   * already exists in the map, it is merged with the existing coverage
   * otherwise a new key is added to the map.
   * @param fc the file coverage to add
   */
  addFileCoverage(fc: string | FileCoverage | FileCoverageData): void {
    const cov = new FileCoverage(fc);
    const { path } = cov;
    if (this.data[path]) {
      this.data[path].merge(cov);
    } else {
      this.data[path] = cov;
    }
  }

  /**
   * returns the coverage summary for all the file coverage objects in this map.
   * @returns {CoverageSummary}
   */
  getCoverageSummary(): CoverageSummary {
    const ret = new CoverageSummary();
    Object.values(this.data).forEach((fc) => {
      ret.merge(fc.toSummary());
    });

    return ret;
  }
}

export { CoverageMap };
