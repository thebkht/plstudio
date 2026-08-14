import { describe, expect, it } from "vitest";
import { AVATAR_VARIANT_COUNT, avatarFace } from "@/app/lib/avatar";

const seeds = ["user_1", "user_2", "ada@example.com", "grace@example.com", "3f0c", "b71e"];

describe("avatarFace", () => {
  it("is stable for the same seed", () => expect(avatarFace("user_1")).toEqual(avatarFace("user_1")));

  it("ignores case and surrounding whitespace", () =>
    expect(avatarFace("  Ada@Example.com ")).toEqual(avatarFace("ada@example.com")));

  it("still paints a face with no seed", () => expect(avatarFace(null)).toEqual(avatarFace("guest")));

  it("spreads seeds over more than one variant", () =>
    expect(new Set(seeds.map((seed) => JSON.stringify(avatarFace(seed)))).size).toBeGreaterThan(1));

  it("reaches every variant by index, and each is distinct", () =>
    expect(
      new Set([...Array(AVATAR_VARIANT_COUNT).keys()].map((index) => JSON.stringify(avatarFace("ignored", index)))).size,
    ).toBe(AVATAR_VARIANT_COUNT));

  it("wraps an out-of-range variant index in both directions", () => {
    expect(avatarFace("x", AVATAR_VARIANT_COUNT + 3)).toEqual(avatarFace("x", 3));
    expect(avatarFace("x", -1)).toEqual(avatarFace("x", AVATAR_VARIANT_COUNT - 1));
  });

  it("always returns a drawable glyph and colours", () =>
    seeds.forEach((seed) => {
      const face = avatarFace(seed);
      expect(face.path).toMatch(/^M/);
      expect(face.background).toMatch(/^#[0-9A-F]{6}$/i);
      expect(face.foreground).toMatch(/^#[0-9A-F]{6}$/i);
    }));
});
