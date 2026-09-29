import { describe, expect, it } from "vitest";
import { analyzeQueries, heatLevel, resolveQuery, splitQueries, tableIndex } from "@/app/lib/query-analysis";
import { makeColumn, makeDemoSchema, makeIndex, makeSavedQuery, makeTable, normalizeRelationships, type Schema } from "@/app/lib/schema";

/** The demo's STUDENT <- ENROLLMENT foreign key, plus a COURSE table joined without one. */
const fixture = () => {
  const schema = normalizeRelationships(makeDemoSchema());
  const course = makeTable("COURSE", 0, 0);
  course.columns.push(makeColumn({ name: "CODE", type: "VARCHAR2", size: "20" }), makeColumn({ name: "TITLE" }));
  schema.tables.push(course);
  return schema;
};
const [STUDENT, ENROLLMENT, COURSE] = [0, 1, 2];
const col = (schema: Schema, table: number, name: string) => schema.tables[table].columns.find((column) => column.name === name)!.id;

describe("splitQueries", () => {
  it("splits on semicolons and slash lines outside quotes and comments, reading weights", () => {
    const chunks = splitQueries([
      "-- executions: 500",
      "select * from student where name = 'a;b';",
      "12\tselect 1 from dual;",
      "/* ; */ select 2 from dual",
      "/",
      "select 3 from dual; -- trailing comment",
    ].join("\n"));
    expect(chunks.map((chunk) => chunk.executions)).toEqual([500, 12, 1, 1]);
    expect(chunks[0].sql).toBe("select * from student where name = 'a;b'");
    expect(chunks[1].sql).toBe("select 1 from dual");
  });
});

describe("resolveQuery", () => {
  it("follows aliases, owner prefixes and bare column names", () => {
    const schema = fixture();
    const resolved = resolveQuery(
      `select e.status from core.enrollment e join "STUDENT" s on e.student_id = s.id where status = 'A' and e.enrolled_on > :since`,
      tableIndex(schema),
    );
    expect(resolved.tableIds).toEqual([schema.tables[ENROLLMENT].id, schema.tables[STUDENT].id]);
    expect(resolved.joins).toEqual([{
      from: { tableId: schema.tables[ENROLLMENT].id, columnId: col(schema, ENROLLMENT, "STUDENT_ID") },
      to: { tableId: schema.tables[STUDENT].id, columnId: col(schema, STUDENT, "ID") },
    }]);
    expect(resolved.predicates.map((predicate) => [predicate.columnId, predicate.kind])).toEqual([
      [col(schema, ENROLLMENT, "STATUS"), "eq"],
      [col(schema, ENROLLMENT, "ENROLLED_ON"), "range"],
    ]);
    expect(resolved.unresolved).toEqual([]);
  });

  it("reports unknown tables but not CTEs or DUAL, and ignores a leading-wildcard LIKE", () => {
    const schema = fixture();
    const resolved = resolveQuery(
      "with recent as (select * from enrollment) select * from recent r, invoices i, dual where r.status like '%A'",
      tableIndex(schema),
    );
    expect(resolved.unresolved).toEqual(["INVOICES"]);
    expect(resolved.predicates).toEqual([]);
  });
});

describe("analyzeQueries", () => {
  it("heats tables and the foreign key a join runs over, weighted by executions", () => {
    const schema = fixture();
    schema.queries = [
      makeSavedQuery("select * from enrollment e join student s on s.id = e.student_id", "", 30),
      makeSavedQuery("select * from student where id = :id"),
    ];
    const analysis = analyzeQueries(schema);
    const [relationship] = schema.relationships!;
    expect(analysis.tableHeat.get(schema.tables[STUDENT].id)).toBe(31);
    expect(analysis.tableHeat.get(schema.tables[ENROLLMENT].id)).toBe(30);
    expect(analysis.edgeHeat.get(relationship.id)).toBe(30);
    expect(analysis.tableLevels.get(schema.tables[STUDENT].id)).toBe(2);
    expect(analysis.tableLevels.has(schema.tables[COURSE].id)).toBe(false);
  });

  it("levels heat by order of magnitude, so a lone query run once stays cool", () => {
    expect([1, 9, 10, 99, 100, 999, 1000, 5_000_000].map(heatLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    const schema = fixture();
    schema.queries = [makeSavedQuery("select * from course")];
    expect(analyzeQueries(schema).tableLevels.get(schema.tables[COURSE].id)).toBe(1);
  });

  it("surfaces a join with no foreign key behind it", () => {
    const schema = fixture();
    schema.queries = [makeSavedQuery("select * from enrollment e join course c on c.code = e.course_code", "", 4)];
    const { implicitJoins, edgeHeat } = analyzeQueries(schema);
    expect(edgeHeat.size).toBe(0);
    expect(implicitJoins).toHaveLength(1);
    expect(implicitJoins[0].weight).toBe(4);
  });

  it("suggests the unindexed foreign key and a composite filter, and nothing already covered", () => {
    const schema = fixture();
    schema.queries = [
      makeSavedQuery("select * from enrollment e join student s on s.id = e.student_id", "", 30),
      makeSavedQuery("select * from enrollment where course_code = :c and status = 'A' and enrolled_on > sysdate - 7", "", 5),
    ];
    const suggestions = analyzeQueries(schema).suggestions.map((suggestion) => ({ ...suggestion, names: suggestion.columnIds.map((id) => schema.tables[ENROLLMENT].columns.find((column) => column.id === id)?.name) }));
    expect(suggestions.map(({ names, reason, weight }) => ({ names, reason, weight }))).toEqual([
      { names: ["STUDENT_ID"], reason: "fk", weight: 30 },
      { names: ["COURSE_CODE", "STATUS", "ENROLLED_ON"], reason: "composite", weight: 5 },
    ]);

    // STUDENT.ID is the primary key, so its side of the join is never suggested;
    // an index on the foreign key retires that suggestion too.
    schema.tables[ENROLLMENT].indexes = [makeIndex([col(schema, ENROLLMENT, "STUDENT_ID")])];
    expect(analyzeQueries(schema).suggestions.map((suggestion) => suggestion.reason)).toEqual(["composite"]);
  });
});
