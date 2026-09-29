import {
  normalizeIdentifier,
  normalizeGroups,
  normalizeRelationships,
  primaryKeyColumns,
  type Schema,
  type Table,
  type Column,
  typeString,
} from "./schema";

function shorten(value: string, used: Set<string>) {
  const clean = normalizeIdentifier(value).toLowerCase();
  if (clean.length <= 128 && !used.has(clean)) {
    used.add(clean);
    return clean;
  }
  const hash = [...clean]
    .reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 46656, 7)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  const candidate = `${clean.slice(0, 124 - hash.length)}_${hash}`;
  used.add(candidate);
  return candidate;
}

function sqlIdentifier(value: string) {
  return normalizeIdentifier(value).toLowerCase();
}

function sqlComment(value: string) {
  return value.replaceAll("'", "''");
}

/**
 * Everything `generateDDL` prints, resolved but not yet printed: identifiers
 * normalized, constraint and sequence names minted through the one shared
 * `shorten` set, in the order the DDL mints them. The migration generator diffs
 * two of these, which is the only way its constraint names can agree with the
 * ones the original DDL actually created.
 */
export type DDLColumn = {
  id: string;
  name: string;
  /** `varchar2(100)`, lower-case as printed. */
  type: string;
  identity: boolean;
  defaultValue: string;
  notNull: boolean;
  comment: string;
};

export type DDLConstraint = {
  kind: "pk" | "unique" | "check" | "fk";
  name: string;
  columnIds: string[];
  columns: string[];
  check?: string;
  references?: { tableId: string; table: string; columnIds: string[]; columns: string[]; onDelete: string };
  /** `-- DrawDB on …` lines printed ahead of a foreign key. */
  notes?: string[];
};

/** A plain `create index`, kept apart from `constraints` so their numbering never moves. */
export type DDLIndex = { name: string; columnIds: string[]; columns: string[] };

export type DDLTable = {
  id: string;
  name: string;
  columns: DDLColumn[];
  dataTablespace: string;
  indexTablespace: string;
  constraints: DDLConstraint[];
  indexes: DDLIndex[];
  comment: string;
  /** Minted only for `sequence-trigger` tables with a single NUMBER key. */
  sequence?: string;
};

const hasSequence = (table: Table) => {
  const pk = primaryKeyColumns(table);
  return table.keyStrategy === "sequence-trigger" && pk.length === 1 && pk[0].type === "NUMBER";
};

export function ddlModel(schema: Schema): DDLTable[] {
  const usedNames = new Set<string>();
  const canonical = normalizeGroups(normalizeRelationships({
    ...schema,
    relationships: schema.relationships?.length
      ? schema.relationships
      : undefined,
  }), true);
  const groupsById = new Map((canonical.groups ?? []).map((group) => [group.id, group]));
  const tablesById = new Map<string, Table>();
  canonical.tables.forEach((table) => { if (!tablesById.has(table.id)) tablesById.set(table.id, table); });
  const relationshipsByTable = new Map<string, NonNullable<Schema["relationships"]>>();
  canonical.relationships?.forEach((relationship) => {
    const current = relationshipsByTable.get(relationship.startTableId) ?? [];
    current.push(relationship);
    relationshipsByTable.set(relationship.startTableId, current);
  });

  const tables = canonical.tables.map((table): DDLTable => {
    const tableName = sqlIdentifier(table.name);
    const pk = primaryKeyColumns(table);
    const outgoing = relationshipsByTable.get(table.id) ?? [];
    const columns = table.columns.map((column): DDLColumn => ({
      id: column.id,
      name: sqlIdentifier(column.name),
      type: typeString(column).toLowerCase(),
      identity: table.keyStrategy === "identity" && column.pk && pk.length === 1 && column.type === "NUMBER",
      defaultValue: column.defaultValue.trim(),
      notNull: column.notNull || column.pk,
      comment: column.comment?.trim() ?? "",
    }));
    const byId = new Map(columns.map((column) => [column.id, column]));
    const names = (ids: string[]) => ids.map((id) => byId.get(id)!.name);
    const group = table.schemaId ? groupsById.get(table.schemaId) : undefined;
    /*
     * The keyword is the module's short code, which is what a tablespace is
     * actually named after; the group's display name is prose, and
     * `MLL -- MULTI LANGUAGE TOOLS` normalizes to the unusable
     * `mll___multi_language_tools_data`. Falling back to the name keeps every
     * diagram written before keywords generating byte-identical DDL.
     */
    const tablespace = group ? sqlIdentifier(group.keyword?.trim() || group.name) : "";
    const constraints: DDLConstraint[] = [];
    if (pk.length) {
      const ids = pk.map((column) => column.id);
      constraints.push({ kind: "pk", name: shorten(`${tableName}_pk`, usedNames), columnIds: ids, columns: names(ids) });
    }
    const columnUniques = table.columns.filter((column) => column.unique);
    columnUniques.forEach((column, index) =>
      constraints.push({ kind: "unique", name: shorten(`${tableName}_u${index + 1}`, usedNames), columnIds: [column.id], columns: names([column.id]) }),
    );
    /*
     * Numbered on from the single-column ones so a diagram that has none of
     * these generates byte-identical DDL to the build before they existed.
     */
    (table.uniques ?? []).forEach((constraint, index) => {
      if (!constraint.columnIds.every((id) => byId.has(id))) return;
      const name = constraint.name?.trim() || `${tableName}_u${columnUniques.length + index + 1}`;
      constraints.push({ kind: "unique", name: shorten(name, usedNames), columnIds: constraint.columnIds, columns: names(constraint.columnIds) });
    });
    table.columns
      .filter((column) => column.check.trim())
      .forEach((column, index) =>
        constraints.push({ kind: "check", name: shorten(`${tableName}_c${index + 1}`, usedNames), columnIds: [column.id], columns: names([column.id]), check: column.check.trim() }),
      );
    outgoing.forEach((relationship, index) => {
      const endTable = tablesById.get(relationship.endTableId);
      if (!endTable) return;
      const pairs = relationship.fields.length
        ? relationship.fields
        : [{ startFieldId: relationship.startFieldId, endFieldId: relationship.endFieldId }];
      const startColumns = pairs.map((pair) => table.columns.find((column) => column.id === pair.startFieldId)).filter((column): column is Column => Boolean(column));
      const endColumns = pairs.map((pair) => endTable.columns.find((column) => column.id === pair.endFieldId)).filter((column): column is Column => Boolean(column));
      if (startColumns.length !== pairs.length || endColumns.length !== pairs.length) return;
      const onDelete =
        relationship.deleteConstraint === "Cascade" || relationship.deleteConstraint === "Set null"
          ? relationship.deleteConstraint.toLowerCase()
          : "";
      const notes = [
        ...(relationship.updateConstraint !== "No action" ? [`-- DrawDB on update: ${relationship.updateConstraint}`] : []),
        ...(relationship.deleteConstraint !== "No action" && !onDelete ? [`-- DrawDB on delete: ${relationship.deleteConstraint}`] : []),
      ];
      const ids = startColumns.map((column) => column.id);
      constraints.push({
        kind: "fk",
        name: shorten(relationship.name || `${tableName}_f${index + 1}`, usedNames),
        columnIds: ids,
        columns: names(ids),
        references: {
          tableId: endTable.id,
          table: sqlIdentifier(endTable.name),
          columnIds: endColumns.map((column) => column.id),
          columns: endColumns.map((column) => sqlIdentifier(column.name)),
          onDelete,
        },
        notes,
      });
    });
    // Minted after the table's constraints, so a diagram with no indexes names
    // everything exactly as it did before indexes existed.
    const indexes = (table.indexes ?? [])
      .filter((index) => index.columnIds.length && index.columnIds.every((id) => byId.has(id)))
      .map((index, position): DDLIndex => ({
        name: shorten(index.name?.trim() || `${tableName}_i${position + 1}`, usedNames),
        columnIds: index.columnIds,
        columns: names(index.columnIds),
      }));
    return {
      id: table.id,
      name: tableName,
      columns,
      dataTablespace: group ? ` tablespace ${tablespace}_data` : "",
      indexTablespace: group ? ` tablespace ${tablespace}_index` : "",
      constraints,
      indexes,
      comment: table.comment?.trim() ?? "",
    };
  });
  // Sequences are named after every constraint, exactly as they are printed.
  canonical.tables.forEach((table, index) => {
    if (hasSequence(table)) tables[index].sequence = shorten(`${sqlIdentifier(table.name)}_seq`, usedNames);
  });
  return tables;
}

/** `create table` plus its column list, as `generateDDL` prints it. */
export function createTableLines(table: DDLTable) {
  const width = Math.max(...table.columns.map((column) => column.name.length), 0);
  return [
    `create table ${table.name} (`,
    table.columns.map((column) => `  ${column.name.padEnd(width + 3)}${columnSpec(column)}`).join(",\n"),
    `)${table.dataTablespace};`,
  ];
}

/** A column's type and attributes: everything after its name. */
export function columnSpec(column: DDLColumn) {
  const attrs = [column.defaultValue ? `default ${column.defaultValue}` : "", column.notNull ? "not null" : ""].filter(Boolean).join(" ");
  return `${column.type}${column.identity ? " generated always as identity" : ""}${attrs ? ` ${attrs}` : ""}`;
}

/** One constraint as its own `alter table … add constraint` statement. */
export function addConstraintLines(table: Pick<DDLTable, "name" | "indexTablespace">, constraint: DDLConstraint) {
  const columns = constraint.columns.join(", ");
  switch (constraint.kind) {
    case "pk":
    case "unique":
      return [
        `alter table ${table.name}`,
        `  add constraint ${constraint.name} ${constraint.kind === "pk" ? "primary key" : "unique"} (${columns})`,
        `  using index${table.indexTablespace};`,
      ];
    case "check":
      return [`alter table ${table.name}`, `  add constraint ${constraint.name}`, `  check (${constraint.check});`];
    case "fk": {
      const ref = constraint.references!;
      return [
        ...(constraint.notes ?? []),
        `alter table ${table.name}`,
        `  add constraint ${constraint.name}`,
        `  foreign key (${columns}) references ${ref.table}(${ref.columns.join(", ")})${ref.onDelete ? ` on delete ${ref.onDelete}` : ""};`,
      ];
    }
  }
}

/** One `create index` statement. */
export function indexLines(table: Pick<DDLTable, "name" | "indexTablespace">, index: DDLIndex) {
  return [`create index ${index.name} on ${table.name} (${index.columns.join(", ")})${table.indexTablespace};`];
}

export function sequenceLines(name: string) {
  return [`create sequence ${name}`, "start with 1", "increment by 1", "nocache", "nocycle;"];
}

export const commentLines = (table: DDLTable) => [
  ...(table.comment ? [`comment on table ${table.name} is '${sqlComment(table.comment)}';`] : []),
  ...table.columns.filter((column) => column.comment).map((column) => `comment on column ${table.name}.${column.name} is '${sqlComment(column.comment)}';`),
];

export function generateDDL(schema: Schema) {
  const out = [
    "-- ============================================================",
    "-- Oracle DDL generated by Oracle Schema Designer",
    "-- Target: Oracle 12.2+",
    "-- ============================================================\n",
  ];
  const tables = ddlModel(schema);
  tables.forEach((table) => {
    out.push(`--drop table ${table.name};`, "--", ...createTableLines(table), "--");
    table.constraints.forEach((constraint) => out.push(...addConstraintLines(table, constraint), "--"));
    table.indexes.forEach((index) => out.push(...indexLines(table, index), "--"));
    out.push(...commentLines(table), "");
  });
  const sequences = tables.flatMap((table) => (table.sequence ? [table.sequence] : []));
  sequences.forEach((name, index) =>
    out.push(...sequenceLines(name), ...(index < sequences.length - 1 ? ["---------------------------------------------------------"] : [])),
  );
  return out.join("\n");
}

function param(column: Column, tableName: string, mode = "IN") {
  return `p_${normalizeIdentifier(column.name).toLowerCase()} ${mode} ${tableName}.${normalizeIdentifier(column.name)}%TYPE`;
}

function toSingularToken(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith("ies") && lower.length > 4) {
    return word.slice(0, -3) + (word[word.length - 1] === "S" ? "Y" : "y");
  }
  /*
   * Only a sibilant stem takes a real `-es` plural (boxes, matches, statuses).
   * Everywhere else the `e` belongs to the singular and just the `s` comes off
   * -- TYPES is TYPE, not TYP. Matching the stem is what makes that hold; the
   * older blacklist of `-tes`/`-ses`/`-ces` endings did not.
   */
  if (/(?:s|x|z|ch|sh)es$/.test(lower)) return word.slice(0, -2);
  if (lower.endsWith("s") && !/(?:ss|us|is)$/.test(lower)) {
    return word.slice(0, -1);
  }
  return word;
}

function getProcedureSuffix(tableName: string): string {
  let clean = tableName;
  if (/^Osm_R_Action_/i.test(clean) && !/^(Osm_R_Actions|Osm_R_Action_Fields|Osm_R_Action_Validates)$/i.test(clean)) {
    clean = clean.replace(/^Osm_R_Action_/i, "");
  } else if (/^Osm_R_/i.test(clean)) {
    clean = clean.replace(/^Osm_R_/i, "");
  } else if (/^[A-Za-z0-9]+_R_/i.test(clean)) {
    clean = clean.replace(/^[A-Za-z0-9]+_R_/i, "");
  } else if (/^[A-Za-z0-9]+_/i.test(clean)) {
    clean = clean.replace(/^[A-Za-z0-9]+_/i, "");
  }

  const parts = clean.split("_").filter(Boolean);
  const formatted = parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    let token = part.charAt(0).toUpperCase() + part.slice(1);
    if (isLast) {
      token = toSingularToken(token);
    }
    return token;
  });

  return formatted.join("_");
}

function getPackageName(schema: Schema): string {
  for (const table of schema.tables) {
    const match = table.name.match(/^([A-Za-z0-9]+)_/);
    if (match && match[1]) {
      const prefix = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      if (prefix.toLowerCase() !== "r") {
        return `${prefix}_Dml`;
      }
    }
  }
  return "Osm_Dml";
}

export function generateDML(schema: Schema) {
  const pkgName = getPackageName(schema);
  const out = [`create or replace package body ${pkgName} is`];
  const sep = "  -----------------------------------------------------------------------------------------------------------";

  schema.tables.forEach((table) => {
    const tableName = table.name.trim();
    const procSuffix = getProcedureSuffix(tableName);
    const pkCols = primaryKeyColumns(table);
    const hasSingleNumberPk = pkCols.length === 1 && pkCols[0].type === "NUMBER";

    const modifyOnCol = table.columns.find((c) => c.name.toLowerCase().replace(/_/g, "") === "modifyon");
    const modifyByCol = table.columns.find((c) => c.name.toLowerCase().replace(/_/g, "") === "modifyby");
    const stateCol = table.columns.find((c) => c.name.toLowerCase() === "state");
    const isLogTable = /(_log|_logs|_audit|_audits)$/i.test(tableName) || /log|audit/i.test(tableName);

    const sequenceName = `${tableName}_Seq`;

    // 1. Ins Procedure
    out.push(sep);
    out.push(`  Procedure Ins_${procSuffix}(Io_Row in out nocopy ${tableName}%rowtype) is`);
    out.push("  begin");

    const insAssignments: { lhs: string; rhs: string }[] = [];
    if (hasSingleNumberPk) {
      insAssignments.push({
        lhs: `Io_Row.${pkCols[0].name}`,
        rhs: `${sequenceName}.Nextval;`,
      });
    }
    if (modifyOnCol) {
      insAssignments.push({
        lhs: `Io_Row.${modifyOnCol.name}`,
        rhs: "sysdate;",
      });
    }
    if (modifyByCol) {
      insAssignments.push({
        lhs: `Io_Row.${modifyByCol.name}`,
        rhs: "Core.User_Env.Get_User_Id;",
      });
    }

    if (insAssignments.length > 0) {
      const maxLhsLen = Math.max(...insAssignments.map((a) => a.lhs.length));
      insAssignments.forEach((a) => {
        out.push(`    ${a.lhs.padEnd(maxLhsLen)} := ${a.rhs}`);
      });
      out.push("    --");
    }
    out.push(`    insert into ${tableName} values Io_Row;`);
    out.push("  end;");

    if (isLogTable) return;

    // 2. Upd Procedure
    out.push(sep);
    out.push(`  Procedure Upd_${procSuffix}(Io_Row in out nocopy ${tableName}%rowtype) is`);
    out.push("  begin");

    const updPreAssignments: { lhs: string; rhs: string }[] = [];
    if (modifyOnCol) {
      updPreAssignments.push({
        lhs: `Io_Row.${modifyOnCol.name}`,
        rhs: "sysdate;",
      });
    }
    if (modifyByCol) {
      updPreAssignments.push({
        lhs: `Io_Row.${modifyByCol.name}`,
        rhs: "Core.User_Env.Get_User_Id;",
      });
    }

    if (updPreAssignments.length > 0) {
      const maxLhsLen = Math.max(...updPreAssignments.map((a) => a.lhs.length));
      updPreAssignments.forEach((a) => {
        out.push(`    ${a.lhs.padEnd(maxLhsLen)} := ${a.rhs}`);
      });
      out.push("    --");
    }

    const updCols = table.columns.filter((c) => !c.pk);
    const setCols = updCols.length > 0 ? updCols : table.columns;
    const maxSetColLen = Math.max(...setCols.map((c) => c.name.length));

    out.push(`    update ${tableName}`);
    setCols.forEach((c, idx) => {
      const prefix = idx === 0 ? "       set " : "           ";
      const comma = idx < setCols.length - 1 ? "," : "";
      out.push(`    ${prefix}${c.name.padEnd(maxSetColLen)} = Io_Row.${c.name}${comma}`);
    });

    const whereCols = pkCols.length > 0 ? pkCols : table.columns;
    whereCols.forEach((c, idx) => {
      const prefix = idx === 0 ? "     where " : "       and ";
      const semicolon = idx === whereCols.length - 1 ? ";" : "";
      out.push(`    ${prefix}${c.name} = Io_Row.${c.name}${semicolon}`);
    });
    out.push("  end;");

    // 3. Del Procedure
    out.push(sep);
    const delParams = whereCols
      .map((c) => {
        const typeLower = c.type.toLowerCase();
        const paramType = typeLower === "number" ? "number" : typeLower === "date" ? "date" : "varchar2";
        return `i_${c.name} ${paramType}`;
      })
      .join(", ");

    out.push(`  Procedure Del_${procSuffix}(${delParams}) is`);
    out.push("  begin");

    if (stateCol) {
      const softSetCols: { name: string; val: string }[] = [{ name: stateCol.name, val: "'P'" }];
      if (modifyOnCol) softSetCols.push({ name: modifyOnCol.name, val: "sysdate" });
      if (modifyByCol) softSetCols.push({ name: modifyByCol.name, val: "Core.User_Env.Get_User_Id" });

      const maxSoftColLen = Math.max(...softSetCols.map((s) => s.name.length));

      out.push(`    update ${tableName}`);
      softSetCols.forEach((s, idx) => {
        const prefix = idx === 0 ? "       set " : "           ";
        const comma = idx < softSetCols.length - 1 ? "," : "";
        out.push(`    ${prefix}${s.name.padEnd(maxSoftColLen)} = ${s.val}${comma}`);
      });

      whereCols.forEach((c, idx) => {
        const prefix = idx === 0 ? "     where " : "       and ";
        const semicolon = idx === whereCols.length - 1 ? ";" : "";
        out.push(`    ${prefix}${c.name} = i_${c.name}${semicolon}`);
      });
    } else {
      const whereCond = whereCols.map((c) => `${c.name} = i_${c.name}`).join(" and ");
      out.push(`    delete from ${tableName} where ${whereCond};`);
    }

    out.push("  end;");
  });

  out.push(sep);
  out.push(`end ${pkgName};`);

  return out.join("\n");
}

export const generatePLSQL = generateDML;

export function exportSchema(schema: Schema) {
  return `${generateDDL(schema)}\n\n${generateDML(schema)}`;
}

export { generateMermaidER } from "./mermaid";

