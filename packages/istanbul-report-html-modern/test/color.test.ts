import { describe, expect, it } from "vitest";

import { getColor } from "../src/helpers/color";

describe("getColor", () => {
  it("uses istanbul default watermarks when none are provided", () => {
    expect(getColor(49)).toBe("rgb(245, 32, 32)");
    expect(getColor(50)).toBe("rgb(244, 176, 27)");
    expect(getColor(79)).toBe("rgb(244, 176, 27)");
    expect(getColor(80)).toBe("rgb(33, 181, 119)");
  });

  it("uses configured statement watermarks", () => {
    const watermarks = [80, 95] as const;

    expect(getColor(79, watermarks)).toBe("rgb(245, 32, 32)");
    expect(getColor(80, watermarks)).toBe("rgb(244, 176, 27)");
    expect(getColor(94, watermarks)).toBe("rgb(244, 176, 27)");
    expect(getColor(95, watermarks)).toBe("rgb(33, 181, 119)");
  });
});
