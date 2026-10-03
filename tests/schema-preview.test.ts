import { describe, expect, it } from "vitest";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH, schemaPreview } from "@/app/lib/schema-preview";
import { GROUP_PALETTE, makeMemo, makeSchemaGroup, makeTable, tableWidth, type Schema, type Table } from "@/app/lib/schema";

const schemaOf = (tables: Table[]): Schema => ({
  id: "prj",
  name: "Preview",
  revision: 1,
  schemaFormatVersion: 3,
  tables,
  relationships: [],
});

describe("schema preview geometry", () => {
  it("has nothing to draw for a schema with no tables", () => {
    expect(schemaPreview(schemaOf([]))).toBeNull();
  });

  it("centres the content in the frame", () => {
    const preview = schemaPreview(schemaOf([makeTable("A", 100, 100), makeTable("B", 600, 400)]))!;
    const left = Math.min(...preview.tables.map((table) => table.x));
    const right = Math.max(...preview.tables.map((table) => table.x + table.w));
    const top = Math.min(...preview.tables.map((table) => table.y));
    const bottom = Math.max(...preview.tables.map((table) => table.y + table.h));
    /* Equal margins on both axes is what "centred" means, whichever axis the
       scale was chosen from. */
    expect(left).toBeCloseTo(PREVIEW_WIDTH - right, 5);
    expect(top).toBeCloseTo(PREVIEW_HEIGHT - bottom, 5);
  });

  it("preserves the canvas arrangement", () => {
    const [a, b] = [makeTable("A", 100, 100), makeTable("B", 600, 400)];
    const preview = schemaPreview(schemaOf([a, b]))!;
    const [first, second] = preview.tables;
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBeGreaterThan(first.y);
    /* One scale for both axes, so relative proportions survive the reduction. */
    expect((second.x - first.x) / (600 - 100)).toBeCloseTo((second.y - first.y) / (400 - 100), 5);
  });

  it("clamps zoom so a lone table does not fill the frame", () => {
    const preview = schemaPreview(schemaOf([makeTable("ONLY", 0, 0)]))!;
    const [only] = preview.tables;
    expect(only.w).toBeLessThan(PREVIEW_WIDTH / 2);
    expect(only.w).toBeCloseTo(tableWidth({ name: "ONLY" }) * 0.35, 5);
  });

  it("carries each table's accent colour", () => {
    const preview = schemaPreview(schemaOf([makeTable("A", 0, 0, 0), makeTable("B", 400, 0, 1)]))!;
    expect(preview.tables.map((table) => table.color)).toEqual(["#00acb6", "#2b99e7"]);
  });

  it("draws a retired palette colour as the one now in its slot", () => {
    const table = { ...makeTable("OLD", 0, 0), color: { a: "#F2994A", b: "#d97f34" } };
    expect(schemaPreview(schemaOf([table]))!.tables[0].color).toBe("#cf7b00");
  });

  it("draws groups and memos as regions in their palette edge colours", () => {
    const group = { ...makeSchemaGroup("Billing", 0, 0), color: "purple" as const, width: 400, height: 300 };
    const memo = makeMemo("note", 500, 0, "green");
    const preview = schemaPreview({ ...schemaOf([makeTable("A", 40, 60)]), groups: [group], memos: [memo] })!;
    expect(preview.regions.map((region) => [region.kind, region.color])).toEqual([
      ["group", GROUP_PALETTE.purple.border],
      ["memo", "var(--memo-green-edge)"],
    ]);
  });

  it("fits the frame to regions as well as tables", () => {
    const table = makeTable("A", 0, 0);
    const alone = schemaPreview(schemaOf([table]))!;
    const memo = makeMemo("far away", 2000, 1200);
    const withMemo = schemaPreview({ ...schemaOf([table]), memos: [memo] })!;
    /* The far memo has to fit too, so the table shrinks to make room. */
    expect(withMemo.tables[0].w).toBeLessThan(alone.tables[0].w);
    const right = Math.max(...withMemo.regions.map((region) => region.x + region.w));
    expect(right).toBeLessThanOrEqual(PREVIEW_WIDTH);
  });

  it("has nothing to draw when only groups or memos exist", () => {
    expect(schemaPreview({ ...schemaOf([]), groups: [makeSchemaGroup("Empty")], memos: [makeMemo("hi")] })).toBeNull();
  });

  it("ignores malformed regions instead of collapsing the frame", () => {
    const broken = { ...makeMemo("bad"), width: Number.NaN };
    const preview = schemaPreview({ ...schemaOf([makeTable("A", 0, 0)]), memos: [broken] })!;
    expect(preview.regions).toHaveLength(0);
    expect(Number.isFinite(preview.tables[0].x)).toBe(true);
  });

  it("caps how much it will draw", () => {
    const many = Array.from({ length: 90 }, (_, index) => makeTable(`T${index}`, index * 300, index * 40));
    expect(schemaPreview(schemaOf(many))!.tables).toHaveLength(60);
  });
});
