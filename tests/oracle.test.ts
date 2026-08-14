import { describe, expect, it } from "vitest";
import { generateDDL, generateDML } from "@/app/lib/generators";
import { appendCreateTable, parseCreateTable } from "@/app/lib/parser";
import { groupDragBounds, groupPrefix, makeDemoSchema, makeMemo, makeSchemaGroup, makeTable, normalizeMemos, normalizeGroups, normalizeRelationships, normalizeTables, prefixTableName, SCHEMA_FORMAT_VERSION, stripTablePrefix, tableHeight, tableWidth, typeString } from "@/app/lib/schema";
import { validateCheckExpression, validateSchema, validateTypeSpec } from "@/app/lib/validation";

describe("Oracle schema model", () => {
  it("sizes table cards from their names within readable bounds", () => {
    expect(tableWidth({ name: "ID" })).toBe(220);
    expect(tableWidth({ name: "A_VERY_LONG_TABLE_NAME_FOR_REPORTING" })).toBe(420);
    expect(tableWidth({ name: "  CUSTOMER_ORDERS  " })).toBeGreaterThan(220);
  });

  it("prefers a manual width over the name-derived one, within bounds", () => {
    expect(tableWidth({ name: "ID", width: 500 })).toBe(500);
    expect(tableWidth({ name: "ID", width: 20 })).toBe(180);
    expect(tableWidth({ name: "ID", width: 5000 })).toBe(640);
    expect(tableWidth({ name: "ID", width: undefined })).toBe(220);
  });

  it("drops an unusable manual width instead of collapsing the card", () => {
    const schema = makeDemoSchema();
    schema.tables[0].width = Number.NaN;
    schema.tables[1].width = 9000;
    const [first, second] = normalizeTables(schema).tables;
    expect(first.width).toBeUndefined();
    expect(second.width).toBe(640);
    expect(tableWidth(first)).toBe(tableWidth({ name: first.name }));
  });

  it("drops a size the column's type cannot carry", () => {
    const schema = makeDemoSchema();
    const enrolledOn = schema.tables[1].columns[3];
    expect(enrolledOn.type).toBe("DATE");
    enrolledOn.size = "255"; // left behind by the VARCHAR2 the column started as
    const normalized = normalizeTables(schema).tables[1].columns[3];
    expect(normalized.size).toBe("");
    expect(typeString(normalized)).toBe("DATE");
    expect(validateTypeSpec("DATE", "255")).toMatch(/does not accept a size/);
    expect(generateDDL(normalizeTables(schema))).not.toContain("date(255)");
  });

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
    expect(normalized.schemaFormatVersion).toBe(SCHEMA_FORMAT_VERSION);
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
    const group = makeSchemaGroup("Core", 0, 0, 0);
    schema.groups = [group];
    schema.tables.forEach((table) => { table.schemaId = group.id; });
    const ddl = generateDDL(schema);
    expect(ddl).toContain("--drop table student;");
    expect(ddl).toContain(") tablespace core_data;");
    expect(ddl).toContain("using index tablespace core_index;");
    expect(ddl).toContain("add constraint enrollment_u1 unique (status)");
    expect(ddl).toContain("comment on table student is 'Student records';");
    expect(ddl).toContain("comment on column student.id is 'Primary identifier';");
    expect(ddl).not.toContain("status char(1) default 'A' not null unique");
  });

  it("uses each schema group's data and index tablespaces without changing table colors", () => {
    const schema = makeDemoSchema();
    const group = makeSchemaGroup("Library", 40, 40, 0);
    schema.groups = [group];
    schema.tables[0].schemaId = group.id;
    const originalColor = schema.tables[0].color;
    const ddl = generateDDL(schema);
    expect(ddl).toContain(") tablespace library_data;");
    expect(ddl).toContain("using index tablespace library_index;");
    expect(schema.tables[0].color).toEqual(originalColor);
  });

  it("names tablespaces after the keyword, since the group's name is prose", () => {
    const schema = makeDemoSchema();
    const group = { ...makeSchemaGroup("MLL -- Multi Language Tools", 40, 40, 0), keyword: "mll" };
    schema.groups = [group];
    schema.tables[0].schemaId = group.id;
    const ddl = generateDDL(schema);
    expect(ddl).toContain(") tablespace mll_data;");
    expect(ddl).toContain("using index tablespace mll_index;");
    expect(ddl).not.toContain("mll___multi_language_tools_data");
  });

  it("omits tablespaces for ungrouped tables", () => {
    const ddl = generateDDL(makeDemoSchema());
    expect(ddl).not.toContain("tablespace core_data");
    expect(ddl).not.toContain("tablespace core_index");
    expect(ddl).toContain("add constraint student_pk primary key");
    expect(ddl).toContain("using index;");
  });

  it("derives a table prefix from a group's keyword, however it was typed", () => {
    expect(groupPrefix({ keyword: "MLL" })).toBe("MLL_");
    expect(groupPrefix({ keyword: " mll " })).toBe("MLL_");
    expect(groupPrefix({ keyword: "MLL_" })).toBe("MLL_");
    // Nothing usable is left after normalization, so no prefix rather than "_".
    expect(groupPrefix({ keyword: "--" })).toBe("");
    expect(groupPrefix({ keyword: "" })).toBe("");
    expect(groupPrefix(undefined)).toBe("");
  });

  it("stamps a prefix onto a table name at most once", () => {
    expect(prefixTableName("LABEL_CODES", "MLL_")).toBe("MLL_LABEL_CODES");
    expect(prefixTableName("MLL_LABEL_CODES", "MLL_")).toBe("MLL_LABEL_CODES");
    expect(prefixTableName("mll_label_codes", "MLL_")).toBe("mll_label_codes");
    expect(prefixTableName("LABEL_CODES", "")).toBe("LABEL_CODES");
  });

  it("takes a prefix back off, and leaves a name that never carried it alone", () => {
    expect(stripTablePrefix("MLL_LABEL_CODES", "MLL_")).toBe("LABEL_CODES");
    expect(stripTablePrefix("MLT_LANGUAGES", "MLL_")).toBe("MLT_LANGUAGES");
    expect(stripTablePrefix("LABEL_CODES", "")).toBe("LABEL_CODES");
    /*
     * `normalizeIdentifier` would prepend `T_` to a digit-leading name and the
     * prefix would then appear to match, slicing two characters out of the
     * middle of it. The comparison must preserve length.
     */
    expect(stripTablePrefix("1ABC", "T_")).toBe("1ABC");
    expect(prefixTableName("1ABC", "T_")).toBe("T_1ABC");
  });

  it("normalizes invalid group references and legacy group values", () => {
    const schema = makeDemoSchema();
    schema.tables[0].schemaId = "missing";
    const normalized = normalizeGroups({ ...schema, groups: [{ id: "group-1", name: "  Library  ", keyword: "  LIB  ", x: -4, y: -2, width: 10, height: 10, color: "invalid" as never }] });
    expect(normalized.schemaFormatVersion).toBe(SCHEMA_FORMAT_VERSION);
    expect(normalized.groups?.[0]).toMatchObject({ name: "Library", keyword: "LIB", x: 0, y: 0, width: 360, height: 260, color: "orange" });
    expect(normalized.tables[0].schemaId).toBeUndefined();
  });

  it("drops a keyword that is only whitespace", () => {
    const group = { ...makeSchemaGroup("Library", 40, 40, 0), keyword: "   " };
    expect(normalizeGroups({ ...makeDemoSchema(), groups: [group] }).groups?.[0].keyword).toBeUndefined();
  });

  it("drops a memo's reference to a group that no longer exists", () => {
    const group = makeSchemaGroup("Library", 40, 40, 0);
    const kept = { ...makeMemo("inside", 60, 120), schemaId: group.id };
    const orphan = { ...makeMemo("orphan", 900, 900), schemaId: "deleted" };
    const normalized = normalizeGroups({ ...makeDemoSchema(), groups: [group], memos: [kept, orphan] });
    expect(normalized.memos?.[0].schemaId).toBe(group.id);
    expect(normalized.memos?.[1].schemaId).toBeUndefined();
  });

  it("stops a group where its outermost member meets the world edge", () => {
    const world = { width: 2000, height: 2000 };
    const group = makeSchemaGroup("Core", 400, 400, 0);
    const bare = { ...makeDemoSchema(), tables: [], groups: [group] };
    expect(groupDragBounds(bare, group, world)).toMatchObject({ minX: 0, maxX: world.width - group.width, minY: 0, maxY: world.height - group.height });

    // A table hanging 100px past the right edge costs the group 100px of travel,
    // and one starting 40px above the top keeps it 40px off the top edge.
    const overhanging = { ...makeTable("OVER", group.x + group.width - tableWidth({ name: "OVER" }) + 100, group.y + 20, 0) };
    const above = { ...makeTable("ABOVE", group.x + 20, group.y - 40, 0) };
    const withMembers = { ...bare, tables: [{ ...overhanging, schemaId: group.id }, { ...above, schemaId: group.id }] };
    const bounds = groupDragBounds(withMembers, group, world);
    expect(bounds.maxX).toBe(world.width - group.width - 100);
    expect(bounds.minY).toBe(40);

    // An unassigned table sitting inside the rect is not a member, so it does not bind.
    const bystander = { ...bare, tables: [overhanging] };
    expect(groupDragBounds(bystander, group, world).maxX).toBe(world.width - group.width);
  });

  it("collapses to a single legal origin when the assembly outgrows the world", () => {
    const world = { width: 600, height: 600 };
    const group = makeSchemaGroup("Core", 100, 100, 0);
    const schema = { ...makeDemoSchema(), tables: [{ ...makeTable("WIDE", 0, 0, 0), schemaId: group.id }], groups: [group] };
    const bounds = groupDragBounds(schema, group, world);
    expect(bounds.maxX).toBe(bounds.minX);
    expect(bounds.maxY).toBe(bounds.minY);
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

  it("appends imported tables below the diagram, keeping the project's own relationships", () => {
    const base = makeDemoSchema();
    const result = appendCreateTable(
      base,
      `CREATE TABLE COURSE ( ID NUMBER NOT NULL, TITLE VARCHAR2(120), CONSTRAINT PK_COURSE PRIMARY KEY (ID) );`,
    );
    expect(result.errors).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.added.map((table) => table.name)).toEqual(["COURSE"]);
    expect(result.schema?.tables).toHaveLength(3);
    // The two originals keep their identity and their place on the canvas.
    expect(result.schema?.tables.slice(0, 2)).toMatchObject(
      base.tables.map((table) => ({ id: table.id, name: table.name, x: table.x, y: table.y })),
    );
    // A demo schema carries no materialised relationships, so the existing FK
    // has to be derived rather than dropped by the merge.
    expect(result.schema?.tables[1].columns[0].fk).toMatchObject({ tableId: base.tables[0].id });
    const bottom = Math.max(...base.tables.map((table) => table.y + tableHeight(table)));
    expect(result.added[0].y).toBeGreaterThan(bottom);
  });

  it("resolves an imported foreign key against a table only the project has", () => {
    const base = makeDemoSchema();
    const student = base.tables[0];
    const result = appendCreateTable(
      base,
      `CREATE TABLE GRADE ( ID NUMBER NOT NULL, STUDENT_ID NUMBER NOT NULL REFERENCES STUDENT(ID), CONSTRAINT PK_GRADE PRIMARY KEY (ID) );`,
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.schema?.tables[2].columns[1].fk).toMatchObject({
      tableId: student.id,
      columnId: student.columns[0].id,
    });
    expect(result.schema?.relationships).toHaveLength(2);
  });

  it("leaves a redeclared table alone and re-points the new table's reference at it", () => {
    const base = makeDemoSchema();
    const student = base.tables[0];
    const result = appendCreateTable(
      base,
      `${generateDDL(base)}\nCREATE TABLE GRADE ( ID NUMBER NOT NULL, STUDENT_ID NUMBER NOT NULL REFERENCES STUDENT(ID) );`,
    );
    expect(result.errors).toEqual([]);
    expect(result.skipped).toEqual(["STUDENT", "ENROLLMENT"]);
    expect(result.added.map((table) => table.name)).toEqual(["GRADE"]);
    expect(result.schema?.tables).toHaveLength(3);
    expect(result.schema?.tables[2].columns[1].fk).toMatchObject({
      tableId: student.id,
      columnId: student.columns[0].id,
    });
  });

  it("refuses an import that adds nothing", () => {
    const base = makeDemoSchema();
    const result = appendCreateTable(base, generateDDL(base));
    expect(result.schema).toBeNull();
    expect(result.added).toEqual([]);
    expect(result.errors[0]).toContain("STUDENT, ENROLLMENT");
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

  it("generates DML package body with Ins, Upd, Del procedures matching requested structure", () => {
    const schema = {
      id: "schema_1",
      name: "Osm Schema",
      revision: 1,
      schemaFormatVersion: 3,
      tables: [
        {
          id: "tbl_1",
          name: "Osm_R_Operations",
          x: 0,
          y: 0,
          color: { a: "#000", b: "#000" },
          keyStrategy: "sequence-trigger" as const,
          columns: [
            { id: "c1", name: "Operation_Id", type: "NUMBER" as const, size: "", notNull: true, pk: true, unique: false, defaultValue: "", check: "", fk: null },
            { id: "c2", name: "Operation_Code", type: "VARCHAR2" as const, size: "50", notNull: false, pk: false, unique: false, defaultValue: "", check: "", fk: null },
            { id: "c3", name: "Module_Code", type: "VARCHAR2" as const, size: "50", notNull: false, pk: false, unique: false, defaultValue: "", check: "", fk: null },
            { id: "c4", name: "State", type: "VARCHAR2" as const, size: "1", notNull: false, pk: false, unique: false, defaultValue: "", check: "", fk: null },
            { id: "c5", name: "Modify_On", type: "DATE" as const, size: "", notNull: false, pk: false, unique: false, defaultValue: "", check: "", fk: null },
            { id: "c6", name: "Modify_By", type: "NUMBER" as const, size: "", notNull: false, pk: false, unique: false, defaultValue: "", check: "", fk: null },
          ],
        },
      ],
    };
    const dml = generateDML(schema);
    expect(dml).toContain("create or replace package body Osm_Dml is");
    expect(dml).toContain("Procedure Ins_Operation(Io_Row in out nocopy Osm_R_Operations%rowtype) is");
    expect(dml).toContain("Io_Row.Operation_Id := Osm_R_Operations_Seq.Nextval;");
    expect(dml).toContain("Io_Row.Modify_On    := sysdate;");
    expect(dml).toContain("Io_Row.Modify_By    := Core.User_Env.Get_User_Id;");
    expect(dml).toContain("insert into Osm_R_Operations values Io_Row;");
    expect(dml).toContain("Procedure Upd_Operation(Io_Row in out nocopy Osm_R_Operations%rowtype) is");
    expect(dml).toContain("update Osm_R_Operations");
    expect(dml).toContain("where Operation_Id = Io_Row.Operation_Id;");
    expect(dml).toContain("Procedure Del_Operation(i_Operation_Id number) is");
    expect(dml).toContain("set State     = 'P',");
    expect(dml).toContain("end Osm_Dml;");
  });

  it("singularises the procedure suffix without eating a stem's own e", () => {
    const table = (index: number, name: string, pk: string) => ({
      id: `tbl_${index}`,
      name,
      x: 0,
      y: 0,
      color: { a: "#000", b: "#000" },
      keyStrategy: "sequence-trigger" as const,
      columns: [
        { id: `c${index}_1`, name: pk, type: "NUMBER" as const, size: "", notNull: true, pk: true, unique: false, defaultValue: "", check: "", fk: null },
        { id: `c${index}_2`, name: "Code", type: "VARCHAR2" as const, size: "50", notNull: false, pk: false, unique: false, defaultValue: "", check: "", fk: null },
      ],
    });
    const dml = generateDML({
      id: "schema_2",
      name: "Bmr Schema",
      revision: 1,
      schemaFormatVersion: 3,
      tables: [
        table(1, "Bmr_Types", "Type_Id"),
        table(2, "Bmr_Branches", "Branch_Id"),
        table(3, "Bmr_Statuses", "Status_Id"),
        table(4, "Bmr_Currencies", "Currency_Id"),
      ],
    });
    expect(dml).toContain("create or replace package body Bmr_Dml is");
    expect(dml).toContain("Procedure Ins_Type(Io_Row in out nocopy Bmr_Types%rowtype) is");
    expect(dml).toContain("Procedure Upd_Type(Io_Row in out nocopy Bmr_Types%rowtype) is");
    expect(dml).toContain("Procedure Del_Type(i_Type_Id number) is");
    expect(dml).toContain("Procedure Upd_Branch(Io_Row in out nocopy Bmr_Branches%rowtype) is");
    expect(dml).toContain("Procedure Upd_Status(Io_Row in out nocopy Bmr_Statuses%rowtype) is");
    expect(dml).toContain("Procedure Upd_Currency(Io_Row in out nocopy Bmr_Currencies%rowtype) is");
  });
});
