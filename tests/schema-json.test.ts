import { describe, expect, it } from "vitest";
import { EXPORT_APP, EXPORT_FORMAT_VERSION, exportSchemaJson, mergeSchemaJson, parseSchemaJson } from "@/app/lib/schema-json";
import { APPEND_GAP, contentEdges, makeColumn, makeDemoSchema, makeEmptySchema, makeMemo, makeSchemaGroup, makeTable, normalizeRelationships, SCHEMA_FORMAT_VERSION, type Schema } from "@/app/lib/schema";

/** The demo schema with its `column.fk` migrated into real relationships. */
const demo = () => normalizeRelationships(makeDemoSchema());
const envelope = (schema: unknown) => JSON.stringify({ formatVersion: EXPORT_FORMAT_VERSION, exportedAt: "2026-01-01T00:00:00.000Z", app: EXPORT_APP, schema });
const ids = (schema: Schema) => schema.tables.flatMap((table) => [table.id, ...table.columns.map((column) => column.id)]);

describe("Schema JSON export", () => {
  it("round-trips a diagram through JSON with its canvas intact", () => {
    const base = demo();
    base.groups = [makeSchemaGroup("Core", 40, 40)];
    base.memos = [makeMemo("remember me", 500, 600)];
    base.tables[0].schemaId = base.groups[0].id;
    const result = parseSchemaJson(exportSchemaJson(base));
    expect(result.errors).toEqual([]);
    expect(result.schema?.tables).toEqual(base.tables);
    expect(result.schema?.relationships).toEqual(base.relationships);
    expect(result.schema?.groups).toEqual(base.groups);
    expect(result.schema?.memos).toEqual(base.memos);
  });

  it("wraps the schema in an envelope naming the format, the app and the moment", () => {
    const written = JSON.parse(exportSchemaJson(demo(), "2026-01-01T00:00:00.000Z"));
    expect(written.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(written.app).toBe(EXPORT_APP);
    expect(written.exportedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(written.schema.schemaFormatVersion).toBe(SCHEMA_FORMAT_VERSION);
  });

  it("leaves the project's id and revision out of the file", () => {
    const written = JSON.parse(exportSchemaJson(demo()));
    expect(written.schema).not.toHaveProperty("id");
    expect(written.schema).not.toHaveProperty("revision");
    expect(written.schema).not.toHaveProperty("updatedAt");
  });

  it("always writes every collection, so a reader never tells absent from empty", () => {
    const written = JSON.parse(exportSchemaJson(makeEmptySchema()));
    expect(written.schema).toMatchObject({ tables: [], groups: [], relationships: [], memos: [] });
  });
});

describe("Schema JSON import", () => {
  it("refuses text that is not JSON", () => {
    const result = parseSchemaJson("CREATE TABLE STUDENT (ID NUMBER);");
    expect(result.schema).toBeNull();
    expect(result.errors[0]).toMatch(/not valid json/i);
  });

  it("refuses a top-level value that is not an object", () => {
    ["[]", "null", '"schema"', "42"].forEach((text) => expect(parseSchemaJson(text).schema).toBeNull());
  });

  it("refuses an export written by a newer format, naming the version", () => {
    const result = parseSchemaJson(JSON.stringify({ formatVersion: 99, schema: { tables: [] } }));
    expect(result.schema).toBeNull();
    expect(result.errors[0]).toMatch(/format 99/);
  });

  it("refuses an export with no tables array instead of throwing on it", () => {
    const text = envelope({ name: "Broken" });
    expect(() => parseSchemaJson(text)).not.toThrow();
    expect(parseSchemaJson(text).errors[0]).toMatch(/tables/i);
  });

  it("survives junk in every collection it is handed", () => {
    const result = parseSchemaJson(envelope({ tables: [], groups: 7, relationships: "no", memos: null }));
    expect(result.errors).toEqual([]);
    expect(result.schema).toMatchObject({ tables: [], groups: [], relationships: [], memos: [] });
  });

  it("drops a table with no id and keeps the rest, saying so", () => {
    const base = demo();
    const result = parseSchemaJson(envelope({ tables: [{ name: "GHOST" }, ...base.tables] }));
    expect(result.schema?.tables).toHaveLength(2);
    expect(result.warnings.join(" ")).toMatch(/no id/i);
  });

  it("drops duplicate table and column ids", () => {
    const base = demo();
    const twin = { ...base.tables[0], columns: [...base.tables[0].columns, base.tables[0].columns[0]] };
    const result = parseSchemaJson(envelope({ tables: [twin, base.tables[0]] }));
    expect(result.schema?.tables).toHaveLength(1);
    expect(result.schema?.tables[0].columns).toHaveLength(base.tables[0].columns.length);
    expect(result.warnings.join(" ")).toMatch(/duplicate/i);
  });

  it("imports an unknown column type as VARCHAR2 rather than losing the column", () => {
    const base = demo();
    const table = { ...base.tables[0], columns: [{ ...base.tables[0].columns[0], type: "JSONB" }] };
    const result = parseSchemaJson(envelope({ tables: [table] }));
    expect(result.schema?.tables[0].columns).toHaveLength(1);
    expect(result.schema?.tables[0].columns[0].type).toBe("VARCHAR2");
    expect(result.warnings.join(" ")).toMatch(/unknown type "JSONB"/);
  });

  it("defaults an unrecognised key strategy, colour and constraint", () => {
    const base = demo();
    const table = { ...base.tables[0], keyStrategy: "magic", color: "blue" };
    const relationship = { ...base.relationships![0], cardinality: "sideways", deleteConstraint: "Explode" };
    const result = parseSchemaJson(envelope({ tables: [table, base.tables[1]], relationships: [relationship] }));
    expect(result.schema?.tables[0].keyStrategy).toBe("none");
    expect(result.schema?.tables[0].color).toMatchObject({ a: expect.any(String), b: expect.any(String) });
    expect(result.schema?.relationships?.[0]).toMatchObject({ cardinality: "many_to_one", deleteConstraint: "No action" });
  });

  it("drops a relationship whose tables it cannot resolve", () => {
    const base = demo();
    const stray = { ...base.relationships![0], endTableId: "tbl_gone" };
    const result = parseSchemaJson(envelope({ tables: base.tables, relationships: [stray] }));
    expect(result.schema?.relationships).toEqual([]);
  });

  it("accepts a bare schema object with no envelope, saying it had to guess", () => {
    const result = parseSchemaJson(JSON.stringify(demo()));
    expect(result.schema?.tables).toHaveLength(2);
    expect(result.warnings.join(" ")).toMatch(/no export envelope/i);
  });

  it("keeps an empty diagram importable", () => {
    const result = parseSchemaJson(exportSchemaJson(makeEmptySchema("Blank")));
    expect(result.errors).toEqual([]);
    expect(result.schema).toMatchObject({ name: "Blank", tables: [] });
  });
});

describe("Schema JSON merge", () => {
  it("re-mints every id, so a project can absorb its own export without collisions", () => {
    const base = demo();
    const file = exportSchemaJson(base);
    const renamed = { ...base, tables: base.tables.map((table) => ({ ...table, name: `${table.name}_V1` })) };
    const result = mergeSchemaJson(renamed, file);
    expect(result.schema?.tables).toHaveLength(4);
    expect(new Set(ids(result.schema!)).size).toBe(ids(result.schema!).length);
  });

  it("re-points merged relationships at the minted ids", () => {
    const base = demo();
    const file = exportSchemaJson(base);
    const renamed = { ...base, tables: base.tables.map((table) => ({ ...table, name: `${table.name}_V1` })) };
    const result = mergeSchemaJson(renamed, file);
    const merged = result.schema!.relationships!.filter((relationship) => result.added.some((table) => table.id === relationship.startTableId));
    expect(merged).toHaveLength(1);
    expect(result.added.some((table) => table.id === merged[0].endTableId)).toBe(true);
  });

  it("lands the added tables clear of everything already drawn", () => {
    const base = demo();
    const bottom = contentEdges(base)!.bottom;
    const result = mergeSchemaJson({ ...base, tables: base.tables.map((table) => ({ ...table, name: `${table.name}_V1` })) }, exportSchemaJson(base));
    expect(Math.min(...result.added.map((table) => table.y))).toBeGreaterThanOrEqual(bottom + APPEND_GAP);
    expect(Math.min(...result.added.map((table) => table.x))).toBe(contentEdges(base)!.left);
  });

  it("places the file's tables where it left them when the project is empty", () => {
    const base = demo();
    const result = mergeSchemaJson(makeEmptySchema(), exportSchemaJson(base));
    expect(result.added.map((table) => [table.x, table.y])).toEqual(base.tables.map((table) => [table.x, table.y]));
  });

  it("leaves a redeclared table alone and re-points the file's reference at the project's", () => {
    const base = demo();
    const result = mergeSchemaJson(base, exportSchemaJson(base).replace(/ENROLLMENT/g, "SIGNUP"));
    expect(result.skipped).toEqual(["STUDENT"]);
    expect(result.added.map((table) => table.name)).toEqual(["SIGNUP"]);
    const fk = result.added[0].columns.find((column) => column.name === "STUDENT_ID")?.fk;
    expect(fk).toEqual({ tableId: base.tables[0].id, columnId: base.tables[0].columns[0].id });
  });

  it("drops a reference into a redeclared table that has no column of that name", () => {
    const base = demo();
    const file = exportSchemaJson(base).replace(/ENROLLMENT/g, "SIGNUP");
    const renamedColumn = { ...base.tables[0], columns: [{ ...base.tables[0].columns[0], name: "STUDENT_KEY" }] };
    const result = mergeSchemaJson({ ...base, tables: [renamedColumn, base.tables[1]] }, file);
    expect(result.added[0].columns.find((column) => column.name === "STUDENT_ID")?.fk).toBeNull();
  });

  it("refuses a merge that would add nothing, listing what is already there", () => {
    const base = demo();
    const result = mergeSchemaJson(base, exportSchemaJson(base));
    expect(result.schema).toBeNull();
    expect(result.errors[0]).toMatch(/already in this project: STUDENT, ENROLLMENT/i);
  });

  it("keeps the project's own foreign keys when they live only in column.fk", () => {
    const base = makeDemoSchema();
    const incoming = { ...makeEmptySchema("Extra"), tables: [makeTable("COURSE", 900, 900, 2)] };
    const result = mergeSchemaJson(base, exportSchemaJson(incoming));
    const enrollment = result.schema?.tables.find((table) => table.name === "ENROLLMENT");
    expect(enrollment?.columns.find((column) => column.name === "STUDENT_ID")?.fk).toEqual({
      tableId: base.tables[0].id,
      columnId: base.tables[0].columns[0].id,
    });
  });

  it("carries groups and memos across, with each table following its group's new id", () => {
    const incoming = demo();
    const group = makeSchemaGroup("Core", 40, 40);
    incoming.groups = [group];
    incoming.memos = [makeMemo("keep me", 500, 600)];
    incoming.tables[0].schemaId = group.id;
    const result = mergeSchemaJson(makeEmptySchema(), exportSchemaJson(incoming));
    expect(result.schema?.groups).toHaveLength(1);
    expect(result.schema?.groups?.[0].id).not.toBe(group.id);
    expect(result.added[0].schemaId).toBe(result.schema?.groups?.[0].id);
    expect(result.schema?.memos?.[0]).toMatchObject({ text: "keep me" });
  });

  it("drops a group none of whose tables were added", () => {
    const base = demo();
    const incoming = demo();
    const group = makeSchemaGroup("Core", 40, 40);
    incoming.groups = [group];
    // STUDENT collides with the project's, so its group has nothing left to hold.
    incoming.tables[0].schemaId = group.id;
    incoming.tables[1].name = "SIGNUP";
    const result = mergeSchemaJson(base, exportSchemaJson(incoming));
    expect(result.added.map((table) => table.name)).toEqual(["SIGNUP"]);
    expect(result.schema?.groups).toEqual([]);
  });

  it("keeps the colours the file was saved with instead of continuing the palette", () => {
    const incoming = { ...makeEmptySchema("Extra"), tables: [{ ...makeTable("COURSE", 900, 900, 2), color: { a: "#123456", b: "#654321" } }] };
    const result = mergeSchemaJson(demo(), exportSchemaJson(incoming));
    expect(result.added[0].color).toEqual({ a: "#123456", b: "#654321" });
  });

  it("refuses a file with no tables to add", () => {
    const result = mergeSchemaJson(demo(), exportSchemaJson(makeEmptySchema()));
    expect(result.schema).toBeNull();
    expect(result.errors[0]).toMatch(/no tables/i);
  });

  it("reports the parse failure rather than merging garbage", () => {
    const result = mergeSchemaJson(demo(), "{ not json");
    expect(result.schema).toBeNull();
    expect(result.added).toEqual([]);
    expect(result.errors[0]).toMatch(/not valid json/i);
  });

  it("carries a column's comment and manual width through a merge", () => {
    const table = { ...makeTable("COURSE", 900, 900, 2), width: 320, comment: "catalogue" };
    table.columns = [makeColumn({ name: "CODE", type: "VARCHAR2", size: "20", comment: "catalogue code" })];
    const result = mergeSchemaJson(demo(), exportSchemaJson({ ...makeEmptySchema("Extra"), tables: [table] }));
    expect(result.added[0]).toMatchObject({ width: 320, comment: "catalogue" });
    expect(result.added[0].columns[0].comment).toBe("catalogue code");
  });
});
