import { describe, expect, it } from "vitest";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH, schemaPreview } from "@/app/lib/schema-preview";
import { makeColumn, makeTable, TABLE_COLOR_STRIP_HEIGHT, TABLE_FIELD_HEIGHT, TABLE_HEADER_HEIGHT, tableWidth, type Relationship, type Schema, type Table } from "@/app/lib/schema";

const schemaOf = (tables: Table[], relationships: Relationship[] = []): Schema => ({
  id: "prj",
  name: "Preview",
  revision: 1,
  schemaFormatVersion: 3,
  tables,
  relationships,
});

const relate = (from: Table, fromColumn: string, to: Table, toColumn: string): Relationship => ({
  id: "rel",
  startTableId: from.id,
  startFieldId: from.columns.find((column) => column.name === fromColumn)!.id,
  endTableId: to.id,
  endFieldId: to.columns.find((column) => column.name === toColumn)!.id,
  fields: [],
  name: "FK",
  cardinality: "one_to_many",
  manyLabel: "",
  updateConstraint: "No action",
  deleteConstraint: "No action",
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
    expect(preview.tables.map((table) => table.color)).toEqual(["#175e7a", "#7d9dff"]);
  });

  it("anchors an edge to its column's row, on the facing flanks", () => {
    const left = makeTable("LEFT", 0, 0);
    const right = makeTable("RIGHT", 800, 0);
    right.columns.push(makeColumn({ name: "LEFT_ID", type: "NUMBER" }));
    const preview = schemaPreview(schemaOf([left, right], [relate(left, "ID", right, "LEFT_ID")]))!;
    expect(preview.edges).toHaveLength(1);
    const [edge] = preview.edges;
    /* Leaves the left card's right flank and arrives at the right card's left. */
    expect(edge.x1).toBeCloseTo(preview.tables[0].x + preview.tables[0].w, 5);
    expect(edge.x2).toBeCloseTo(preview.tables[1].x, 5);
    /* LEFT_ID is the second column, so the far end lands exactly one scaled
       row below the near end. */
    const scale = preview.tables[0].w / tableWidth(left);
    expect(edge.y2 - edge.y1).toBeCloseTo(TABLE_FIELD_HEIGHT * scale, 5);
  });

  it("anchors to the first row at the header's offset", () => {
    const a = makeTable("A", 0, 0);
    const b = makeTable("B", 800, 0);
    const preview = schemaPreview(schemaOf([a, b], [relate(a, "ID", b, "ID")]))!;
    const scale = preview.tables[0].w / tableWidth(a);
    const expected = preview.tables[0].y + (TABLE_COLOR_STRIP_HEIGHT + TABLE_HEADER_HEIGHT + TABLE_FIELD_HEIGHT / 2) * scale;
    expect(preview.edges[0].y1).toBeCloseTo(expected, 5);
  });

  it("skips a relationship whose table or column has been deleted", () => {
    const a = makeTable("A", 0, 0);
    const b = makeTable("B", 400, 0);
    const dangling = relate(a, "ID", b, "ID");
    expect(schemaPreview(schemaOf([a], [dangling]))!.edges).toHaveLength(0);
    expect(schemaPreview(schemaOf([a, b], [{ ...dangling, endFieldId: "col_gone" }]))!.edges).toHaveLength(0);
  });

  it("caps how much it will draw", () => {
    const many = Array.from({ length: 90 }, (_, index) => makeTable(`T${index}`, index * 300, index * 40));
    const relationships = many.slice(1).map((table, index) => ({ ...relate(many[index], "ID", table, "ID"), id: `rel_${index}` }));
    const preview = schemaPreview(schemaOf(many, relationships))!;
    expect(preview.tables).toHaveLength(60);
    expect(preview.edges.length).toBeLessThanOrEqual(80);
  });
});
