import { makeColumn, makeTable, SCHEMA_FORMAT_VERSION, type Schema, type Table } from "./schema";

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

export function parseCreateTable(sql: string): ParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const tables: Table[] = [];
  const tableRegex = /CREATE\s+TABLE\s+([A-Z0-9_$#]+)\s*\(([^;]*?)\)\s*;/gis;
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
  if (!tables.length) errors.push("No supported CREATE TABLE statements found.");
  if (errors.length) return { schema: null, warnings, errors };
  return { schema: { id: `schema_import_${Date.now()}`, name: "Imported Oracle Schema", revision: 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION, tables }, warnings, errors };
}
