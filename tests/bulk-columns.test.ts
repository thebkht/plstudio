import { describe, expect, it } from "vitest";
import { findColumns, patchColumns, renameColumns } from "@/app/lib/bulk-columns";
import { makeColumn, makeDemoSchema, type Schema } from "@/app/lib/schema";

/** STUDENT(ID) and ENROLLMENT(STUDENT_ID, COURSE_CODE, STATUS, ENROLLED_ON), plus a NOTES column on STUDENT. */
const demo = (): Schema => {
  const schema = makeDemoSchema();
  schema.tables[0].columns.push(makeColumn({ name: "NOTES", type: "VARCHAR2", size: "400" }));
  return schema;
};
const names = (schema: Schema) => schema.tables.flatMap((table) => table.columns.map((column) => `${table.name}.${column.name}`));
const column = (schema: Schema, name: string) => schema.tables.flatMap((table) => table.columns).find((item) => item.name === name)!;

describe("findColumns", () => {
  it("matches the qualified name, case-insensitively", () => {
    const schema = demo();
    const resolve = (refs: ReturnType<typeof findColumns>) => refs.map((ref) => schema.tables.find((table) => table.id === ref.tableId)!.columns.find((item) => item.id === ref.columnId)!.name);
    expect(resolve(findColumns(schema, { text: "student" }))).toEqual(["ID", "NOTES", "STUDENT_ID"]);
    expect(resolve(findColumns(schema, { text: "enrollment.st" }))).toEqual(["STUDENT_ID", "STATUS"]);
    expect(resolve(findColumns(schema, { type: "VARCHAR2" }))).toEqual(["NOTES", "COURSE_CODE"]);
    expect(findColumns(schema, { tableId: schema.tables[1].id })).toHaveLength(4);
  });
});

describe("patchColumns", () => {
  it("changes only the patched properties of the chosen columns", () => {
    const schema = demo();
    const refs = findColumns(schema, { type: "VARCHAR2" });
    const next = patchColumns(schema, refs, { notNull: true, defaultValue: "'-'" });
    expect(column(next, "NOTES")).toMatchObject({ notNull: true, defaultValue: "'-'", size: "400" });
    expect(column(next, "STATUS")).toEqual(column(schema, "STATUS"));
  });

  it("drops the size along with a sized type", () => {
    const schema = demo();
    const next = patchColumns(schema, findColumns(schema, { type: "VARCHAR2" }), { type: "DATE" });
    expect([column(next, "NOTES"), column(next, "COURSE_CODE")].map((item) => [item.type, item.size])).toEqual([["DATE", ""], ["DATE", ""]]);
  });

  it("leaves tables with no chosen column untouched", () => {
    const schema = demo();
    const next = patchColumns(schema, findColumns(schema, { text: "notes" }), { notNull: true });
    expect(next.tables[1]).toBe(schema.tables[1]);
  });
});

describe("renameColumns", () => {
  it("replaces plain text everywhere it occurs, reporting only real changes", () => {
    const schema = demo();
    const result = renameColumns(schema, findColumns(schema, {}), "student", "PUPIL");
    expect(result.renames.map((rename) => `${rename.before}->${rename.after}`)).toEqual(["STUDENT_ID->PUPIL_ID"]);
    expect(names(result.schema)).toContain("ENROLLMENT.PUPIL_ID");
  });

  it("supports regex groups, and treats $ literally in plain mode", () => {
    const schema = demo();
    const all = findColumns(schema, {});
    expect(renameColumns(schema, all, "^(.*)_ID$", "$1_KEY", { regex: true }).renames.map((rename) => rename.after)).toEqual(["STUDENT_KEY"]);
    expect(renameColumns(schema, all, "NOTES", "N$&", {}).renames[0].after).toBe("N$&");
  });

  it("respects case sensitivity", () => {
    const schema = demo();
    expect(renameColumns(schema, findColumns(schema, {}), "notes", "x", { caseSensitive: true }).renames).toEqual([]);
  });

  it("reports an invalid pattern instead of throwing", () => {
    const schema = demo();
    const result = renameColumns(schema, findColumns(schema, {}), "(", "x", { regex: true });
    expect(result.error).toBeTruthy();
    expect(result.schema).toBe(schema);
  });
});
