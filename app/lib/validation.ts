import { normalizeIdentifier, ORACLE_VERSION, primaryKeyColumns, type Table, type Schema } from "./schema";

export type ValidationIssue = { severity: "error" | "warning"; message: string; tableId?: string; columnId?: string };

const RESERVED = new Set(["SELECT", "FROM", "WHERE", "TABLE", "USER", "ORDER", "GROUP", "DATE", "NUMBER", "LEVEL", "START", "CONNECT"]);
const IDENTIFIER_LIMIT = 128;

function identifierIssues(value: string, label: string): ValidationIssue[] {
  const normalized = normalizeIdentifier(value);
  const issues: ValidationIssue[] = [];
  if (!value.trim()) issues.push({ severity: "error", message: `${label} cannot be empty.` });
  if (normalized.length > IDENTIFIER_LIMIT) issues.push({ severity: "error", message: `${label} exceeds Oracle ${ORACLE_VERSION} identifier limit of ${IDENTIFIER_LIMIT} bytes.` });
  if (RESERVED.has(normalized)) issues.push({ severity: "error", message: `${label} uses reserved Oracle word ${normalized}.` });
  return issues;
}

function hasBalancedQuotes(expression: string) {
  let quoted = false;
  for (let i = 0; i < expression.length; i += 1) {
    if (expression[i] !== "'") continue;
    if (expression[i + 1] === "'") { i += 1; continue; }
    quoted = !quoted;
  }
  return !quoted;
}

export function validateCheckExpression(expression: string) {
  const value = expression.trim();
  if (!value) return null;
  if (!hasBalancedQuotes(value) || /[;]/.test(value) || /\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)\b/i.test(value)) {
    return "Check expression is not a supported single Oracle expression.";
  }
  return null;
}

function duplicateIssues(items: Array<{ value: string; label: string; tableId?: string; columnId?: string }>) {
  const seen = new Map<string, string>();
  const issues: ValidationIssue[] = [];
  items.forEach((item) => {
    const normalized = normalizeIdentifier(item.value);
    const prior = seen.get(normalized);
    if (prior) issues.push({ severity: "error", message: `${item.label} collides with ${prior} after Oracle normalization.`, tableId: item.tableId, columnId: item.columnId });
    else seen.set(normalized, item.label);
  });
  return issues;
}

export function validateSchema(schema: Schema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  issues.push(...duplicateIssues(schema.tables.map((table) => ({ value: table.name, label: `table ${table.name}`, tableId: table.id }))));
  schema.tables.forEach((table) => {
    issues.push(...identifierIssues(table.name, `Table ${table.name}`));
    issues.push(...duplicateIssues(table.columns.map((column) => ({ value: column.name, label: `column ${table.name}.${column.name}`, tableId: table.id, columnId: column.id }))));
    const pk = primaryKeyColumns(table);
    if (table.keyStrategy !== "none" && !(pk.length === 1 && pk[0].type === "NUMBER")) {
      issues.push({ severity: "warning", message: `${table.name}: generated key strategy requires exactly one numeric PK; use manual key generation.`, tableId: table.id });
    }
    table.columns.forEach((column) => {
      issues.push(...identifierIssues(column.name, `Column ${table.name}.${column.name}`).map((issue) => ({ ...issue, tableId: table.id, columnId: column.id })));
      const checkIssue = validateCheckExpression(column.check);
      if (checkIssue) issues.push({ severity: "error", message: `${table.name}.${column.name}: ${checkIssue}`, tableId: table.id, columnId: column.id });
      if (column.fk) {
        const target = schema.tables.find((candidate) => candidate.id === column.fk?.tableId);
        const targetColumn = target?.columns.find((candidate) => candidate.id === column.fk?.columnId);
        if (!target || !targetColumn) issues.push({ severity: "error", message: `${table.name}.${column.name}: foreign key target is missing.`, tableId: table.id, columnId: column.id });
        else if (primaryKeyColumns(target).length > 1) issues.push({ severity: "error", message: `${table.name}.${column.name}: composite-PK targets require FK groups, which are not supported in v1.`, tableId: table.id, columnId: column.id });
        else if (targetColumn.type !== column.type) issues.push({ severity: "error", message: `${table.name}.${column.name}: FK type must match ${target.name}.${targetColumn.name}.`, tableId: table.id, columnId: column.id });
      }
    });
  });
  return issues;
}
