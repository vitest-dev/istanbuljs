import { assert, describe, it } from "vitest";

import * as verifier from "./util/verifier";

describe("negative tests", () => {
  it("should barf on junk code", () => {
    const v = verifier.create("}", { quiet: true });
    const err = v.compileError();
    assert(err);
    assert(err.message.match(/Unexpected token/));
  });

  it("should barf on non-string code", () => {
    const v = verifier.create({}, { quiet: true });
    const err = v.compileError();
    assert(err);
    assert(err.message.match(/must be a string/));
  });

  it("should barf on mainline returns with no auto-wrap", () => {
    const v = verifier.create("return 10;", { quiet: true }, { autoWrap: false });
    const err = v.compileError();
    assert(err);
    assert(err.message.match(/'return' statement can only be used within a function body/));
  });
});
