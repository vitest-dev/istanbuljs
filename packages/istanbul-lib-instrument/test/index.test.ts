import { assert, describe, it, expect } from "vitest";

import * as index from "../src/index";

describe("external interface", () => {
  it("exposes the correct objects", () => {
    const i = index.createInstrumenter();
    assert(i);
    assert(i.instrumentSync);
    assert(i.instrument);
    expect(index.readInitialCoverage).toBeTypeOf("function");
  });
});

describe("instrumenter", () => {
  it("preserves comments", function () {
    const instrumenter = index.createInstrumenter();
    const instrumentedCode = instrumenter.instrumentSync(
      "/*foo*/\n//bar\ncode = true",
      "somefile.js",
    );
    assert.notEqual(instrumentedCode.indexOf("/*foo*/"), -1, "block comment removed");
    assert.notEqual(instrumentedCode.indexOf("//bar"), -1, "line comment removed");
  });
});
