import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applySchemaToYDoc, schemaFromYDoc } from "@/app/lib/collab/ydoc";
import { generateDDL } from "@/app/lib/generators";
import { applyColumnTemplate, BUILTIN_COLUMN_TEMPLATES, makeColumn, makeColumnTemplate, makeDemoSchema, makeTable, normalizeColumnTemplates } from "@/app/lib/schema";
import { exportSchemaJson, parseSchemaJson } from "@/app/lib/schema-json";
import { validateSchema } from "@/app/lib/validation";

const audit = BUILTIN_COLUMN_TEMPLATES.find((template) => template.id === "builtin_audit")!;

describe("column templates", () => {
  it("appends the template's columns with fresh ids", () => {
    const table = makeTable("ORDERS", 0, 0);
    const next = applyColumnTemplate(table, audit);
    expect(next.columns.map((column) => column.name)).toEqual(["ID", "CREATED_AT", "CREATED_BY", "UPDATED_AT", "UPDATED_BY"]);
    expect(new Set(next.columns.map((column) => column.id)).size).toBe(next.columns.length);
    expect(next.columns.every((column) => column.fk === null)).toBe(true);
  });

  it("skips a column the table already has, compared as Oracle compares names", () => {
    const table = { ...makeTable("ORDERS", 0, 0), columns: [makeColumn({ name: "created_at", type: "DATE", size: "" })] };
    const next = applyColumnTemplate(table, audit);
    expect(next.columns.filter((column) => column.name.toUpperCase() === "CREATED_AT")).toHaveLength(1);
    // A second application is a no-op, and returns the table untouched.
    expect(applyColumnTemplate(next, audit)).toBe(next);
  });

  it("produces built-ins that validate and generate", () => {
    const schema = makeDemoSchema();
    schema.tables[0] = BUILTIN_COLUMN_TEMPLATES.reduce(applyColumnTemplate, schema.tables[0]);
    expect(validateSchema(schema).filter((issue) => issue.severity === "error")).toEqual([]);
    expect(generateDDL(schema)).toContain("IS_DELETED IN (0, 1)");
  });

  it("drops the id and foreign key when saving columns as a template", () => {
    const column = makeColumn({ name: "OWNER_ID", type: "NUMBER", size: "", fk: { tableId: "t", columnId: "c" } });
    const template = makeColumnTemplate("Owned", [column]);
    expect(template.columns[0]).not.toHaveProperty("id");
    expect(template.columns[0]).not.toHaveProperty("fk");
  });

  it("normalizes away malformed templates and columns", () => {
    const valid = makeColumnTemplate("Ok", [makeColumn({ name: "A" })]);
    const result = normalizeColumnTemplates([
      valid,
      null,
      { id: "", columns: [] },
      { id: "t2", name: "", columns: [{ name: "X", type: "NOPE" }, { name: "Y", type: "DATE", notNull: "yes" }] },
      { id: "t3", columns: [{ name: " ", type: "DATE" }] },
    ]);
    expect(result.map((template) => template.id)).toEqual([valid.id, "t2"]);
    expect(result[1]).toMatchObject({ name: "Untitled template", columns: [{ name: "Y", type: "DATE", notNull: false }] });
  });

  it("round-trips through the shared document and the JSON export", () => {
    const schema = { ...makeDemoSchema(), columnTemplates: [makeColumnTemplate("Mine", [makeColumn({ name: "TENANT_ID", type: "NUMBER", size: "", notNull: true })])] };
    expect(schemaFromYDoc(applySchemaToYDoc(new Y.Doc(), schema), { id: schema.id, revision: schema.revision }).columnTemplates).toEqual(schema.columnTemplates);
    expect(parseSchemaJson(exportSchemaJson(schema)).schema?.columnTemplates).toEqual(schema.columnTemplates);
  });
});
