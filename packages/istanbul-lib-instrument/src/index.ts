import { defaults } from "@istanbuljs/schema";

import Instrumenter from "./instrumenter";
import type { InstrumenterOptions } from "./instrumenter";
import readInitialCoverage from "./read-coverage";

/**
 * createInstrumenter creates a new instrumenter with the
 * supplied options.
 * @param opts - instrumenter options. See the documentation
 * for the Instrumenter class.
 */
function createInstrumenter(opts?: Partial<InstrumenterOptions>): Instrumenter {
  return new Instrumenter(opts);
}

const defaultOpts = defaults.instrumenter;

export { createInstrumenter, readInitialCoverage, defaultOpts };

export type { Instrumenter };
export type { InstrumenterCallback, InstrumenterOptions, SourceMap } from "./instrumenter";
export type { InitialCoverage } from "./read-coverage";
export type { InputSourceMap, SourceCoverageData } from "./source-coverage";
