import { keyCovers, normalizeIdentifier, tableKeys, type Relationship, type SavedQuery, type Schema, type Table } from "./schema";

/**
 * What a set of queries says about a diagram: which tables and foreign keys
 * they lean on, which joins run with no foreign key behind them, and which
 * column lists they filter on that no index serves.
 *
 * Deliberately a tokenizer and not a SQL parser. It follows table references
 * and their aliases, and reads the comparisons in `WHERE`/`ON` clauses; that is
 * all a heatmap needs, and it degrades to "fewer facts" on SQL it does not
 * follow rather than to an error.
 */

/** One statement out of a pasted script or log, with its weight. */
export type QueryChunk = { sql: string; executions: number };

const WEIGHT_COMMENT = /^\s*--\s*exec(?:ution)?s?\s*[:=]\s*(\d+)\s*$/im;
const WEIGHT_PREFIX = /^\s*(\d+)\t/;

/**
 * Split on `;` (or a SQL*Plus `/` line) outside quotes and comments. A weight
 * comes from a `-- executions: N` line ahead of the statement, or from a
 * leading `N<TAB>`, which is what a V$SQL or AWR grid pastes as.
 */
export function splitQueries(text: string): QueryChunk[] {
  const chunks: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "'" || char === '"') {
      const close = text.indexOf(char, i + 1);
      i = close < 0 ? text.length : close;
    } else if (char === "-" && text[i + 1] === "-") {
      const end = text.indexOf("\n", i);
      i = end < 0 ? text.length : end;
    } else if (char === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
    } else if (char === ";" || (char === "/" && /^[ \t]*$/.test(text.slice(text.lastIndexOf("\n", i - 1) + 1, i)) && /^[ \t]*(?:\n|$)/.test(text.slice(i + 1)))) {
      chunks.push(text.slice(start, i));
      start = i + 1;
    }
  }
  chunks.push(text.slice(start));
  return chunks.flatMap((chunk) => {
    const comment = chunk.match(WEIGHT_COMMENT);
    const body = chunk.replace(WEIGHT_COMMENT, "").trim();
    const prefix = body.match(WEIGHT_PREFIX);
    const sql = (prefix ? body.slice(prefix[0].length) : body).trim();
    // A chunk of nothing but comments is the trailer after the last `;`.
    if (!sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "").trim()) return [];
    return [{ sql, executions: Math.max(1, Number(comment?.[1] ?? prefix?.[1] ?? 1)) }];
  });
}

type Token = { kind: "word" | "quoted" | "literal" | "symbol"; text: string };

/** Comments dropped; strings, numbers and bind variables folded into `literal`. */
function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'?|"([^"]*)"?|:[A-Za-z0-9_$#]+|\?|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_$#]*|<=|>=|<>|!=|\S/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql))) {
    const text = match[0];
    if (text.startsWith("--") || text.startsWith("/*")) continue;
    if (text.startsWith('"')) tokens.push({ kind: "quoted", text: match[1] ?? "" });
    else if (text.startsWith("'") || text.startsWith(":") || text === "?" || /^\d/.test(text)) tokens.push({ kind: "literal", text });
    else if (/^[A-Za-z_]/.test(text)) tokens.push({ kind: "word", text: text.toUpperCase() });
    else tokens.push({ kind: "symbol", text });
  }
  return tokens;
}

/** Words that end a table reference instead of being its alias. */
const CLAUSE_WORDS = new Set([
  "WHERE", "JOIN", "INNER", "LEFT", "RIGHT", "FULL", "OUTER", "CROSS", "NATURAL", "ON", "USING", "GROUP", "ORDER", "HAVING",
  "UNION", "MINUS", "INTERSECT", "EXCEPT", "SET", "VALUES", "CONNECT", "START", "FETCH", "OFFSET", "FOR", "WITH", "SELECT",
  "PARTITION", "LATERAL", "RETURNING", "LIMIT", "WINDOW", "MODEL", "PIVOT", "UNPIVOT", "SAMPLE", "AS", "BY", "AND", "OR",
]);
const PREDICATE_CLAUSES = new Set(["WHERE", "ON", "HAVING", "AND", "OR", "CONNECT", "START", "WHEN"]);
const CLAUSE_STARTS = new Set(["SELECT", "FROM", "WHERE", "ON", "GROUP", "ORDER", "HAVING", "SET", "VALUES", "CONNECT", "START", "RETURNING", "UNION", "MINUS", "INTERSECT", "USING"]);
const NOT_TABLES = new Set(["DUAL"]);

export type ColumnRef = { tableId: string; columnId: string };
export type Predicate = ColumnRef & { kind: "eq" | "range" };
export type Join = { from: ColumnRef; to: ColumnRef };

export type ResolvedQuery = {
  tableIds: string[];
  /** Every column the statement names, as `tableId:columnId`. */
  columns: string[];
  predicates: Predicate[];
  joins: Join[];
  /** Table names the diagram has no table for. */
  unresolved: string[];
};

export const columnKey = (ref: ColumnRef) => `${ref.tableId}:${ref.columnId}`;

/** Table lookup by Oracle-normalized name, built once per analysis. */
export const tableIndex = (schema: Schema) => new Map(schema.tables.map((table) => [normalizeIdentifier(table.name), table] as const));

export function resolveQuery(sql: string, tables: Map<string, Table>): ResolvedQuery {
  const tokens = tokenize(sql);
  const name = (token: Token | undefined) => (token && (token.kind === "word" || token.kind === "quoted") ? normalizeIdentifier(token.text) : null);
  const is = (at: number, text: string) => tokens[at]?.kind === "word" && tokens[at].text === text;

  // Common table expressions are named like tables but are not the diagram's.
  const ctes = new Set<string>();
  tokens.forEach((token, at) => {
    if (token.kind !== "symbol" && is(at + 1, "AS") && tokens[at + 2]?.text === "(" && (is(at - 1, "WITH") || tokens[at - 1]?.text === ",")) ctes.add(name(token)!);
  });

  /* Table references and their aliases. Aliases are per statement, not per
     query block: a diagram's own aliases rarely collide, and when they do the
     cost is a miscounted column, not a wrong answer. */
  const aliases = new Map<string, Table>();
  const used = new Set<Table>();
  const unresolved = new Set<string>();
  /** Tokens spent on a table name or its alias, which must not read as columns. */
  const referenceTokens = new Set<number>();
  const readReference = (at: number) => {
    if (tokens[at]?.text === "(") return at;
    const parts: string[] = [];
    let cursor = at;
    while (name(tokens[cursor])) {
      parts.push(name(tokens[cursor])!);
      if (tokens[cursor + 1]?.text !== ".") break;
      cursor += 2;
    }
    if (!parts.length) return at;
    const tableName = parts[parts.length - 1];
    const table = tables.get(tableName);
    if (table) { used.add(table); aliases.set(tableName, table); }
    else if (!ctes.has(tableName) && !NOT_TABLES.has(tableName) && !CLAUSE_WORDS.has(tableName)) unresolved.add(tableName);
    cursor += 1;
    if (is(cursor, "AS")) cursor += 1;
    const alias = tokens[cursor];
    if (alias && (alias.kind === "quoted" || (alias.kind === "word" && !CLAUSE_WORDS.has(alias.text)))) {
      if (table) aliases.set(name(alias)!, table);
      cursor += 1;
    }
    for (let spent = at; spent < cursor; spent += 1) referenceTokens.add(spent);
    return cursor;
  };
  for (let at = 0; at < tokens.length; at += 1) {
    const token = tokens[at];
    if (token.kind !== "word") continue;
    if (token.text === "JOIN" || token.text === "UPDATE" || token.text === "INTO") readReference(at + 1);
    else if (token.text === "FROM") {
      // `from a, b x, c`: a comma list at the FROM's own depth.
      let cursor = readReference(at + 1);
      while (tokens[cursor]?.text === ",") cursor = readReference(cursor + 1);
    }
  }

  /* Column references: `alias.column`, `owner.table.column`, or a bare name
     that exactly one of the statement's tables has. */
  const columnOf = (table: Table | undefined, column: string | null) =>
    table && column ? table.columns.find((candidate) => normalizeIdentifier(candidate.name) === column) : undefined;
  const refAt = (at: number): { ref: ColumnRef; end: number } | null => {
    const first = name(tokens[at]);
    if (!first || referenceTokens.has(at) || (tokens[at].kind === "word" && CLAUSE_WORDS.has(tokens[at].text)) || tokens[at - 1]?.text === ".") return null;
    if (tokens[at + 1]?.text === "(") return null;
    const parts = [first];
    let end = at;
    while (tokens[end + 1]?.text === "." && name(tokens[end + 2])) { parts.push(name(tokens[end + 2])!); end += 2; }
    if (parts.length >= 2) {
      const table = aliases.get(parts[parts.length - 2]);
      const column = columnOf(table, parts[parts.length - 1]);
      return table && column ? { ref: { tableId: table.id, columnId: column.id }, end } : null;
    }
    const owners = [...used].flatMap((table) => { const column = columnOf(table, first); return column ? [{ tableId: table.id, columnId: column.id }] : []; });
    return owners.length === 1 ? { ref: owners[0], end } : null;
  };

  const columns = new Set<string>();
  const predicates: Predicate[] = [];
  const joins: Join[] = [];
  /** The clause each paren depth is in, so a subquery's WHERE does not leak out of it. */
  const clauses: string[] = [""];
  /** The far side of a comparison: a column, or any value -- `sysdate - 7` serves an index as well as `'A'` does. */
  const operand = (at: number) => refAt(at)?.ref ?? "value";
  for (let at = 0; at < tokens.length; at += 1) {
    const token = tokens[at];
    if (token.text === "(") { clauses.push(clauses[clauses.length - 1]); continue; }
    if (token.text === ")") { if (clauses.length > 1) clauses.pop(); continue; }
    if (token.kind === "word" && CLAUSE_STARTS.has(token.text)) { clauses[clauses.length - 1] = token.text; continue; }
    const found = refAt(at);
    if (!found) continue;
    columns.add(columnKey(found.ref));
    const clause = clauses[clauses.length - 1];
    const next = found.end + 1;
    if (!PREDICATE_CLAUSES.has(clause)) { at = found.end; continue; }
    const op = tokens[next]?.text ?? "";
    const other = ["=", "<", ">", "<=", ">="].includes(op) ? operand(next + 1) : null;
    if (op === "=" && other && other !== "value") {
      const right = refAt(next + 1)!;
      columns.add(columnKey(right.ref));
      if (right.ref.tableId !== found.ref.tableId) joins.push({ from: found.ref, to: right.ref });
      at = right.end;
      continue;
    }
    const previous = tokens[at - 1]?.text ?? "";
    const literalBefore = tokens[at - 2]?.kind === "literal" && ["=", "<", ">", "<=", ">="].includes(previous);
    if (other === "value" || literalBefore) predicates.push({ ...found.ref, kind: op === "=" || (literalBefore && previous === "=") ? "eq" : "range" });
    else if (op === "IN") predicates.push({ ...found.ref, kind: "eq" });
    else if (op === "BETWEEN") predicates.push({ ...found.ref, kind: "range" });
    // A leading wildcard cannot use an index; a prefix match can.
    else if (op === "LIKE" && tokens[next + 1]?.kind === "literal" && !tokens[next + 1].text.startsWith("'%")) predicates.push({ ...found.ref, kind: "range" });
    at = found.end;
  }

  return { tableIds: [...used].map((table) => table.id), columns: [...columns], predicates, joins, unresolved: [...unresolved] };
}

export type IndexSuggestion = {
  tableId: string;
  columnIds: string[];
  weight: number;
  reason: "fk" | "filter" | "composite";
};

export type ImplicitJoin = Join & { weight: number };

export type QueryAnalysis = {
  perQuery: Map<string, ResolvedQuery>;
  tableHeat: Map<string, number>;
  edgeHeat: Map<string, number>;
  /** 1–4 by order of magnitude of executions, absent for untouched. */
  tableLevels: Map<string, number>;
  edgeLevels: Map<string, number>;
  implicitJoins: ImplicitJoin[];
  suggestions: IndexSuggestion[];
};

const bump = <K>(map: Map<K, number>, key: K, by: number) => map.set(key, (map.get(key) ?? 0) + by);

/**
 * Absolute, one level per order of magnitude: 1–9 executions, 10–99, 100–999,
 * 1000 and up. Relative to the hottest, a lone query run once painted its
 * table as hot as a production workload does -- the level has to mean traffic.
 */
export const heatLevel = (executions: number) => Math.min(4, Math.floor(Math.log10(Math.max(1, executions))) + 1);

const levels = (heat: Map<string, number>) =>
  new Map([...heat].filter(([, value]) => value > 0).map(([key, value]) => [key, heatLevel(value)] as const));

/** Relationship id by both orderings of each of its column pairs. */
function relationshipLookup(relationships: Relationship[]) {
  const lookup = new Map<string, string>();
  relationships.forEach((relationship) => relationship.fields.forEach((pair) => {
    const start = `${relationship.startTableId}:${pair.startFieldId}`;
    const end = `${relationship.endTableId}:${pair.endFieldId}`;
    lookup.set(`${start}|${end}`, relationship.id).set(`${end}|${start}`, relationship.id);
  }));
  return lookup;
}

const MAX_COMPOSITE = 3;
const SUGGESTIONS_PER_TABLE = 3;

export function analyzeQueries(schema: Schema, queries: SavedQuery[] = schema.queries ?? []): QueryAnalysis {
  const tables = tableIndex(schema);
  const tablesById = new Map(schema.tables.map((table) => [table.id, table]));
  const relationships = relationshipLookup(schema.relationships ?? []);
  const perQuery = new Map<string, ResolvedQuery>();
  const tableHeat = new Map<string, number>();
  const edgeHeat = new Map<string, number>();
  const implicit = new Map<string, ImplicitJoin>();
  /** Candidate column list -> weight, keyed `tableId|col,col`. */
  const candidates = new Map<string, IndexSuggestion>();
  const propose = (tableId: string, columnIds: string[], weight: number, reason: IndexSuggestion["reason"]) => {
    const key = `${tableId}|${columnIds.join(",")}`;
    const current = candidates.get(key);
    candidates.set(key, { tableId, columnIds, weight: (current?.weight ?? 0) + weight, reason: current?.reason === "fk" ? "fk" : reason });
  };

  queries.forEach((query) => {
    const resolved = resolveQuery(query.sql, tables);
    perQuery.set(query.id, resolved);
    const weight = query.executions ?? 1;
    resolved.tableIds.forEach((id) => bump(tableHeat, id, weight));
    const seenEdges = new Set<string>();
    resolved.joins.forEach((join) => {
      const edge = relationships.get(`${columnKey(join.from)}|${columnKey(join.to)}`);
      if (edge) {
        if (!seenEdges.has(edge)) bump(edgeHeat, edge, weight);
        seenEdges.add(edge);
      } else {
        const [a, b] = [join.from, join.to].sort((x, y) => columnKey(x).localeCompare(columnKey(y)));
        const key = `${columnKey(a)}|${columnKey(b)}`;
        implicit.set(key, { from: a, to: b, weight: (implicit.get(key)?.weight ?? 0) + weight });
      }
      // Each side of a join is looked up by its column; a foreign key is the side Oracle never indexes for you.
      [join.from, join.to].forEach((side) => {
        const column = tablesById.get(side.tableId)?.columns.find((candidate) => candidate.id === side.columnId);
        propose(side.tableId, [side.columnId], weight, column?.fk ? "fk" : "filter");
      });
    });
    // Per table: equality columns lead a composite, and one range column may close it.
    const byTable = new Map<string, { eq: string[]; range: string[] }>();
    resolved.predicates.forEach((predicate) => {
      const entry = byTable.get(predicate.tableId) ?? { eq: [], range: [] };
      const list = predicate.kind === "eq" ? entry.eq : entry.range;
      if (!list.includes(predicate.columnId)) list.push(predicate.columnId);
      byTable.set(predicate.tableId, entry);
    });
    byTable.forEach(({ eq, range }, tableId) => {
      const lead = eq.slice(0, MAX_COMPOSITE);
      const composite = lead.length < MAX_COMPOSITE && range.length ? [...lead, range[0]] : lead;
      if (composite.length > 1) propose(tableId, composite, weight, "composite");
      else if (composite.length === 1) propose(tableId, composite, weight, "filter");
      else if (range.length) propose(tableId, [range[0]], weight, "filter");
    });
  });

  const keysByTable = new Map(schema.tables.map((table) => [table.id, tableKeys(table).map((key) => key.columnIds)]));
  const open = [...candidates.values()].filter((candidate) => !(keysByTable.get(candidate.tableId) ?? []).some((key) => keyCovers(key, candidate.columnIds)));
  // A list another open candidate starts with is served by that one's index.
  const suggestions = open
    .filter((candidate) => !open.some((other) => other !== candidate && other.tableId === candidate.tableId && other.columnIds.length > candidate.columnIds.length && keyCovers(other.columnIds, candidate.columnIds) && other.weight >= candidate.weight))
    .sort((a, b) => b.weight - a.weight || a.columnIds.length - b.columnIds.length)
    .filter((candidate, _, all) => all.filter((other) => other.tableId === candidate.tableId).indexOf(candidate) < SUGGESTIONS_PER_TABLE);

  return {
    perQuery,
    tableHeat,
    edgeHeat,
    tableLevels: levels(tableHeat),
    edgeLevels: levels(edgeHeat),
    implicitJoins: [...implicit.values()].sort((a, b) => b.weight - a.weight),
    suggestions,
  };
}
