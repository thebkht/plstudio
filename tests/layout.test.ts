import { describe, expect, it } from "vitest";
import { enclosedBy, tidyLayout } from "@/app/components/designer/geometry";
import { GROUP_MIN_HEIGHT, GROUP_MIN_WIDTH } from "@/app/components/designer/constants";
import { makeColumn, makeDemoSchema, makeMemo, makeSchemaGroup, makeTable, tableHeight, tableWidth, type Schema, type SchemaGroup, type Table } from "@/app/lib/schema";

const centre = (table: Table) => [table.x + tableWidth(table) / 2, table.y + tableHeight(table) / 2] as const;

const holds = (group: SchemaGroup, table: Table) => enclosedBy(group, ...centre(table));

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

const boxOf = (table: Table) => ({ x: table.x, y: table.y, width: tableWidth(table), height: tableHeight(table) });

/**
 * Two groups whose members are deliberately strewn well outside their boxes --
 * the state a tidy has to repair -- plus two loose tables, a group-owned memo
 * and a free one. Column counts vary so the packer meets uneven heights, and
 * one name is long enough to make its card wider than the rest.
 */
function strewn() {
  const core = makeSchemaGroup("Core", 400, 400, 0);
  const edge = makeSchemaGroup("Edge", 40, 2400, 1);
  const wide = (name: string, x: number, y: number, columns: number) => ({
    ...makeTable(name, x, y, 0),
    columns: [
      ...makeTable(name, 0, 0, 0).columns,
      ...Array.from({ length: columns }, (_, index) => makeColumn({ name: `C${index}`, type: "VARCHAR2", size: "50" })),
    ],
  });
  const members = [
    { ...wide("A_VERY_LONG_TABLE_NAME_INDEED", -900, -700, 8), schemaId: core.id },
    { ...wide("B", 3000, 120, 2), schemaId: core.id },
    { ...wide("C", 12, 4000, 5), schemaId: core.id },
    { ...wide("D", -40, 90, 1), schemaId: edge.id },
  ];
  const loose = [wide("LOOSE_ONE", 500, 460, 3), wide("LOOSE_TWO", 420, 430, 0)];
  const memos = [{ ...makeMemo("note", 9000, 9000), schemaId: core.id }, makeMemo("free", 20, 20)];
  const schema: Schema = { ...makeDemoSchema(), tables: [...members, ...loose], groups: [core, edge], memos, relationships: [] };
  return { schema, coreId: core.id, edgeId: edge.id };
}

describe("tidyLayout", () => {
  it("never changes which group a table belongs to", () => {
    const { schema } = strewn();
    const before = schema.tables.map((table) => [table.id, table.schemaId] as const);
    const after = tidyLayout(schema).tables.map((table) => [table.id, table.schemaId] as const);
    expect(after).toEqual(before);
  });

  it("leaves every member's centre inside its own group, so no resize evicts it", () => {
    const next = tidyLayout(strewn().schema);
    const groups = new Map((next.groups ?? []).map((group) => [group.id, group]));
    const members = next.tables.filter((table) => table.schemaId);
    expect(members).toHaveLength(4);
    members.forEach((table) => expect(holds(groups.get(table.schemaId!)!, table)).toBe(true));
  });

  it("keeps loose tables out of every group's box", () => {
    const next = tidyLayout(strewn().schema);
    next.tables
      .filter((table) => !table.schemaId)
      .forEach((table) => (next.groups ?? []).forEach((group) => expect(holds(group, table)).toBe(false)));
  });

  it("overlaps no two tables and no two groups", () => {
    const next = tidyLayout(strewn().schema);
    const boxes = next.tables.map(boxOf);
    boxes.forEach((box, index) => boxes.slice(index + 1).forEach((other) => expect(overlaps(box, other)).toBe(false)));
    const groups = next.groups ?? [];
    groups.forEach((group, index) => groups.slice(index + 1).forEach((other) => expect(overlaps(group, other)).toBe(false)));
  });

  it("grows a group to hold its members and never shrinks below the minimum", () => {
    const next = tidyLayout(strewn().schema);
    (next.groups ?? []).forEach((group) => {
      expect(group.width).toBeGreaterThanOrEqual(GROUP_MIN_WIDTH);
      expect(group.height).toBeGreaterThanOrEqual(GROUP_MIN_HEIGHT);
      next.tables
        .filter((table) => table.schemaId === group.id)
        .forEach((table) => {
          expect(table.x + tableWidth(table)).toBeLessThanOrEqual(group.x + group.width);
          expect(table.y + tableHeight(table)).toBeLessThanOrEqual(group.y + group.height);
        });
    });
  });

  it("carries a group's memo along and leaves a free one where it was", () => {
    const { schema, coreId } = strewn();
    const before = schema.groups![0];
    const next = tidyLayout(schema);
    const after = next.groups!.find((group) => group.id === coreId)!;
    const [owned, free] = [next.memos![0], next.memos![1]];
    expect(owned.x).toBe(9000 + after.x - before.x);
    expect(owned.y).toBe(9000 + after.y - before.y);
    expect([free.x, free.y]).toEqual([20, 20]);
  });

  it("is a no-op the second time", () => {
    const once = tidyLayout(strewn().schema);
    expect(tidyLayout(once)).toEqual(once);
  });

  it("handles a schema with no groups, and a group with no members", () => {
    const plain: Schema = { ...makeDemoSchema(), tables: [makeTable("A", 0, 0, 0), makeTable("B", 0, 0, 1)], groups: [], memos: [], relationships: [] };
    expect(tidyLayout(plain).tables.map(boxOf).every((box, index, all) => all.slice(index + 1).every((other) => !overlaps(box, other)))).toBe(true);
    const empty: Schema = { ...plain, groups: [makeSchemaGroup("Empty", 0, 0, 0)] };
    const group = tidyLayout(empty).groups![0];
    expect([group.width, group.height]).toEqual([GROUP_MIN_WIDTH, GROUP_MIN_HEIGHT]);
  });
});
