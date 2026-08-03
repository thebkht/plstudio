import { makeColumn, makeTable, normalizeIdentifier, SCHEMA_FORMAT_VERSION, type Schema, type Table } from "./schema";

export type ParseResult = { schema: Schema | null; warnings: string[]; errors: string[] };

function splitTopLevel(value: string) {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = false;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "'" && value[i - 1] !== "\\") quote = !quote;
    if (quote) continue;
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function parseColumn(line: string) {
  const match = line.match(/^([A-Z0-9_$#]+)\s+(TIMESTAMP\s+WITH\s+LOCAL\s+TIME\s+ZONE|TIMESTAMP\s+WITH\s+TIME\s+ZONE|INTERVAL\s+YEAR\s+TO\s+MONTH|INTERVAL\s+DAY\s+TO\s+SECOND|BINARY_FLOAT|BINARY_DOUBLE|VARCHAR2|NVARCHAR2|NCHAR|CHAR|NUMBER|FLOAT|TIMESTAMP|DATE|CLOB|NCLOB|BLOB|BFILE|RAW)(?:\(([^)]+)\))?(.*)$/i);
  if (!match) return null;
  const [, name, type, size, rest] = match;
  const check = rest.match(/CHECK\s*\((.*)\)\s*$/i)?.[1] ?? "";
  const defaultValue = rest.match(/DEFAULT\s+(.+?)(?=\s+NOT\s+NULL|\s+UNIQUE|\s+CHECK|$)/i)?.[1]?.trim() ?? "";
  return makeColumn({ name, type: type.toUpperCase() as never, size: size ?? "", notNull: /NOT\s+NULL/i.test(rest), unique: /\bUNIQUE\b/i.test(rest), check, defaultValue });
}

function unescapeComment(value: string) {
  return value.replaceAll("''", "'");
}

function findTable(tables: Table[], name: string) {
  return tables.find((table) => normalizeIdentifier(table.name) === normalizeIdentifier(name));
}

function findColumn(table: Table, name: string) {
  return table.columns.find((column) => normalizeIdentifier(column.name) === normalizeIdentifier(name));
}

export function parseCreateTable(sql: string): ParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const tables: Table[] = [];
  const tableRegex = /CREATE\s+TABLE\s+([A-Z0-9_$#]+)\s*\(([\s\S]*?)\)\s*(?:TABLESPACE\s+[A-Z0-9_$#]+\s*)?;/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(sql))) {
    const [, tableName, body] = match;
    const table = makeTable(tableName, 80 + tables.length * 330, 90 + (tables.length % 3) * 170, tables.length);
    table.columns = [];
    const pendingPrimary: string[] = [];
    splitTopLevel(body).forEach((line) => {
      const primary = line.match(/(?:CONSTRAINT\s+\w+\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (primary) { pendingPrimary.push(...primary[1].split(",").map((item) => item.trim())); return; }
      if (/^(CONSTRAINT|UNIQUE|FOREIGN\s+KEY)/i.test(line)) { warnings.push(`${tableName}: skipped unsupported table constraint: ${line}`); return; }
      const column = parseColumn(line);
      if (column) table.columns.push(column);
      else warnings.push(`${tableName}: could not parse line: ${line}`);
    });
    pendingPrimary.forEach((name) => { const column = table.columns.find((candidate) => candidate.name.toUpperCase() === name.toUpperCase()); if (column) { column.pk = true; column.notNull = true; } else errors.push(`${tableName}: primary key column ${name} not found.`); });
    if (!table.columns.length) errors.push(`${tableName}: no columns were parsed.`);
    table.keyStrategy = table.columns.filter((column) => column.pk).length === 1 ? "sequence-trigger" : "none";
    tables.push(table);
  }

  sql.replace(/ALTER\s+TABLE\s+([A-Z0-9_$#]+)\s+ADD\s+CONSTRAINT\s+[A-Z0-9_$#]+\s+PRIMARY\s+KEY\s*\(([^)]+)\)/gi, (_statement, tableName: string, columns: string) => {
    const table = findTable(tables, tableName);
    if (!table) return _statement;
    columns.split(",").map((name) => name.trim()).forEach((name) => {
      const column = findColumn(table, name);
      if (column) { column.pk = true; column.notNull = true; }
      else errors.push(`${tableName}: primary key column ${name} not found.`);
    });
    return _statement;
  });

  sql.replace(/ALTER\s+TABLE\s+([A-Z0-9_$#]+)\s+ADD\s+CONSTRAINT\s+[A-Z0-9_$#]+\s+UNIQUE\s*\(([^)]+)\)/gi, (_statement, tableName: string, columns: string) => {
    const table = findTable(tables, tableName);
    if (!table) return _statement;
    const names = columns.split(",").map((name) => name.trim());
    if (names.length > 1) warnings.push(`${tableName}: skipped composite unique constraint: ${columns}`);
    else {
      const column = findColumn(table, names[0]);
      if (column) column.unique = true;
      else errors.push(`${tableName}: unique column ${names[0]} not found.`);
    }
    return _statement;
  });

  sql.replace(/ALTER\s+TABLE\s+([A-Z0-9_$#]+)\s+ADD\s+CONSTRAINT\s+[A-Z0-9_$#]+\s+CHECK\s*\(([^;]*?)\)\s*;/gi, (_statement, tableName: string, expression: string) => {
    const table = findTable(tables, tableName);
    if (!table) return _statement;
    const columnName = expression.match(/^\s*([A-Z0-9_$#]+)\s+IN\b/i)?.[1];
    const column = columnName ? findColumn(table, columnName) : null;
    if (column) column.check = expression.trim();
    else warnings.push(`${tableName}: skipped table-level check constraint: ${expression.trim()}`);
    return _statement;
  });

  sql.replace(/ALTER\s+TABLE\s+([A-Z0-9_$#]+)\s+ADD\s+CONSTRAINT\s+[A-Z0-9_$#]+\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+([A-Z0-9_$#]+)\s*\(([^)]+)\)\s*;/gi, (_statement, tableName: string, columnName: string, targetName: string, targetColumnName: string) => {
    const table = findTable(tables, tableName);
    const target = findTable(tables, targetName);
    const column = table && findColumn(table, columnName.trim());
    const targetColumn = target && findColumn(target, targetColumnName.trim());
    if (column && targetColumn && target) column.fk = { tableId: target.id, columnId: targetColumn.id };
    else warnings.push(`${tableName}: skipped foreign key to ${targetName}.${targetColumnName}.`);
    return _statement;
  });

  sql.replace(/COMMENT\s+ON\s+TABLE\s+([A-Z0-9_$#]+)\s+IS\s+'((?:''|[^'])*)'\s*;/gi, (_statement, tableName: string, comment: string) => {
    const table = findTable(tables, tableName);
    if (table) table.comment = unescapeComment(comment);
    return _statement;
  });

  sql.replace(/COMMENT\s+ON\s+COLUMN\s+([A-Z0-9_$#]+)\.([A-Z0-9_$#]+)\s+IS\s+'((?:''|[^'])*)'\s*;/gi, (_statement, tableName: string, columnName: string, comment: string) => {
    const table = findTable(tables, tableName);
    const column = table && findColumn(table, columnName);
    if (column) column.comment = unescapeComment(comment);
    return _statement;
  });

  tables.forEach((table) => {
    table.keyStrategy = table.columns.filter((column) => column.pk).length === 1 ? "sequence-trigger" : "none";
  });

  if (!tables.length) errors.push("No supported CREATE TABLE statements found.");
  if (errors.length) return { schema: null, warnings, errors };
  return { schema: { id: `schema_import_${Date.now()}`, name: "Imported Oracle Schema", revision: 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION, tables }, warnings, errors };
}
