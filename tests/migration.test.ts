import { describe, expect, it } from "vitest";
import { generateDDL } from "@/app/lib/generators";
import { generateMigration } from "@/app/lib/migration";
import { parseCreateTable } from "@/app/lib/parser";
import { makeColumn, makeDemoSchema, makeTable, makeUniqueConstraint, normalizeRelationships, type Schema } from "@/app/lib/schema";

const clone = (schema: Schema) => structuredClone(schema);
const table = (schema: Schema, name: string) => schema.tables.find((candidate) => candidate.name === name)!;
/** Statement order, by the first line of each — enough to assert sequencing. */
const order = (sql: string, ...needles: string[]) => needles.map((needle) => sql.indexOf(needle));

describe("generateMigration", () => {
  it("emits nothing between identical schemas", () => {
    const schema = makeDemoSchema();
    expect(generateMigration(schema, clone(schema))).toEqual({ sql: "", statements: 0, warnings: [] });
  });

  it("round-trips its own DDL: a baseline parsed from generateDDL output is no change", () => {
    const schema = normalizeRelationships(makeDemoSchema());
    const parsed = parseCreateTable(generateDDL(schema));
    expect(parsed.errors).toEqual([]);
    // Fresh ids on every parsed table and column, so this only passes by name.
    expect(generateMigration(parsed.schema!, schema).sql).toBe("");
  });

  it("renames a table and a column matched by id instead of dropping them", () => {
    const before = makeDemoSchema();
    const after = clone(before);
    table(after, "STUDENT").name = "PUPIL";
    table(after, "ENROLLMENT").columns[1].name = "COURSE";
    const { sql, warnings } = generateMigration(before, after);
    expect(sql).toContain("alter table student rename to pupil;");
    expect(sql).toContain("alter table enrollment rename column course_code to course;");
    // The key and sequence were named after the old table, so they follow it.
    expect(sql).toContain("alter table pupil rename constraint student_pk to pupil_pk;");
    expect(sql).toContain("rename student_seq to pupil_seq;");
    expect(sql).not.toMatch(/drop (table|column)/);
    expect(warnings).toEqual([]);
  });

  it("adds, modifies and drops columns, warning about the destructive ones", () => {
    const before = makeDemoSchema();
    const after = clone(before);
    const enrollment = table(after, "ENROLLMENT");
    enrollment.columns = enrollment.columns.filter((column) => column.name !== "ENROLLED_ON");
    enrollment.columns[1] = { ...enrollment.columns[1], size: "10", defaultValue: "'X'" };
    enrollment.columns.push(makeColumn({ name: "GRADE", type: "NUMBER", size: "3", notNull: true }));
    const { sql, warnings } = generateMigration(before, after);
    expect(sql).toContain("alter table enrollment drop column enrolled_on;");
    expect(sql).toContain("alter table enrollment modify (course_code varchar2(10) default 'X');");
    expect(sql).toContain("alter table enrollment add (grade number(3) not null);");
    expect(warnings).toContain("Drops column enrollment.enrolled_on and its data.");
    expect(warnings.join("\n")).toMatch(/varchar2\(20\) to varchar2\(10\)/);
    expect(warnings.join("\n")).toMatch(/grade as not null without a default/i);
  });

  it("only states nullability when it changes, since Oracle rejects a redundant not null", () => {
    const before = makeDemoSchema();
    const after = clone(before);
    table(after, "ENROLLMENT").columns[1].notNull = false;
    expect(generateMigration(before, after).sql).toContain("alter table enrollment modify (course_code null);");
  });

  it("creates new tables whole, and adds their foreign keys after every table exists", () => {
    const before = makeDemoSchema();
    const after = clone(before);
    const course = makeTable("COURSE", 0, 0);
    course.columns.push(makeColumn({ name: "TITLE", unique: true }));
    const student = table(after, "STUDENT");
    course.columns.push(makeColumn({ name: "OWNER_ID", type: "NUMBER", size: "", fk: { tableId: student.id, columnId: student.columns[0].id } }));
    after.tables.push(course);
    after.relationships = [];
    const { sql } = generateMigration(before, normalizeRelationships(after));
    expect(sql).toContain("create table course (");
    expect(sql).toContain("add constraint course_u1 unique (title)");
    expect(sql).toContain("create sequence course_seq");
    const [create, fk] = order(sql, "create table course (", "foreign key (owner_id) references student(id)");
    expect(create).toBeGreaterThan(-1);
    expect(fk).toBeGreaterThan(create);
  });

  it("drops a removed table after the foreign keys into it, with its sequence", () => {
    const before = normalizeRelationships(makeDemoSchema());
    const after = clone(before);
    after.tables = after.tables.filter((candidate) => candidate.name !== "STUDENT");
    after.relationships = [];
    table(after, "ENROLLMENT").columns[0].fk = null;
    const { sql, warnings } = generateMigration(before, after);
    const [dropKey, dropTable] = order(sql, "alter table enrollment drop constraint", "drop table student cascade constraints;");
    expect(dropKey).toBeGreaterThan(-1);
    expect(dropTable).toBeGreaterThan(dropKey);
    expect(sql).toContain("drop sequence student_seq;");
    expect(warnings).toContain("Drops table student and all of its data.");
  });

  it("replaces a constraint whose columns changed rather than renaming it", () => {
    const before = makeDemoSchema();
    const enrollment = table(before, "ENROLLMENT");
    enrollment.uniques = [makeUniqueConstraint([enrollment.columns[0].id, enrollment.columns[1].id], "enrollment_uk")];
    const after = clone(before);
    const next = table(after, "ENROLLMENT");
    next.uniques = [makeUniqueConstraint([next.columns[0].id, next.columns[3].id], "enrollment_uk")];
    const { sql } = generateMigration(before, after);
    const [drop, add] = order(sql, "alter table enrollment drop constraint enrollment_uk;", "unique (student_id, enrolled_on)");
    expect(drop).toBeGreaterThan(-1);
    expect(add).toBeGreaterThan(drop);
  });

  it("changes a check by dropping and re-adding it, and updates comments", () => {
    const before = makeDemoSchema();
    const after = clone(before);
    const status = table(after, "ENROLLMENT").columns[2];
    status.check = "STATUS IN ('A', 'I', 'X')";
    status.comment = "Lifecycle";
    const { sql } = generateMigration(before, after);
    expect(sql).toContain("alter table enrollment drop constraint enrollment_c1;");
    expect(sql).toContain("check (STATUS IN ('A', 'I', 'X'));");
    expect(sql).toContain("comment on column enrollment.status is 'Lifecycle';");
  });
});
