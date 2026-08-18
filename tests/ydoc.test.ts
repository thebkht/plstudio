import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applySchemaToYDoc, createReadCache, isEmptyDoc, schemaFromYDoc, schemaRoot, type ReadCache } from "@/app/lib/collab/ydoc";
import { makeColumn, makeDemoSchema, makeUniqueConstraint, makeMemo, makeSchemaGroup, makeTable, type Schema } from "@/app/lib/schema";

const seed = (schema: Schema) => applySchemaToYDoc(new Y.Doc(), schema);
const read = (ydoc: Y.Doc, schema: Schema) => schemaFromYDoc(ydoc, { id: schema.id, revision: schema.revision });
const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
};

describe("schemaFromYDoc / applySchemaToYDoc", () => {
  it("round-trips a schema unchanged", () => {
    const schema = makeDemoSchema();
    expect(read(seed(schema), schema)).toEqual(schema);
  });

  it("round-trips groups, memos and relationships", () => {
    const group = makeSchemaGroup("Billing");
    const schema = { ...makeDemoSchema(), groups: [group], memos: [{ ...makeMemo("check this"), schemaId: group.id }] };
    schema.relationships = [{
      id: "rel_1", startTableId: schema.tables[0].id, startFieldId: schema.tables[0].columns[0].id,
      endTableId: schema.tables[1].id, endFieldId: schema.tables[1].columns[0].id,
      fields: [{ startFieldId: schema.tables[0].columns[0].id, endFieldId: schema.tables[1].columns[0].id }],
      name: "FK_ENROLLMENT_STUDENT", cardinality: "one_to_many", manyLabel: "many",
      updateConstraint: "No action", deleteConstraint: "Cascade",
    }];
    expect(read(seed(schema), schema)).toEqual(schema);
  });

  it("round-trips multi-column unique constraints", () => {
    const schema = makeDemoSchema();
    const enrollment = schema.tables[1];
    enrollment.uniques = [makeUniqueConstraint([enrollment.columns[0].id, enrollment.columns[1].id], "UQ_ENROLLMENT")];
    expect(read(seed(schema), schema).tables[1].uniques).toEqual(enrollment.uniques);
  });

  it("preserves optional fields that were absent", () => {
    const schema = makeDemoSchema();
    expect(read(seed(schema), schema).tables[0].schemaId).toBeUndefined();
    expect(read(seed(schema), schema).tables[0].columns[0].comment).toBeUndefined();
  });

  it("clears an optional field when it is removed", () => {
    const schema = makeDemoSchema();
    const ydoc = seed({ ...schema, tables: schema.tables.map((table) => ({ ...table, comment: "note" })) });
    applySchemaToYDoc(ydoc, schema);
    expect(read(ydoc, schema).tables[0].comment).toBeUndefined();
  });

  it("round-trips a group keyword and clears it when it is emptied", () => {
    const group = makeSchemaGroup("Multi Language Tools");
    const schema = { ...makeDemoSchema(), groups: [group] };
    const ydoc = seed({ ...schema, groups: [{ ...group, keyword: "MLL" }] });
    expect(read(ydoc, schema).groups?.[0].keyword).toBe("MLL");
    applySchemaToYDoc(ydoc, schema);
    expect(read(ydoc, schema).groups?.[0].keyword).toBeUndefined();
  });

  it("round-trips a manual table width and clears it on reset", () => {
    const schema = makeDemoSchema();
    const sized = { ...schema, tables: schema.tables.map((table) => ({ ...table, width: 480 })) };
    const ydoc = seed(sized);
    expect(read(ydoc, schema).tables[0].width).toBe(480);
    applySchemaToYDoc(ydoc, schema);
    expect(read(ydoc, schema).tables[0].width).toBeUndefined();
  });

  it("treats an unchanged schema as a no-op", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    let updates = 0;
    ydoc.on("update", () => { updates += 1; });
    applySchemaToYDoc(ydoc, schema);
    expect(updates).toBe(0);
  });

  it("patches a renamed table in place rather than replacing the record", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    const before = schemaRoot(ydoc).tables.get(0);
    applySchemaToYDoc(ydoc, { ...schema, tables: schema.tables.map((table, index) => index === 0 ? { ...table, name: "PUPIL" } : table) });
    expect(schemaRoot(ydoc).tables.get(0)).toBe(before);
    expect(read(ydoc, schema).tables[0].name).toBe("PUPIL");
  });

  it("adds and removes tables", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    const added = makeTable("COURSE", 900, 90, 2);
    applySchemaToYDoc(ydoc, { ...schema, tables: [...schema.tables, added] });
    expect(read(ydoc, schema).tables.map((table) => table.name)).toEqual(["STUDENT", "ENROLLMENT", "COURSE"]);
    applySchemaToYDoc(ydoc, { ...schema, tables: [schema.tables[1], added] });
    expect(read(ydoc, schema).tables.map((table) => table.name)).toEqual(["ENROLLMENT", "COURSE"]);
  });

  it("inserts a column at its target index", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    const inserted = makeColumn({ name: "MIDDLE_NAME" });
    const columns = [schema.tables[0].columns[0], inserted];
    applySchemaToYDoc(ydoc, { ...schema, tables: [{ ...schema.tables[0], columns }, schema.tables[1]] });
    expect(read(ydoc, schema).tables[0].columns.map((column) => column.name)).toEqual(["ID", "MIDDLE_NAME"]);
  });

  it("reorders columns", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    const reversed = [...schema.tables[1].columns].reverse();
    applySchemaToYDoc(ydoc, { ...schema, tables: [schema.tables[0], { ...schema.tables[1], columns: reversed }] });
    expect(read(ydoc, schema).tables[1].columns.map((column) => column.name)).toEqual(reversed.map((column) => column.name));
  });

  it("keeps table positions as numbers through a move", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    applySchemaToYDoc(ydoc, { ...schema, tables: [{ ...schema.tables[0], x: 640, y: 480 }, schema.tables[1]] });
    expect(read(ydoc, schema).tables[0]).toMatchObject({ x: 640, y: 480 });
  });
});

describe("isEmptyDoc", () => {
  it("is true before seeding and false after", () => {
    const ydoc = new Y.Doc();
    expect(isEmptyDoc(ydoc)).toBe(true);
    expect(isEmptyDoc(applySchemaToYDoc(ydoc, makeDemoSchema()))).toBe(false);
  });
});

describe("concurrent editing", () => {
  it("merges edits to different tables without losing either", () => {
    const schema = makeDemoSchema();
    const a = seed(schema);
    const b = new Y.Doc();
    sync(a, b);

    applySchemaToYDoc(a, { ...schema, tables: [{ ...schema.tables[0], name: "PUPIL" }, schema.tables[1]] });
    applySchemaToYDoc(b, { ...schema, tables: [schema.tables[0], { ...schema.tables[1], x: 999 }] });
    sync(a, b);

    const merged = read(a, schema);
    expect(read(b, schema)).toEqual(merged);
    expect(merged.tables[0].name).toBe("PUPIL");
    expect(merged.tables[1].x).toBe(999);
  });

  it("keeps a column added on one client and a rename made on another", () => {
    const schema = makeDemoSchema();
    const a = seed(schema);
    const b = new Y.Doc();
    sync(a, b);

    const added = makeColumn({ name: "EMAIL" });
    applySchemaToYDoc(a, { ...schema, tables: [{ ...schema.tables[0], columns: [...schema.tables[0].columns, added] }, schema.tables[1]] });
    applySchemaToYDoc(b, { ...schema, tables: [schema.tables[0], { ...schema.tables[1], name: "SIGNUP" }] });
    sync(a, b);

    const merged = read(a, schema);
    expect(merged.tables[0].columns.map((column) => column.name)).toEqual(["ID", "EMAIL"]);
    expect(merged.tables[1].name).toBe("SIGNUP");
  });

  it("survives both clients inserting a table at once", () => {
    const schema = makeDemoSchema();
    const a = seed(schema);
    const b = new Y.Doc();
    sync(a, b);

    applySchemaToYDoc(a, { ...schema, tables: [...schema.tables, makeTable("COURSE", 900, 90, 2)] });
    applySchemaToYDoc(b, { ...schema, tables: [...schema.tables, makeTable("TEACHER", 900, 500, 3)] });
    sync(a, b);

    const names = read(a, schema).tables.map((table) => table.name);
    expect(names).toHaveLength(4);
    expect(names).toEqual(expect.arrayContaining(["STUDENT", "ENROLLMENT", "COURSE", "TEACHER"]));
    expect(read(b, schema).tables.map((table) => table.name)).toEqual(names);
  });
});

describe("per-user undo", () => {
  it("undoes only the local client's edit", () => {
    const schema = makeDemoSchema();
    const a = seed(schema);
    const b = new Y.Doc();
    sync(a, b);

    const local = Symbol("local");
    const undoManager = new Y.UndoManager(Object.values(schemaRoot(a)), { trackedOrigins: new Set([local]) });

    applySchemaToYDoc(a, { ...schema, tables: [{ ...schema.tables[0], name: "PUPIL" }, schema.tables[1]] }, local);
    sync(a, b);
    applySchemaToYDoc(b, { ...schema, tables: [{ ...schema.tables[0], name: "PUPIL" }, { ...schema.tables[1], name: "SIGNUP" }] });
    sync(a, b);

    undoManager.undo();
    sync(a, b);

    const merged = read(a, schema);
    expect(merged.tables[0].name).toBe("STUDENT");
    expect(merged.tables[1].name).toBe("SIGNUP");
  });
});

describe("duplicate damage", () => {
  it("reads a doc that two clients both seeded as a single copy", () => {
    // Exactly the double-seed failure: a client seeds locally, then the server's
    // own copy arrives and the CRDT merges the two rather than replacing.
    const schema = makeDemoSchema();
    const a = seed(schema);
    const b = seed(schema);
    sync(a, b);

    expect(schemaRoot(a).tables.length).toBe(4); // merged, genuinely duplicated
    expect(read(a, schema).tables.map((table) => table.name)).toEqual(["STUDENT", "ENROLLMENT"]);
    expect(read(a, schema)).toEqual(read(b, schema));
  });

  it("drops duplicated columns, groups and memos too", () => {
    const schema = { ...makeDemoSchema(), groups: [makeSchemaGroup("Billing")], memos: [makeMemo("note")] };
    const a = seed(schema);
    sync(a, seed(schema));
    const merged = read(a, schema);
    expect(merged.groups).toHaveLength(1);
    expect(merged.memos).toHaveLength(1);
    expect(merged.tables[0].columns.map((column) => column.id)).toEqual(schema.tables[0].columns.map((column) => column.id));
  });
});

describe("identity preservation across reads", () => {
  const cached = (ydoc: Y.Doc, schema: Schema, cache: ReadCache) =>
    schemaFromYDoc(ydoc, { id: schema.id, revision: schema.revision }, cache);

  it("returns the same table and column objects when nothing changed", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    const cache = createReadCache();
    const first = cached(ydoc, schema, cache);
    const second = cached(ydoc, schema, cache);
    expect(second.tables).toBe(first.tables);
    expect(second.tables[0]).toBe(first.tables[0]);
    expect(second.tables[0].columns[0]).toBe(first.tables[0].columns[0]);
  });

  it("replaces only the table that changed, and keeps its untouched columns", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    const cache = createReadCache();
    const first = cached(ydoc, schema, cache);
    applySchemaToYDoc(ydoc, { ...schema, tables: [{ ...schema.tables[0], x: schema.tables[0].x + 40 }, schema.tables[1]] });
    const second = cached(ydoc, schema, cache);
    expect(second.tables[0]).not.toBe(first.tables[0]);
    expect(second.tables[1]).toBe(first.tables[1]);
    expect(second.tables[0].columns[0]).toBe(first.tables[0].columns[0]);
  });

  it("without a cache every read is a fresh graph, so the projection stays pure", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    expect(read(ydoc, schema).tables[0]).not.toBe(read(ydoc, schema).tables[0]);
    expect(read(ydoc, schema)).toEqual(read(ydoc, schema));
  });
});

describe("write path", () => {
  it("writes nothing when the schema is unchanged", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    let updates = 0;
    ydoc.on("update", () => { updates += 1; });
    applySchemaToYDoc(ydoc, schema);
    expect(updates).toBe(0);
  });

  it("reordering columns leaves the untouched tables' records alone", () => {
    const schema = makeDemoSchema();
    const ydoc = seed(schema);
    const cache = createReadCache();
    const before = schemaFromYDoc(ydoc, {}, cache);
    const [first, ...rest] = schema.tables[0].columns;
    const reordered = { ...schema, tables: [{ ...schema.tables[0], columns: [...rest, first] }, schema.tables[1]] };
    applySchemaToYDoc(ydoc, reordered);
    const after = schemaFromYDoc(ydoc, {}, cache);
    expect(after.tables[0].columns.map((column) => column.id)).toEqual(reordered.tables[0].columns.map((column) => column.id));
    expect(after.tables[1]).toBe(before.tables[1]);
  });

  it("survives a reorder that also adds and removes columns", () => {
    const base = makeDemoSchema();
    const wide = ["A", "B", "C", "D"].map((name) => makeColumn({ name, type: "NUMBER", size: "" }));
    const schema = { ...base, tables: [{ ...base.tables[0], columns: wide }, base.tables[1]] };
    const ydoc = seed(schema);
    const [dropped, b, c, d] = wide;
    const added = makeColumn({ name: "ADDED", type: "NUMBER", size: "" });
    // Reversed, one gone and one new: the reorder span covers the whole list.
    const next = { ...schema, tables: [{ ...schema.tables[0], columns: [d, added, c, b] }, schema.tables[1]] };
    applySchemaToYDoc(ydoc, next);
    const columns = read(ydoc, schema).tables[0].columns;
    expect(columns.map((column) => column.id)).toEqual([d.id, added.id, c.id, b.id]);
    expect(columns.map((column) => column.id)).not.toContain(dropped.id);
  });
});

describe("writing over a doc two clients both seeded", () => {
  it("dedupes the duplicated records instead of indexing past the end", () => {
    const schema = makeDemoSchema();
    const a = seed(schema);
    sync(a, seed(schema));
    expect(schemaRoot(a).tables.length).toBe(4); // duplicated by the merge

    const renamed = { ...schema, tables: [{ ...schema.tables[0], name: "PUPIL" }, schema.tables[1]] };
    expect(() => applySchemaToYDoc(a, renamed)).not.toThrow();
    expect(schemaRoot(a).tables.length).toBe(2);
    expect(read(a, schema).tables.map((table) => table.name)).toEqual(["PUPIL", "ENROLLMENT"]);
  });
});
