import { describe, expect, it } from "vitest";
import { AVATAR_GRID, avatarFace } from "@/app/lib/avatar";

const seeds = ["user_1", "user_2", "ada@example.com", "grace@example.com", "3f0c", "b71e"];

describe("avatarFace", () => {
  it("is stable for the same seed", () => expect(avatarFace("user_1")).toEqual(avatarFace("user_1")));

  it("ignores case and surrounding whitespace", () =>
    expect(avatarFace("  Ada@Example.com ")).toEqual(avatarFace("ada@example.com")));

  it("separates different seeds", () =>
    expect(new Set(seeds.map((seed) => JSON.stringify(avatarFace(seed)))).size).toBe(seeds.length));

  it("still paints a face with no seed", () => expect(avatarFace(null)).toEqual(avatarFace("guest")));

  it("stays inside the grid", () =>
    seeds.forEach((seed) =>
      avatarFace(seed).cells.forEach(([column, row]) => {
        expect(column).toBeGreaterThanOrEqual(0);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(Math.max(column, row)).toBeLessThan(AVATAR_GRID);
      }),
    ));

  it("mirrors down the middle", () =>
    seeds.forEach((seed) => {
      const cells = avatarFace(seed).cells.map(([column, row]) => `${column},${row}`);
      expect(cells.sort()).toEqual(
        avatarFace(seed)
          .cells.map(([column, row]) => `${AVATAR_GRID - 1 - column},${row}`)
          .sort(),
      );
    }));

  it("is never near-empty or near-full", () =>
    seeds.forEach((seed) => {
      const count = avatarFace(seed).cells.length;
      expect(count).toBeGreaterThanOrEqual(9);
      expect(count).toBeLessThanOrEqual(17);
    }));

  it("draws each cell once", () =>
    seeds.forEach((seed) => {
      const cells = avatarFace(seed).cells;
      expect(new Set(cells.map(String)).size).toBe(cells.length);
    }));
});
