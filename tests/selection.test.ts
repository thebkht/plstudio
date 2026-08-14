import { describe, expect, it } from "vitest";
import { generateDDL } from "@/app/lib/generators";
import { makeDemoSchema, makeMemo, makeSchemaGroup, makeTable, normalizeRelationships, tableHeight, tableWidth, type Schema } from "@/app/lib/schema";
import { EMPTY_SELECTION, marqueeSelection, moveSelection, movingEntities, pruneSelection, rectFromPoints, removeSelection, selectAll, selectionBounds, selectionCount, selectionDragBounds, selectionSchema, selectOnly, toggleSelected } from "@/app/lib/selection";

/**
 * A group at (400,400) sized 760x520, holding one table and one memo, with a
 * second table left out on the canvas beside it.
 */
function grouped() {
  const group = makeSchemaGroup("Core", 400, 400, 0);
  const inside = { ...makeTable("INSIDE", 440, 480, 0), schemaId: group.id };
  const memo = { ...makeMemo("note", 440, 700), schemaId: group.id };
  const outside = makeTable("OUTSIDE", 1400, 480, 1);
  const schema: Schema = { ...makeDemoSchema(), tables: [inside, outside], groups: [group], memos: [memo], relationships: [] };
  return { schema, group, inside, outside, memo };
}

describe("canvas selection", () => {
  it("counts and toggles across all three kinds", () => {
    const one = selectOnly("table", "t1");
    expect(selectionCount(one)).toBe(1);
    const two = toggleSelected(one, "memo", "m1");
    expect(selectionCount(two)).toBe(2);
    expect(selectionCount(toggleSelected(two, "memo", "m1"))).toBe(1);
    expect(selectionCount(EMPTY_SELECTION)).toBe(0);
  });

  it("selects everything on the canvas", () => {
    const { schema } = grouped();
    expect(selectionCount(selectAll(schema))).toBe(4); // 2 tables, 1 memo, 1 group
  });

  it("drops ids a collaborator deleted, and keeps its identity when none went", () => {
    const { schema, inside } = grouped();
    const selection = { tables: [inside.id, "gone"], memos: [], groups: [] };
    expect(pruneSelection(schema, selection).tables).toEqual([inside.id]);
    const intact = selectOnly("table", inside.id);
    expect(pruneSelection(schema, intact)).toBe(intact);
  });
});

describe("marquee hit rules", () => {
  it("takes a table it merely touches", () => {
    const { schema, inside } = grouped();
    const clipping = rectFromPoints(inside.x - 40, inside.y - 40, inside.x + 10, inside.y + 10);
    expect(marqueeSelection(schema, clipping).tables).toEqual([inside.id]);
    const missing = rectFromPoints(0, 0, inside.x - 1, inside.y - 1);
    expect(marqueeSelection(schema, missing).tables).toEqual([]);
  });

  it("takes a group only once the sweep encloses it whole", () => {
    const { schema, group, inside, memo } = grouped();
    // Crossing the interior picks up the cards without carrying off the schema.
    const across = rectFromPoints(group.x + 10, group.y + 10, group.x + group.width - 10, group.y + group.height - 10);
    const crossing = marqueeSelection(schema, across);
    expect(crossing.groups).toEqual([]);
    expect(crossing.tables).toEqual([inside.id]);
    expect(crossing.memos).toEqual([memo.id]);

    const around = rectFromPoints(group.x - 20, group.y - 20, group.x + group.width + 20, group.y + group.height + 20);
    expect(marqueeSelection(schema, around).groups).toEqual([group.id]);
  });

  it("unions onto a base selection so an additive sweep extends it", () => {
    const { schema, inside, outside } = grouped();
    const base = selectOnly("table", outside.id);
    const over = rectFromPoints(inside.x, inside.y, inside.x + 10, inside.y + 10);
    expect(marqueeSelection(schema, over, base).tables.sort()).toEqual([inside.id, outside.id].sort());
    // Sweeping the same card twice does not duplicate it.
    expect(marqueeSelection(schema, over, marqueeSelection(schema, over)).tables).toEqual([inside.id]);
  });
});

describe("moving a selection", () => {
  it("carries a selected group's members without moving them twice", () => {
    const { schema, group, inside, memo, outside } = grouped();
    // The table is selected in its own right *and* a member of the selected group.
    const selection = { tables: [inside.id], memos: [], groups: [group.id] };
    const moving = movingEntities(schema, selection);
    expect(moving.tables).toEqual(new Set([inside.id]));
    expect(moving.memos).toEqual(new Set([memo.id]));

    const moved = moveSelection(schema, selection, 100, 50);
    expect(moved.tables[0]).toMatchObject({ x: inside.x + 100, y: inside.y + 50 });
    expect(moved.memos?.[0]).toMatchObject({ x: memo.x + 100, y: memo.y + 50 });
    expect(moved.groups?.[0]).toMatchObject({ x: group.x + 100, y: group.y + 50 });
    // Nothing unselected shifts.
    expect(moved.tables[1]).toMatchObject({ x: outside.x, y: outside.y });
  });

  it("keeps every card in the schema it belonged to", () => {
    const { schema, group, inside } = grouped();
    const moved = moveSelection(schema, selectOnly("table", inside.id), -300, 0);
    expect(moved.tables[0].schemaId).toBe(group.id);
  });

  it("bounds the drag by the assembly, not by any one card", () => {
    const world = { width: 2000, height: 2000 };
    const { schema, group, inside, outside } = grouped();
    const selection = { tables: [inside.id, outside.id], memos: [], groups: [] };
    const bounds = selectionDragBounds(schema, selection, world);
    // The left edge is the inner table's, the right edge is the outer table's.
    expect(bounds.minDx).toBe(-inside.x);
    expect(bounds.maxDx).toBe(world.width - (outside.x + tableWidth(outside)));

    // A group drags by its own bounding box, members included.
    const whole = selectionDragBounds(schema, selectOnly("group", group.id), world);
    expect(whole.minDy).toBe(-group.y);
    const bottom = Math.max(group.y + group.height, inside.y + tableHeight(inside));
    expect(whole.maxDy).toBe(world.height - bottom);
  });

  it("collapses to a single legal delta when the assembly outgrows the world", () => {
    const { schema } = grouped();
    const bounds = selectionDragBounds(schema, selectAll(schema), { width: 500, height: 500 });
    expect(bounds.maxDx).toBe(bounds.minDx);
    expect(bounds.maxDy).toBe(bounds.minDy);
  });

  it("reports the box drawn around the whole set", () => {
    const { schema, inside, outside } = grouped();
    const bounds = selectionBounds(schema, { tables: [inside.id, outside.id], memos: [], groups: [] });
    expect(bounds).toMatchObject({ x: inside.x, y: inside.y, width: outside.x + tableWidth(outside) - inside.x });
    expect(selectionBounds(schema, EMPTY_SELECTION)).toBeNull();
  });
});

describe("deleting a selection", () => {
  it("sheds the relationships that pointed at what went", () => {
    const schema = normalizeRelationships(makeDemoSchema());
    expect(schema.relationships?.length).toBeGreaterThan(0);
    const target = schema.relationships![0].endTableId;
    const next = removeSelection(schema, selectOnly("table", target));
    expect(next.tables.some((table) => table.id === target)).toBe(false);
    expect(next.relationships?.some((relationship) => relationship.endTableId === target)).toBe(false);
    expect(next.tables.flatMap((table) => table.columns).some((column) => column.fk?.tableId === target)).toBe(false);
  });

  it("releases a deleted group's members rather than deleting them", () => {
    const { schema, group, inside, memo } = grouped();
    const next = removeSelection(schema, selectOnly("group", group.id));
    expect(next.groups).toEqual([]);
    expect(next.tables.find((table) => table.id === inside.id)?.schemaId).toBeUndefined();
    expect(next.memos?.find((item) => item.id === memo.id)?.schemaId).toBeUndefined();
  });

  it("leaves the schema untouched when nothing is selected", () => {
    const { schema } = grouped();
    expect(removeSelection(schema, EMPTY_SELECTION)).toBe(schema);
  });
});

describe("the selection as a standalone schema", () => {
  it("brings a selected group's members and clears a group that stayed behind", () => {
    const { schema, group, inside, memo, outside } = grouped();
    const whole = selectionSchema(schema, selectOnly("group", group.id));
    expect(whole.tables.map((table) => table.id)).toEqual([inside.id]);
    expect(whole.memos?.map((item) => item.id)).toEqual([memo.id]);
    expect(whole.groups?.map((item) => item.id)).toEqual([group.id]);

    // The table alone: its group did not come, so the dangling reference goes.
    const alone = selectionSchema(schema, selectOnly("table", inside.id));
    expect(alone.groups).toEqual([]);
    expect(alone.tables[0].schemaId).toBeUndefined();
    expect(alone.tables.some((table) => table.id === outside.id)).toBe(false);
  });

  it("drops the edges that leave the subset, and the DDL never names a missing table", () => {
    const schema = normalizeRelationships(makeDemoSchema());
    const [first] = schema.tables;
    const subset = selectionSchema(schema, selectOnly("table", first.id));
    expect(subset.relationships).toEqual([]);
    expect(subset.tables[0].columns.every((column) => !column.fk)).toBe(true);
    const ddl = generateDDL(subset);
    schema.tables.slice(1).forEach((table) => expect(ddl).not.toContain(table.name));
  });
});
