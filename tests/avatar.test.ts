import { describe, expect, it } from "vitest";
import { avatarGradient } from "@/app/lib/avatar";

describe("avatarGradient", () => {
  it("is stable for the same seed", () => expect(avatarGradient("user_1")).toEqual(avatarGradient("user_1")));

  it("ignores case and surrounding whitespace", () =>
    expect(avatarGradient("  Ada@Example.com ")).toEqual(avatarGradient("ada@example.com")));

  it("separates different seeds", () =>
    expect(new Set(["a", "b", "c", "d"].map((seed) => avatarGradient(seed).background)).size).toBe(4));

  it("still paints a face with no seed", () => expect(avatarGradient(null)).toEqual(avatarGradient("guest")));
});
