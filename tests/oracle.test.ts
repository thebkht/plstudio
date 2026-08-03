import { describe, expect, it } from "vitest";
import { generateDDL } from "@/app/lib/generators";
import { parseCreateTable } from "@/app/lib/parser";
import { makeDemoSchema, makeMemo, makeTable, normalizeMemos, normalizeRelationships } from "@/app/lib/schema";
import { validateCheckExpression, validateSchema, validateTypeSpec } from "@/app/lib/validation";

describe("Oracle schema model", () => {
  it("generates identity without sequence or trigger artifacts", () => {
    const schema = makeDemoSchema();
    schema.tables[0].keyStrategy = "identity";
    const ddl = generateDDL(schema);
    expect(ddl).toContain("generated always as identity");
    expect(ddl).not.toContain("create sequence");
    expect(ddl).not.toContain("create or replace trigger");
  });

  it("emits the requested sequence block after table definitions", () => {
    const ddl = generateDDL(makeDemoSchema());
    expect(ddl.toLowerCase().indexOf("create table student")).toBeLessThan(ddl.toLowerCase().indexOf("create sequence student_seq"));
    expect(ddl).toContain("create sequence student_seq\nstart with 1\nincrement by 1\nnocache\nnocycle;");
    expect(ddl).not.toContain("create or replace trigger");
  });

  it("migrates legacy foreign keys into DrawDB-style relationships", () => {
    const schema = makeDemoSchema();
    delete schema.relationships;
    const normalized = normalizeRelationships(schema);
    expect(normalized.schemaFormatVersion).toBe(2);
    expect(normalized.relationships).toHaveLength(1);
    expect(normalized.relationships?.[0]).toMatchObject({
      cardinality: "many_to_one",
      manyLabel: "n",
      updateConstraint: "No action",
      deleteConstraint: "No action",
    });
  });

  it("exports named composite relationships with delete actions", () => {
    const schema = makeDemoSchema();
    const parent = schema.tables[0];
    const secondParentKey = { ...parent.columns[0], id: "parent_tenant", name: "TENANT_ID", pk: true, fk: null };
    parent.columns.push(secondParentKey);
    const child = schema.tables[1];
    const secondChildKey = { ...child.columns[0], id: "child_tenant", name: "TENANT_ID", fk: null };
    child.columns.push(secondChildKey);
    schema.relationships = [{
      id: "rel_composite",
      startTableId: child.id,
      startFieldId: child.columns[0].id,
      endTableId: parent.id,
      endFieldId: parent.columns[0].id,
      fields: [
        { startFieldId: child.columns[0].id, endFieldId: parent.columns[0].id },
        { startFieldId: secondChildKey.id, endFieldId: secondParentKey.id },
      ],
      name: "FK_ENROLLMENT_STUDENT_COMPOSITE",
      cardinality: "many_to_one",
      manyLabel: "n",
      updateConstraint: "No action",
      deleteConstraint: "Cascade",
    }];
    const ddl = generateDDL(schema);
    expect(ddl).toContain("constraint fk_enrollment_student_composite");
    expect(ddl).toContain("foreign key (student_id, tenant_id) references student(id, tenant_id) on delete cascade;");
  });

  it("exports deployment-style tablespace and out-of-line constraints", () => {
    const schema = makeDemoSchema();
    schema.tables[0].comment = "Student records";
    schema.tables[0].columns[0].comment = "Primary identifier";
    schema.tables[1].columns[2].unique = true;
    const ddl = generateDDL(schema);
    expect(ddl).toContain("--drop table student;");
    expect(ddl).toContain(") tablespace core_data;");
    expect(ddl).toContain("using index tablespace core_index;");
    expect(ddl).toContain("add constraint enrollment_u1 unique (status)");
    expect(ddl).toContain("comment on table student is 'Student records';");
    expect(ddl).toContain("comment on column student.id is 'Primary identifier';");
    expect(ddl).not.toContain("status char(1) default 'A' not null unique");
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

  it("imports deployment-style DDL with out-of-line constraints and comments", () => {
    const source = makeDemoSchema();
    source.tables[0].comment = "Student records";
    source.tables[0].columns[0].comment = "Primary identifier";
    const result = parseCreateTable(generateDDL(source));
    expect(result.errors).toEqual([]);
    expect(result.schema?.tables).toHaveLength(2);
    expect(result.schema?.tables[0].comment).toBe("Student records");
    expect(result.schema?.tables[0].columns[0]).toMatchObject({ pk: true, comment: "Primary identifier" });
    expect(result.schema?.tables[1].columns[0].fk).toMatchObject({
      tableId: result.schema?.tables[0].id,
      columnId: result.schema?.tables[0].columns[0].id,
    });
  });

  it("imports relationship names, composite pairs, and delete actions", () => {
    const result = parseCreateTable(`CREATE TABLE PARENT ( ID NUMBER NOT NULL, TENANT_ID NUMBER NOT NULL, CONSTRAINT PK_PARENT PRIMARY KEY (ID, TENANT_ID) ); CREATE TABLE CHILD ( PARENT_ID NUMBER NOT NULL, TENANT_ID NUMBER NOT NULL ); ALTER TABLE CHILD ADD CONSTRAINT FK_CHILD_PARENT FOREIGN KEY (PARENT_ID, TENANT_ID) REFERENCES PARENT(ID, TENANT_ID) ON DELETE CASCADE;`);
    expect(result.errors).toEqual([]);
    expect(result.schema?.relationships).toHaveLength(1);
    expect(result.schema?.relationships?.[0]).toMatchObject({ name: "FK_CHILD_PARENT", deleteConstraint: "Cascade" });
    expect(result.schema?.relationships?.[0].fields).toHaveLength(2);
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
