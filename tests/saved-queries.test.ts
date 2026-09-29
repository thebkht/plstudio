import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applySchemaToYDoc, isEmptyDoc, schemaFromYDoc } from "@/app/lib/collab/ydoc";
import { exportSchemaJson, mergeSchemaJson, parseSchemaJson } from "@/app/lib/schema-json";
import { makeDemoSchema, makeSavedQuery, normalizeQueries } from "@/app/lib/schema";
import { EMPTY_SELECTION, selectionSchema } from "@/app/lib/selection";

const withQueries = () => ({
  ...makeDemoSchema(),
  queries: [makeSavedQuery("select * from student", "All students", 40), makeSavedQuery("select 1 from dual")],
});

describe("saved queries", () => {
  it("round-trips through the shared document", () => {
    const schema = withQueries();
    const ydoc = applySchemaToYDoc(new Y.Doc(), schema);
    expect(schemaFromYDoc(ydoc, { id: schema.id, revision: schema.revision })).toEqual(schema);
    expect(isEmptyDoc(applySchemaToYDoc(new Y.Doc(), { ...makeDemoSchema(), tables: [], queries: schema.queries }))).toBe(false);
  });

  it("round-trips through the JSON export and re-mints ids on a merge", () => {
    const schema = withQueries();
    expect(parseSchemaJson(exportSchemaJson(schema)).schema?.queries).toEqual(schema.queries);
    const base = makeDemoSchema();
    base.tables = base.tables.map((table) => ({ ...table, name: `${table.name}_X` }));
    const merged = mergeSchemaJson(base, exportSchemaJson(schema)).schema!;
    expect(merged.queries?.map((query) => query.sql)).toEqual(schema.queries.map((query) => query.sql));
    expect(merged.queries?.[0].id).not.toBe(schema.queries[0].id);
  });

  it("drops malformed entries and non-positive weights", () => {
    expect(normalizeQueries([{ id: "q1", sql: "select 1", executions: -3 }, { id: "q2" }, null, { id: "q3", sql: "x", executions: 2.6 }]))
      .toEqual([{ id: "q1", name: "", sql: "select 1", executions: undefined }, { id: "q3", name: "", sql: "x", executions: 3 }]);
  });

  it("is not carried by a copied selection", () => {
    expect(selectionSchema(withQueries(), EMPTY_SELECTION).queries).toEqual([]);
  });
});
