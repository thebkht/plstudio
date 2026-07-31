import { describe, expect, it } from "vitest";
import { generateDDL } from "@/app/lib/generators";
import { parseCreateTable } from "@/app/lib/parser";
import { makeDemoSchema, makeTable } from "@/app/lib/schema";
import { validateCheckExpression, validateSchema } from "@/app/lib/validation";

describe("Oracle schema model", () => {
  it("generates identity without sequence or trigger artifacts", () => {
    const schema = makeDemoSchema();
    schema.tables[0].keyStrategy = "identity";
    const ddl = generateDDL(schema);
    expect(ddl).toContain("GENERATED ALWAYS AS IDENTITY");
    expect(ddl).not.toContain("CREATE SEQUENCE");
    expect(ddl).not.toContain("CREATE OR REPLACE TRIGGER");
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
});
