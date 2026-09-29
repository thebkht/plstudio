import { describe, expect, it } from "vitest";
import { columnImpact, impactHighlight } from "@/app/lib/impact";
import { makeColumn, makeDemoSchema, makeIndex, makeSavedQuery, makeUniqueConstraint, normalizeRelationships } from "@/app/lib/schema";

const fixture = () => {
  const schema = normalizeRelationships(makeDemoSchema());
  const [student, enrollment] = schema.tables;
  enrollment.columns.push(makeColumn({ name: "MODIFY_ON", type: "DATE", size: "" }));
  enrollment.uniques = [makeUniqueConstraint([enrollment.columns[0].id, enrollment.columns[1].id])];
  enrollment.indexes = [makeIndex([enrollment.columns[2].id, enrollment.columns[0].id])];
  schema.queries = [
    makeSavedQuery("select * from enrollment e join student s on s.id = e.student_id", "Roster"),
    makeSavedQuery("select course_code from enrollment"),
  ];
  return { schema, student, enrollment };
};
const summary = (items: ReturnType<typeof columnImpact>) => items.map((item) => `${item.kind} ${item.label} ${item.drop ? "D" : "-"}${item.rename ? "R" : "-"}`);

describe("columnImpact", () => {
  it("finds the key, the incoming foreign key, the sequence, the package and the queries of a primary key", () => {
    const { schema, student } = fixture();
    const items = columnImpact(schema, { tableId: student.id, columnId: student.columns[0].id });
    expect(summary(items)).toEqual([
      "key student_pk D-",
      "fk-in fk_enrollment_student_id_student D-",
      "sequence student_seq D-",
      "plsql Osm_Dml.Ins_STUDENT DR",
      "plsql Osm_Dml.Upd_STUDENT DR",
      "plsql Osm_Dml.Del_STUDENT DR",
      "query Roster DR",
    ]);
    expect(items[1].edgeIds).toEqual([schema.relationships![0].id]);
  });

  it("finds the unique, the foreign key, the index and a check that names the column", () => {
    const { schema, enrollment } = fixture();
    enrollment.columns[2].check = "STATUS IN ('A', 'I') OR STUDENT_ID IS NULL";
    const items = columnImpact(schema, { tableId: enrollment.id, columnId: enrollment.columns[0].id });
    expect(summary(items)).toEqual([
      "unique enrollment_u1 D-",
      "fk-out fk_enrollment_student_id_student D-",
      "check enrollment_c1 DR",
      "index enrollment_i1 D-",
      "plsql Osm_Dml.Ins_ENROLLMENT --",
      "plsql Osm_Dml.Upd_ENROLLMENT DR",
      "plsql Osm_Dml.Del_ENROLLMENT DR",
      "query Roster DR",
    ]);
    const lit = impactHighlight({ tableId: enrollment.id, columnId: enrollment.columns[0].id }, items);
    expect(lit.tables).toEqual(new Set([enrollment.id, schema.tables[0].id]));
    expect(lit.columns.has(`${enrollment.id}:${enrollment.columns[1].id}`)).toBe(true);
  });

  it("marks the insert as naming an audit column, and skips a check that only quotes the name", () => {
    const { schema, enrollment } = fixture();
    enrollment.columns[2].check = "STATUS IN ('MODIFY_ON')";
    const modifyOn = enrollment.columns.find((column) => column.name === "MODIFY_ON")!;
    const items = columnImpact(schema, { tableId: enrollment.id, columnId: modifyOn.id });
    // ENROLLMENT has no primary key, so Del_ matches on every column, this one included.
    expect(summary(items)).toEqual(["plsql Osm_Dml.Ins_ENROLLMENT DR", "plsql Osm_Dml.Upd_ENROLLMENT DR", "plsql Osm_Dml.Del_ENROLLMENT DR"]);
  });

  it("returns nothing for a column that is gone", () => {
    const { schema, enrollment } = fixture();
    expect(columnImpact(schema, { tableId: enrollment.id, columnId: "col_gone" })).toEqual([]);
  });
});
