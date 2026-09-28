import {
  addConstraintLines,
  columnSpec,
  commentLines,
  createTableLines,
  ddlModel,
  sequenceLines,
  type DDLColumn,
  type DDLConstraint,
  type DDLTable,
} from "./generators";
import type { Schema } from "./schema";

/**
 * The Oracle script that takes a database built from `from` to `to`.
 *
 * Both sides go through `ddlModel`, the same resolution `generateDDL` prints,
 * so every constraint and sequence name here is the one the original DDL
 * actually created. Tables and columns are matched by id first -- which is what
 * makes a rename a rename rather than a drop and an add -- and then by name,
 * which is the only thing a baseline imported from SQL shares with the diagram.
 *
 * Statements are ordered so each one is valid against the state the previous
 * ones leave: keys are dropped before the columns and tables they touch, and
 * added after everything they reference exists.
 */
export type Migration = { sql: string; statements: number; warnings: string[] };

type Pair<T> = { from: T; to: T };

/** Id first, then name, each side used at most once. */
function match<T extends { id: string; name: string }>(from: T[], to: T[]) {
  const unused = new Set(from);
  const pairs: Pair<T>[] = [];
  const added: T[] = [];
  const take = (found: T | undefined, item: T) => {
    if (!found) return false;
    unused.delete(found);
    pairs.push({ from: found, to: item });
    return true;
  };
  const unmatched = to.filter((item) => !take([...unused].find((candidate) => candidate.id === item.id), item));
  unmatched.forEach((item) => take([...unused].find((candidate) => candidate.name === item.name), item) || added.push(item));
  return { pairs, added, removed: [...unused] };
}

const statement = (lines: string[]) => lines.join("\n");

export function generateMigration(from: Schema, to: Schema): Migration {
  const before = ddlModel(from);
  const after = ddlModel(to);
  const warnings: string[] = [];
  const tables = match(before, after);
  const tableId = new Map(tables.pairs.map(({ from, to }) => [from.id, to.id]));
  const columnId = new Map<string, string>();
  const columnPairs = new Map<DDLTable, ReturnType<typeof match<DDLColumn>>>();
  tables.pairs.forEach(({ from, to }) => {
    const columns = match(from.columns, to.columns);
    columns.pairs.forEach((pair) => columnId.set(`${from.id}\u0000${pair.from.id}`, pair.to.id));
    columnPairs.set(to, columns);
  });

  /*
   * What a constraint *is*, in the target's ids: two constraints with the same
   * signature are the same constraint whatever they are called. A column or a
   * referenced table with no counterpart means there is nothing to compare to.
   */
  const signature = (constraint: DDLConstraint, table: string, side: "from" | "to") => {
    const column = (owner: string, id: string) => (side === "to" ? id : columnId.get(`${owner}\u0000${id}`));
    const columns = constraint.columnIds.map((id) => column(table, id));
    const ref = constraint.references;
    const refTable = ref && (side === "to" ? ref.tableId : tableId.get(ref.tableId));
    const refColumns = ref ? ref.columnIds.map((id) => column(ref.tableId, id)) : [];
    if (columns.includes(undefined) || (ref && (!refTable || refColumns.includes(undefined)))) return null;
    return [constraint.kind, columns.join(","), constraint.check ?? "", refTable ?? "", refColumns.join(","), ref?.onDelete ?? ""].join("|");
  };

  const dropKeys: string[] = [];
  const dropConstraints: string[] = [];
  const renameConstraints: string[] = [];
  const addConstraints: string[] = [];
  const addKeys: string[] = [];
  const add = (table: DDLTable, constraint: DDLConstraint) =>
    (constraint.kind === "fk" ? addKeys : addConstraints).push(statement(addConstraintLines(table, constraint)));

  tables.pairs.forEach(({ from, to }) => {
    const targets = new Map<string, DDLConstraint[]>();
    to.constraints.forEach((constraint) => {
      const key = signature(constraint, to.id, "to")!;
      targets.set(key, [...(targets.get(key) ?? []), constraint]);
    });
    from.constraints.forEach((constraint) => {
      const key = signature(constraint, from.id, "from");
      const same = key ? targets.get(key)?.shift() : undefined;
      if (!same) {
        (constraint.kind === "fk" ? dropKeys : dropConstraints).push(`alter table ${from.name} drop constraint ${constraint.name};`);
        return;
      }
      if (same.name !== constraint.name)
        renameConstraints.push(`alter table ${to.name} rename constraint ${constraint.name} to ${same.name};`);
    });
    [...targets.values()].flat().forEach((constraint) => add(to, constraint));
  });

  const dropTables = tables.removed.flatMap((table) => {
    warnings.push(`Drops table ${table.name} and all of its data.`);
    return [
      `drop table ${table.name} cascade constraints;`,
      ...(table.sequence ? [`drop sequence ${table.sequence};`] : []),
    ];
  });

  const renames: string[] = [];
  const dropColumns: string[] = [];
  const alterColumns: string[] = [];
  const sequences: string[] = [];
  const comments: string[] = [];
  tables.pairs.forEach(({ from, to }) => {
    if (from.name !== to.name) renames.push(`alter table ${from.name} rename to ${to.name};`);
    const columns = columnPairs.get(to)!;
    columns.pairs.forEach(({ from: old, to: next }) => {
      if (old.name !== next.name) renames.push(`alter table ${to.name} rename column ${old.name} to ${next.name};`);
    });
    columns.removed.forEach((column) => {
      warnings.push(`Drops column ${from.name}.${column.name} and its data.`);
      dropColumns.push(`alter table ${to.name} drop column ${column.name};`);
    });
    columns.added.forEach((column) => {
      if (column.notNull && !column.defaultValue && !column.identity)
        warnings.push(`Adds ${to.name}.${column.name} as not null without a default, which fails if the table has rows.`);
      alterColumns.push(`alter table ${to.name} add (${column.name} ${columnSpec(column)});`);
    });
    columns.pairs.forEach(({ from: old, to: next }) => {
      if (old.identity !== next.identity)
        warnings.push(`${to.name}.${next.name} ${next.identity ? "becomes" : "stops being"} an identity column; Oracle cannot change that in place, so it is left to you.`);
      const parts = [
        old.type !== next.type ? next.type : "",
        old.defaultValue !== next.defaultValue ? `default ${next.defaultValue || "null"}` : "",
        old.notNull !== next.notNull ? (next.notNull ? "not null" : "null") : "",
      ].filter(Boolean);
      if (!parts.length) return;
      if (old.type !== next.type)
        warnings.push(`Changes ${to.name}.${next.name} from ${old.type} to ${next.type}, which fails or truncates if existing values do not fit.`);
      if (!old.notNull && next.notNull && !next.defaultValue)
        warnings.push(`Makes ${to.name}.${next.name} not null, which fails if any row holds a null.`);
      // The type has to lead; a bare `default …` or `null` is valid on its own.
      alterColumns.push(`alter table ${to.name} modify (${next.name} ${parts.join(" ")});`);
    });
    if (from.sequence && !to.sequence) sequences.push(`drop sequence ${from.sequence};`);
    else if (!from.sequence && to.sequence) sequences.push(statement(sequenceLines(to.sequence)));
    else if (from.sequence && to.sequence && from.sequence !== to.sequence) renames.push(`rename ${from.sequence} to ${to.sequence};`);
    if (from.comment !== to.comment) comments.push(`comment on table ${to.name} is '${to.comment.replaceAll("'", "''")}';`);
    columns.pairs.forEach(({ from: old, to: next }) => {
      if (old.comment !== next.comment) comments.push(`comment on column ${to.name}.${next.name} is '${next.comment.replaceAll("'", "''")}';`);
    });
  });

  const creates = tables.added.map((table) =>
    statement([
      ...createTableLines(table),
      ...table.constraints.filter((constraint) => constraint.kind !== "fk").flatMap((constraint) => ["", ...addConstraintLines(table, constraint)]),
      ...(commentLines(table).length ? ["", ...commentLines(table)] : []),
      ...(table.sequence ? ["", ...sequenceLines(table.sequence)] : []),
    ]),
  );
  tables.added.forEach((table) => table.constraints.filter((constraint) => constraint.kind === "fk").forEach((constraint) => add(table, constraint)));

  const sections: [string, string[]][] = [
    ["Drop foreign keys", dropKeys],
    ["Drop constraints", dropConstraints],
    ["Drop tables", dropTables],
    ["Rename", renames],
    ["Drop columns", dropColumns],
    ["Add and modify columns", alterColumns],
    ["Rename constraints", renameConstraints],
    ["Create tables", creates],
    ["Add constraints", addConstraints],
    ["Add foreign keys", addKeys],
    ["Sequences", sequences],
    ["Comments", comments],
  ];
  const present = sections.filter(([, lines]) => lines.length);
  const statements = present.reduce((total, [, lines]) => total + lines.length, 0);
  if (!statements) return { sql: "", statements: 0, warnings };
  const sql = [
    "-- ============================================================",
    `-- Oracle migration generated by Oracle Schema Designer`,
    `-- From: ${from.name}`,
    `-- To:   ${to.name}`,
    "-- Review before running: DDL commits implicitly in Oracle.",
    "-- ============================================================",
    ...present.flatMap(([title, lines]) => ["", `-- ${title}`, ...lines.flatMap((line, index) => (index ? ["", line] : [line]))]),
    "",
  ].join("\n");
  return { sql, statements, warnings };
}
