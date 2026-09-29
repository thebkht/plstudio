import { describe, expect, it } from "vitest";
import { CURVE_MIN_REACH, crowMarker, curvePath } from "@/app/components/designer/edge-routing";

describe("curvePath", () => {
  it("leaves each anchor along its flank, reaching half the gap", () => {
    expect(curvePath({ x: 0, y: 10, direction: 1 }, { x: 400, y: 90, direction: -1 })).toBe("M 0 10 C 200 10 200 90 400 90");
  });

  it("reaches out at least the minimum, so a C-shaped edge clears its cards", () => {
    expect(curvePath({ x: 300, y: 10, direction: 1 }, { x: 320, y: 90, direction: 1 }))
      .toBe(`M 300 10 C ${300 + CURVE_MIN_REACH} 10 ${320 + CURVE_MIN_REACH} 90 320 90`);
  });

  it("ends in one bar pair for 1 and a crow's foot for anything else", () => {
    expect(["1", "n", "m", "0..*"].map(crowMarker)).toEqual(["one", "many", "many", "many"]);
  });
});
