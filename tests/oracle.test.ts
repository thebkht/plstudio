import { describe, expect, it } from "vitest";
import { generateDDL } from "@/app/lib/generators";
import { parseCreateTable } from "@/app/lib/parser";
import { makeDemoSchema, makeMemo, makeTable, normalizeMemos } from "@/app/lib/schema";
import { validateCheckExpression, validateSchema, validateTypeSpec } from "@/app/lib/validation";

describe("Oracle schema model", () => {
  it("generates identity without sequence or trigger artifacts", () => {
    const schema = makeDemoSchema();
    schema.tables[0].keyStrategy = "identity";
    const ddl = generateDDL(schema);
    expect(ddl).toContain("GENERATED ALWAYS AS IDENTITY");
    expect(ddl).not.toContain("CREATE SEQUENCE");
    expect(ddl).not.toContain("CREATE OR REPLACE TRIGGER");
  });

  it("creates tables before sequence triggers reference them", () => {
    const ddl = generateDDL(makeDemoSchema());
    expect(ddl.indexOf("CREATE TABLE STUDENT")).toBeLessThan(ddl.indexOf("CREATE OR REPLACE TRIGGER TRG_STUDENT"));
  });

  it("blocks foreign keys into composite primary keys", () => {
    const schema = makeDemoSchema();
    const parent = schema.tables[0];
    parent.columns[0].pk = true;
    parent.columns.push({ ...parent.columns[0], id: "composite", name: "TENANT_ID", pk: true, fk: null });
    schema.tables[1].columns[0].fk = { tableId: parent.id, columnId: parent.columns[0].id };
    expect(validateSchema(schema).some((issue) => issue.message.includes("composite-PK targets"))).toBe(true);
  });

  it("detects normalization collisions", () => {
    const schema = makeDemoSchema();
    schema.tables[0].name = "my-col";
    schema.tables[1].name = "MY_COL";
    expect(validateSchema(schema).some((issue) => issue.message.includes("collides"))).toBe(true);
  });

  it("validates check expressions using the supported subset", () => {
    expect(validateCheckExpression("STATUS IN ('A', 'I')")).toBeNull();
    expect(validateCheckExpression("STATUS IN ('A)")).toContain("not a supported");
  });

  it("validates type-specific precision and size rules", () => {
    expect(validateTypeSpec("TIMESTAMP", "9")).toBeNull();
    expect(validateTypeSpec("TIMESTAMP", "10")).toContain("0 to 9");
    expect(validateTypeSpec("NUMBER", "38,4")).toBeNull();
    expect(validateTypeSpec("NUMBER", "")).toBeNull();
    expect(validateTypeSpec("NUMBER", "39,4")).toContain("1–38");
    expect(validateTypeSpec("BLOB", "")).toBeNull();
  });

  it("imports the generated CREATE TABLE subset", () => {
    const result = parseCreateTable(`CREATE TABLE STUDENT ( ID NUMBER NOT NULL, STATUS CHAR(1) DEFAULT 'A' CHECK (STATUS IN ('A', 'I')), CONSTRAINT PK_STUDENT PRIMARY KEY (ID) );`);
    expect(result.errors).toEqual([]);
    expect(result.schema?.tables[0].columns).toHaveLength(2);
    expect(result.schema?.tables[0].columns[0].pk).toBe(true);
  });

  it("does not create a generated key strategy for composite keys", () => {
    const table = makeTable("JUNCTION", 0, 0);
    table.columns[0].pk = true;
    table.columns.push({ ...table.columns[0], id: "other", name: "OTHER_ID" });
    expect(table.columns.filter((column) => column.pk)).toHaveLength(2);
  });

  it("creates memo defaults and normalizes legacy memo data", () => {
    const memo = makeMemo("Note", 20, 30, "blue");
    expect(memo).toMatchObject({ text: "Note", x: 20, y: 30, color: "blue" });
    expect(normalizeMemos([memo, { id: "legacy", text: 12, color: "invalid" }])).toEqual([
      memo,
      { id: "legacy", text: "", x: 160, y: 120, width: 280, height: 170, color: "yellow" },
    ]);
    expect(normalizeMemos(undefined)).toEqual([]);
  });
});
