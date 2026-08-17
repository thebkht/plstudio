export const ORACLE_VERSION = "12.2+" as const;
export const SCHEMA_FORMAT_VERSION = 6 as const;

export const ORACLE_TYPES = [
  "VARCHAR2",
  "CHAR",
  "NCHAR",
  "NVARCHAR2",
  "NUMBER",
  "FLOAT",
  "BINARY_FLOAT",
  "BINARY_DOUBLE",
  "DATE",
  "TIMESTAMP",
  "TIMESTAMP WITH TIME ZONE",
  "TIMESTAMP WITH LOCAL TIME ZONE",
  "INTERVAL YEAR TO MONTH",
  "INTERVAL DAY TO SECOND",
  "CLOB",
  "NCLOB",
  "BLOB",
  "BFILE",
  "RAW",
] as const;

export type OracleType = (typeof ORACLE_TYPES)[number];
export type KeyStrategy = "none" | "sequence-trigger" | "identity";
export type MemoColor = "yellow" | "blue" | "green" | "pink";
export type GroupColor = "orange" | "blue" | "green" | "purple" | "pink";

export type ForeignKeyRef = { tableId: string; columnId: string };
export type Cardinality = "one_to_one" | "one_to_many" | "many_to_one";
export type RelationshipConstraint = "No action" | "Restrict" | "Cascade" | "Set null" | "Set default";
export type RelationshipFieldPair = { startFieldId: string; endFieldId: string };

export type Relationship = {
  id: string;
  startTableId: string;
  startFieldId: string;
  endTableId: string;
  endFieldId: string;
  fields: RelationshipFieldPair[];
  name: string;
  cardinality: Cardinality;
  manyLabel: string;
  updateConstraint: RelationshipConstraint;
  deleteConstraint: RelationshipConstraint;
};

export type Column = {
  id: string;
  name: string;
  type: OracleType;
  size: string;
  notNull: boolean;
  pk: boolean;
  unique: boolean;
  defaultValue: string;
  check: string;
  comment?: string;
  fk: ForeignKeyRef | null;
};

/**
 * Several columns linked into one `unique (a, b)` constraint. `Column.unique`
 * keeps meaning a *single-column* unique and is not set on the members: flagging
 * each one would emit one constraint per column instead of one across them.
 */
export type UniqueConstraint = {
  id: string;
  /** Blank means the generator mints `<table>_u<n>`. */
  name?: string;
  columnIds: string[];
};

export type Table = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: { a: string; b: string };
  keyStrategy: KeyStrategy;
  schemaId?: string;
  comment?: string;
  /** Manual width override. Absent means the width is derived from the name. */
  width?: number;
  columns: Column[];
  /** Multi-column unique constraints. Absent and empty mean the same thing. */
  uniques?: UniqueConstraint[];
};

export type Memo = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: MemoColor;
  schemaId?: string;
};

export type SchemaGroup = {
  id: string;
  name: string;
  /**
   * Module short code stamped onto the names of tables *created* in this group
   * (`MLL` -> `MLL_LABEL_CODES`). Advisory: it is applied at creation and by the
   * explicit apply action, never enforced afterwards, so a table keeps whatever
   * name the user gives it -- prefixed or not, inside the group or out of it.
   */
  keyword?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: GroupColor;
};

export type Schema = {
  id: string;
  name: string;
  revision: number;
  schemaFormatVersion: number;
  tables: Table[];
  groups?: SchemaGroup[];
  relationships?: Relationship[];
  memos?: Memo[];
  updatedAt?: string;
};

/**
 * Table accent colours. Rendered as a strip across the top of a card rather
 * than behind text, so these are chosen for separation, not text contrast.
 * `b` is retained for stored-schema compatibility.
 */
export const PALETTE = [
  { a: "#175e7a", b: "#124b61" },
  { a: "#7d9dff", b: "#5f7fe0" },
  { a: "#3cde7d", b: "#2fb265" },
  { a: "#6360f7", b: "#4f4cd6" },
  { a: "#f2994a", b: "#d97f34" },
  { a: "#e8617d", b: "#c94a64" },
  { a: "#00b8d9", b: "#0094ad" },
];

export const GROUP_PALETTE: Record<GroupColor, { background: string; border: string; header: string; text: string }> = {
  orange: { background: "#fff4df", border: "#e7a33e", header: "#ffebc5", text: "#8b5b16" },
  blue: { background: "#eaf7fb", border: "#4b9ab3", header: "#d7f0f6", text: "#28677a" },
  green: { background: "#eef8e8", border: "#78ad5b", header: "#e1f2d8", text: "#4b7b36" },
  purple: { background: "#f3effd", border: "#8f79c9", header: "#e9e1fa", text: "#66519d" },
  pink: { background: "#fff0f3", border: "#d98296", header: "#ffe1e8", text: "#9d5062" },
};
export const GROUP_COLORS = Object.keys(GROUP_PALETTE) as GroupColor[];

export const KEY_STRATEGIES: KeyStrategy[] = ["none", "sequence-trigger", "identity"];

/**
 * Ids must be unique across *clients*, not just across a session: two browsers
 * editing one schema would otherwise both mint `tbl_1` and their concurrent
 * inserts would silently merge into a single table. Hence a UUID, not a counter.
 * `randomUUID` is absent outside secure contexts, so fall back to random hex.
 */
export function nextId(prefix: string) {
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${unique}`;
}

export function makeColumn(partial: Partial<Column> = {}): Column {
  return {
    id: nextId("col"),
    name: "COLUMN_1",
    type: "VARCHAR2",
    size: "100",
    notNull: false,
    pk: false,
    unique: false,
    defaultValue: "",
    check: "",
    fk: null,
    ...partial,
  };
}

export function makeUniqueConstraint(columnIds: string[] = [], name = ""): UniqueConstraint {
  return { id: nextId("uk"), name: name || undefined, columnIds };
}

/** The columns of `table` that any of its unique constraints names. */
export function uniqueGroupColumnIds(table: Pick<Table, "uniques">) {
  return new Set((table.uniques ?? []).flatMap((constraint) => constraint.columnIds));
}

export function makeTable(name: string, x: number, y: number, colorIndex = 0): Table {
  return {
    id: nextId("tbl"),
    name,
    x,
    y,
    color: PALETTE[colorIndex % PALETTE.length],
    keyStrategy: "sequence-trigger",
    columns: [makeColumn({ name: "ID", type: "NUMBER", size: "", notNull: true, pk: true })],
  };
}

export function makeSchemaGroup(
  name = "New schema",
  x = 80,
  y = 80,
  colorIndex = 0,
): SchemaGroup {
  return {
    id: nextId("group"),
    name,
    x,
    y,
    width: 760,
    height: 520,
    color: GROUP_COLORS[colorIndex % GROUP_COLORS.length],
  };
}

export function makeMemo(
  text = "",
  x = 160,
  y = 120,
  color: MemoColor = "yellow",
): Memo {
  return {
    id: nextId("memo"),
    text,
    x,
    y,
    width: 280,
    height: 170,
    color,
  };
}

const MEMO_COLORS: MemoColor[] = ["yellow", "blue", "green", "pink"];

export function normalizeMemos(value: unknown): Memo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const memo = item as Partial<Memo>;
    if (typeof memo.id !== "string") return [];
    return [{
      id: memo.id,
      text: typeof memo.text === "string" ? memo.text : "",
      x: typeof memo.x === "number" && Number.isFinite(memo.x) ? memo.x : 160,
      y: typeof memo.y === "number" && Number.isFinite(memo.y) ? memo.y : 120,
      width: typeof memo.width === "number" && Number.isFinite(memo.width) ? Math.max(180, memo.width) : 280,
      height: typeof memo.height === "number" && Number.isFinite(memo.height) ? Math.max(100, memo.height) : 170,
      color: MEMO_COLORS.includes(memo.color as MemoColor) ? memo.color as MemoColor : "yellow",
      schemaId: typeof memo.schemaId === "string" && memo.schemaId ? memo.schemaId : undefined,
    }];
  });
}

export function makeDemoSchema(): Schema {
  const student = makeTable("STUDENT", 80, 90, 0);
  const enrollment = makeTable("ENROLLMENT", 460, 270, 1);
  enrollment.columns = [
    makeColumn({ name: "STUDENT_ID", type: "NUMBER", size: "", notNull: true, fk: { tableId: student.id, columnId: student.columns[0].id } }),
    makeColumn({ name: "COURSE_CODE", type: "VARCHAR2", size: "20", notNull: true }),
    makeColumn({ name: "STATUS", type: "CHAR", size: "1", notNull: true, defaultValue: "'A'", check: "STATUS IN ('A', 'I')" }),
    makeColumn({ name: "ENROLLED_ON", type: "DATE", size: "", notNull: true, defaultValue: "SYSDATE" }),
  ];
  enrollment.keyStrategy = "none";
  return {
    id: nextId("schema"),
    name: "Oracle PL/SQL Workspace",
    revision: 1,
    schemaFormatVersion: SCHEMA_FORMAT_VERSION,
    tables: [student, enrollment],
    groups: [],
    relationships: [],
    memos: [],
  };
}

export function makeEmptySchema(name = "Untitled Diagram", id = nextId("schema")): Schema {
  return {
    id,
    name,
    revision: 1,
    schemaFormatVersion: SCHEMA_FORMAT_VERSION,
    tables: [],
    groups: [],
    relationships: [],
    memos: [],
  };
}

export function normalizeIdentifier(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_$#]/g, "_").replace(/^([0-9])/, "T_$1");
}

/**
 * The `MLL_` a group stamps onto its tables, or `""` when it has no usable
 * keyword. Normalized here rather than at edit time, per the convention that
 * users type freely and Oracle's rules apply on the way out -- so `mll` and
 * `MLL` agree, and a keyword of nothing but punctuation degrades to no prefix
 * rather than to a bare `_`.
 */
export function groupPrefix(group?: Pick<SchemaGroup, "keyword">) {
  const keyword = normalizeIdentifier(group?.keyword ?? "").replace(/_+$/, "");
  return keyword ? `${keyword}_` : "";
}

/**
 * Whether `name` already opens with `prefix`, compared case- and
 * separator-insensitively. Deliberately not `normalizeIdentifier`: its
 * digit-leading `T_` rule grows the string, and a prefix of `T_` would then
 * match `1ABC` and slice two characters out of the middle of it.
 */
function carriesPrefix(name: string, prefix: string) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9_$#]/g, "_").startsWith(prefix);
}

/**
 * Idempotent: a name already carrying the prefix comes back untouched, so the
 * apply action can be re-run and a name built from prefixed parts never doubles
 * up. `mll_x` already carries `MLL_`.
 */
export function prefixTableName(name: string, prefix: string) {
  if (!prefix) return name;
  return carriesPrefix(name, prefix) ? name.trim() : `${prefix}${name.trim()}`;
}

/** Inverse of `prefixTableName`; a no-op on a name that does not carry the prefix. */
export function stripTablePrefix(name: string, prefix: string) {
  return prefix && carriesPrefix(name, prefix) ? name.trim().slice(prefix.length) : name;
}

export function typeString(column: Column) {
  if (typeUsesSize(column.type) && column.size) return `${column.type}(${column.size})`;
  return column.type;
}

export function typeUsesSize(type: OracleType) {
  return ["VARCHAR2", "CHAR", "NCHAR", "NVARCHAR2", "NUMBER", "FLOAT", "TIMESTAMP", "RAW"].includes(type);
}

export function typeSizePlaceholder(type: OracleType) {
  if (["NUMBER"].includes(type)) return "precision[,scale]";
  if (["TIMESTAMP"].includes(type)) return "precision 0–9";
  if (["FLOAT"].includes(type)) return "precision 1–126";
  return "size";
}

export function isNumeric(column: Column) {
  return column.type === "NUMBER";
}

export function primaryKeyColumns(table: Table) {
  return table.columns.filter((column) => column.pk);
}

/**
 * Card geometry. Mirrored by the same constants in Designer.tsx — relationship
 * anchor routing depends on the two agreeing, so change them together.
 */
export const TABLE_WIDTH = 220;
/** Ceiling for the name-derived width; a manual resize may go wider. */
export const TABLE_AUTO_MAX_WIDTH = 420;
export const TABLE_MIN_WIDTH = 180;
export const TABLE_MAX_WIDTH = 640;
export const TABLE_COLOR_STRIP_HEIGHT = 7;
export const TABLE_HEADER_HEIGHT = 50;
export const TABLE_FIELD_HEIGHT = 36;

export function clampTableWidth(width: number) {
  return Math.max(TABLE_MIN_WIDTH, Math.min(TABLE_MAX_WIDTH, Math.round(width)));
}

/**
 * A manual width wins; otherwise keep short names compact while giving long
 * names room before ellipsis.
 */
export function tableWidth(table: Pick<Table, "name"> & Partial<Pick<Table, "width">>) {
  if (typeof table.width === "number" && Number.isFinite(table.width)) return clampTableWidth(table.width);
  const nameWidth = 130 + table.name.trim().length * 9;
  return Math.max(TABLE_WIDTH, Math.min(TABLE_AUTO_MAX_WIDTH, nameWidth));
}

export function tableHeight(table: Table) {
  return (
    TABLE_COLOR_STRIP_HEIGHT +
    TABLE_HEADER_HEIGHT +
    table.columns.length * TABLE_FIELD_HEIGHT
  );
}

/** Clear of everything already on the canvas, so an import never lands on top of it. */
export const APPEND_GAP = 120;

/** Left and bottom of everything drawn, or `null` for an empty canvas. */
export function contentEdges(schema: Schema) {
  const boxes = [
    ...schema.tables.map((table) => ({ x: table.x, y: table.y + tableHeight(table) })),
    ...(schema.groups ?? []).map((group) => ({ x: group.x, y: group.y + group.height })),
    ...(schema.memos ?? []).map((memo) => ({ x: memo.x, y: memo.y + memo.height })),
  ];
  return boxes.length ? { left: Math.min(...boxes.map((box) => box.x)), bottom: Math.max(...boxes.map((box) => box.y)) } : null;
}

/**
 * Prune unique constraints against the columns that actually exist. A member
 * column being deleted has to shrink its constraint rather than break it, so a
 * missing id is dropped silently and a constraint left with nothing is dropped
 * whole. Repeated column sets collapse -- Oracle would reject the second index.
 */
function normalizeUniques(table: Table): UniqueConstraint[] | undefined {
  const columnIds = new Set(table.columns.map((column) => column.id));
  const sets = new Set<string>();
  const uniques = (Array.isArray(table.uniques) ? table.uniques : []).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const constraint = value as Partial<UniqueConstraint>;
    if (typeof constraint.id !== "string" || !constraint.id) return [];
    const members = [...new Set((Array.isArray(constraint.columnIds) ? constraint.columnIds : []).filter((id) => typeof id === "string" && columnIds.has(id)))];
    if (!members.length) return [];
    // Order is the DDL's, so the key is order-sensitive on purpose: `(a, b)`
    // and `(b, a)` index the same rows but read differently to the user.
    const key = members.join(" ");
    if (sets.has(key)) return [];
    sets.add(key);
    const name = typeof constraint.name === "string" ? constraint.name.trim() : "";
    return [{ id: constraint.id, name: name || undefined, columnIds: members }];
  });
  return uniques.length ? uniques : undefined;
}

/**
 * Drop garbage manual widths (nulls, NaN, values from a future version) and
 * clamp the survivors, so a bad `width` degrades to auto rather than to a
 * zero-width card. Unique constraints are pruned against the surviving columns
 * in the same pass.
 */
export function normalizeTables(schema: Schema): Schema {
  const next = cloneSchema(schema);
  next.tables = next.tables.map((table) => {
    const width = (table as Partial<Table>).width;
    /*
     * A size left over from an earlier type is not just noise: DATE(255) is a
     * validation error and reads as a real limit on the card. The editor drops
     * it on the way in, but schemas written before it did still carry one.
     */
    const columns = table.columns.map((column) =>
      column.size && !typeUsesSize(column.type) ? { ...column, size: "" } : column,
    );
    const uniques = normalizeUniques(table);
    if (width === undefined) return { ...table, columns, uniques };
    return typeof width === "number" && Number.isFinite(width)
      ? { ...table, columns, uniques, width: clampTableWidth(width) }
      : { ...table, columns, uniques, width: undefined };
  });
  return next;
}

export function cloneSchema(schema: Schema): Schema {
  return structuredClone(schema);
}

export function normalizeGroups(schema: Schema): Schema {
  const next = cloneSchema(schema);
  const groups = Array.isArray(next.groups) ? next.groups : [];
  const seen = new Set<string>();
  next.groups = groups.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const group = value as Partial<SchemaGroup>;
    if (typeof group.id !== "string" || !group.id || seen.has(group.id)) return [];
    seen.add(group.id);
    return [{
      id: group.id,
      name: typeof group.name === "string" && group.name.trim() ? group.name.trim() : `Schema ${index + 1}`,
      keyword: typeof group.keyword === "string" && group.keyword.trim() ? group.keyword.trim() : undefined,
      x: typeof group.x === "number" && Number.isFinite(group.x) ? Math.max(0, group.x) : 80,
      y: typeof group.y === "number" && Number.isFinite(group.y) ? Math.max(0, group.y) : 80,
      width: typeof group.width === "number" && Number.isFinite(group.width) ? Math.max(360, group.width) : 760,
      height: typeof group.height === "number" && Number.isFinite(group.height) ? Math.max(260, group.height) : 520,
      color: GROUP_COLORS.includes(group.color as GroupColor) ? group.color as GroupColor : GROUP_COLORS[index % GROUP_COLORS.length],
    }];
  });
  const valid = new Set(next.groups.map((group) => group.id));
  next.tables = next.tables.map((table) => valid.has(table.schemaId ?? "")
    ? table
    : { ...table, schemaId: undefined });
  next.memos = next.memos?.map((memo) => valid.has(memo.schemaId ?? "")
    ? memo
    : { ...memo, schemaId: undefined });
  next.schemaFormatVersion = SCHEMA_FORMAT_VERSION;
  return next;
}

/** Everything that rides along with a schema group when it is relocated. */
export function groupMembers(schema: Schema, groupId: string) {
  return {
    tables: schema.tables.filter((table) => table.schemaId === groupId),
    memos: (schema.memos ?? []).filter((memo) => memo.schemaId === groupId),
  };
}

export const RELATIONSHIP_CONSTRAINTS: RelationshipConstraint[] = [
  "No action",
  "Restrict",
  "Cascade",
  "Set null",
  "Set default",
];

function relationshipName(tables: Table[], startTableId: string, startFieldId: string, endTableId: string) {
  const start = tables.find((table) => table.id === startTableId);
  const field = start?.columns.find((column) => column.id === startFieldId);
  const end = tables.find((table) => table.id === endTableId);
  return `fk_${start?.name ?? "table"}_${field?.name ?? "field"}_${end?.name ?? "table"}`;
}

function isCardinality(value: unknown): value is Cardinality {
  return value === "one_to_one" || value === "one_to_many" || value === "many_to_one";
}

function isConstraint(value: unknown): value is RelationshipConstraint {
  return RELATIONSHIP_CONSTRAINTS.includes(value as RelationshipConstraint);
}

/** Normalize persisted relationship data and migrate the original column.fk format. */
export function normalizeRelationships(schema: Schema): Schema {
  const next = cloneSchema(schema);
  const raw = Array.isArray(next.relationships) ? next.relationships : [];
  const relationships: Relationship[] = [];
  const used = new Set<string>();

  const add = (value: Partial<Relationship>, fallbackId: string) => {
    const startTable = next.tables.find((table) => table.id === value.startTableId);
    const endTable = next.tables.find((table) => table.id === value.endTableId);
    const startField = startTable?.columns.find((column) => column.id === value.startFieldId);
    const endField = endTable?.columns.find((column) => column.id === value.endFieldId);
    if (!startTable || !endTable || !startField || !endField) return;
    const pairs = Array.isArray(value.fields) && value.fields.length
      ? value.fields.filter((pair): pair is RelationshipFieldPair => Boolean(pair?.startFieldId && pair?.endFieldId))
      : [{ startFieldId: startField.id, endFieldId: endField.id }];
    const validPairs = pairs.filter((pair) => startTable.columns.some((column) => column.id === pair.startFieldId) && endTable.columns.some((column) => column.id === pair.endFieldId));
    if (!validPairs.length) return;
    const id = typeof value.id === "string" && value.id ? value.id : fallbackId;
    if (used.has(id)) return;
    used.add(id);
    relationships.push({
      id,
      startTableId: startTable.id,
      startFieldId: validPairs[0].startFieldId,
      endTableId: endTable.id,
      endFieldId: validPairs[0].endFieldId,
      fields: validPairs,
      name: typeof value.name === "string" && value.name ? value.name : relationshipName(next.tables, startTable.id, validPairs[0].startFieldId, endTable.id),
      cardinality: isCardinality(value.cardinality) ? value.cardinality : "many_to_one",
      manyLabel: typeof value.manyLabel === "string" ? value.manyLabel : "n",
      updateConstraint: isConstraint(value.updateConstraint) ? value.updateConstraint : "No action",
      deleteConstraint: isConstraint(value.deleteConstraint) ? value.deleteConstraint : "No action",
    });
  };

  raw.forEach((relationship, index) => add(relationship, `rel_${index + 1}`));
  if (!raw.length) {
    next.tables.forEach((table) => table.columns.forEach((column) => {
      if (!column.fk) return;
      add({
        id: `rel_${relationships.length + 1}`,
        startTableId: table.id,
        startFieldId: column.id,
        endTableId: column.fk.tableId,
        endFieldId: column.fk.columnId,
      }, `rel_${relationships.length + 1}`);
    }));
  }

  next.tables = next.tables.map((table) => ({
    ...table,
    columns: table.columns.map((column) => ({ ...column, fk: null })),
  }));
  relationships.forEach((relationship) => relationship.fields.forEach((pair) => {
    next.tables = next.tables.map((table) => table.id === relationship.startTableId
      ? { ...table, columns: table.columns.map((column) => column.id === pair.startFieldId ? { ...column, fk: { tableId: relationship.endTableId, columnId: pair.endFieldId } } : column) }
      : table);
  }));
  next.relationships = relationships;
  next.schemaFormatVersion = SCHEMA_FORMAT_VERSION;
  return next;
}
