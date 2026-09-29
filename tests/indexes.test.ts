import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applySchemaToYDoc, schemaFromYDoc } from "@/app/lib/collab/ydoc";
import { generateDDL } from "@/app/lib/generators";
import { generateMigration } from "@/app/lib/migration";
import { parseCreateTable } from "@/app/lib/parser";
import { exportSchemaJson, mergeSchemaJson } from "@/app/lib/schema-json";
import { makeDemoSchema, makeEmptySchema, makeIndex, makeUniqueConstraint, normalizeRelationships, normalizeTables, type Schema } from "@/app/lib/schema";
import { validateSchema } from "@/app/lib/validation";

const indexed = () => {
  const schema = makeDemoSchema();
  const enrollment = schema.tables[1];
  enrollment.indexes = [makeIndex([enrollment.columns[0].id]), makeIndex([enrollment.columns[2].id, enrollment.columns[3].id], "ENROLLMENT_STATUS_IX")];
  return schema;
};

describe("table indexes", () => {
  it("leaves a diagram without indexes generating the DDL it always did", () => {
    const schema = makeDemoSchema();
    const withEmpty = structuredClone(schema);
    withEmpty.tables[1].indexes = [];
    expect(generateDDL(withEmpty)).toBe(generateDDL(schema));
    expect(generateDDL(schema)).not.toContain("create index");
  });

  it("prints each index after the table's constraints, named as asked or numbered", () => {
    const ddl = generateDDL(indexed());
    expect(ddl).toContain("create index enrollment_i1 on enrollment (student_id);");
    expect(ddl).toContain("create index enrollment_status_ix on enrollment (status, enrolled_on);");
    expect(ddl.indexOf("create index enrollment_i1")).toBeGreaterThan(ddl.indexOf("add constraint enrollment_c1"));
  });

  it("round-trips through the parser, and reads a unique index as a unique constraint", () => {
    const parsed = parseCreateTable(generateDDL(normalizeRelationships(indexed())));
    expect(parsed.errors).toEqual([]);
    const enrollment = parsed.schema!.tables.find((table) => table.name === "enrollment")!;
    const names = (ids: string[]) => ids.map((id) => enrollment.columns.find((column) => column.id === id)?.name);
    expect(enrollment.indexes?.map((index) => names(index.columnIds))).toEqual([["student_id"], ["status", "enrolled_on"]]);

    const unique = parseCreateTable("create table t (a number, b number);\ncreate unique index t_ab on t (a, b desc);\ncreate index t_fn on t (upper(a));");
    expect(unique.schema!.tables[0].uniques).toHaveLength(1);
    expect(unique.schema!.tables[0].indexes).toBeUndefined();
    expect(unique.warnings.some((warning) => /t_fn/.test(warning))).toBe(true);
  });

  it("prunes index members against surviving columns and drops the empties", () => {
    const schema = indexed();
    schema.tables[1].indexes!.push(makeIndex(["col_gone"]), makeIndex([schema.tables[1].columns[0].id, "col_gone"]));
    const indexes = normalizeTables(schema).tables[1].indexes!;
    // The last one shrinks to the first one's set and collapses into it.
    expect(indexes).toHaveLength(2);
  });

  it("warns when an index is covered by the primary key, a unique or another index", () => {
    const schema = makeDemoSchema();
    const [student, enrollment] = schema.tables;
    student.indexes = [makeIndex([student.columns[0].id])];
    enrollment.uniques = [makeUniqueConstraint([enrollment.columns[0].id, enrollment.columns[1].id])];
    enrollment.indexes = [makeIndex([enrollment.columns[0].id]), makeIndex([enrollment.columns[2].id])];
    const warnings = validateSchema(schema).filter((issue) => /already covered/.test(issue.message)).map((issue) => issue.message);
    expect(warnings).toEqual([
      "STUDENT: index 1 is already covered by the primary key.",
      "ENROLLMENT: index 1 is already covered by unique constraint 1.",
    ]);
  });

  it("drops, creates and renames indexes in a migration", () => {
    const before = indexed();
    const after = structuredClone(before);
    const enrollment = after.tables[1];
    enrollment.indexes = [
      { ...enrollment.indexes![1], name: "ENROLLMENT_STATE_IX" },
      makeIndex([enrollment.columns[1].id]),
    ];
    const { sql } = generateMigration(before, after);
    expect(sql).toContain("drop index enrollment_i1;");
    expect(sql).toContain("alter index enrollment_status_ix rename to enrollment_state_ix;");
    expect(sql).toContain("create index enrollment_i2 on enrollment (course_code);");
    expect(sql.indexOf("drop index")).toBeLessThan(sql.indexOf("create index"));
  });

  it("syncs through the shared document and survives a JSON merge on new ids", () => {
    const schema = indexed();
    const read = (value: Schema) => schemaFromYDoc(applySchemaToYDoc(new Y.Doc(), value), { id: value.id, revision: value.revision });
    expect(read(schema).tables[1].indexes).toEqual(schema.tables[1].indexes);

    const added = mergeSchemaJson(makeEmptySchema(), exportSchemaJson(schema)).added[1];
    expect(added.indexes?.[0].columnIds).toEqual([added.columns[0].id]);
    expect(added.indexes?.[0].id).not.toBe(schema.tables[1].indexes![0].id);
  });
});
