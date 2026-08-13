import * as Y from "yjs";
import {
  SCHEMA_FORMAT_VERSION,
  type Column,
  type Memo,
  type Relationship,
  type Schema,
  type SchemaGroup,
  type Table,
} from "@/app/lib/schema";

/**
 * The shared document mirrors `Schema` one-to-one: every domain collection is a
 * `Y.Array` of `Y.Map` records rather than an id-keyed map, because order is
 * user-visible (column order, table z-order) and `Y.Map` has no stable ordering.
 * Each record being its own `Y.Map` is what keeps edits granular — two people
 * renaming different tables touch disjoint keys and never conflict.
 *
 * `revision` and `updatedAt` are deliberately absent: they belong to the server's
 * mirror of the document, not to the document itself.
 */
export type YSchemaRoot = {
  meta: Y.Map<unknown>;
  tables: Y.Array<Y.Map<unknown>>;
  relationships: Y.Array<Y.Map<unknown>>;
  groups: Y.Array<Y.Map<unknown>>;
  memos: Y.Array<Y.Map<unknown>>;
};

export const schemaRoot = (ydoc: Y.Doc): YSchemaRoot => ({
  meta: ydoc.getMap("meta"),
  tables: ydoc.getArray<Y.Map<unknown>>("tables"),
  relationships: ydoc.getArray<Y.Map<unknown>>("relationships"),
  groups: ydoc.getArray<Y.Map<unknown>>("groups"),
  memos: ydoc.getArray<Y.Map<unknown>>("memos"),
});

/** A doc nobody has seeded yet. Guards against two clients both seeding on first open. */
export const isEmptyDoc = (ydoc: Y.Doc) => {
  const root = schemaRoot(ydoc);
  return root.meta.size === 0 && root.tables.length === 0 && root.groups.length === 0 && root.memos.length === 0 && root.relationships.length === 0;
};

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Writes only what actually differs — a no-op `set` still churns the network and the undo stack. */
function setIfChanged(map: Y.Map<unknown>, key: string, value: unknown) {
  if (value === undefined) { if (map.has(key)) map.delete(key); return; }
  if (!same(map.get(key), value)) map.set(key, value);
}

const writeFields = (map: Y.Map<unknown>, fields: Record<string, unknown>) =>
  Object.entries(fields).forEach(([key, value]) => setIfChanged(map, key, value));

const readId = (map: Y.Map<unknown>) => map.get("id") as string;

/**
 * Reconciles a `Y.Array` of records against the next domain array: drop removed
 * ids, patch survivors in place, insert additions at their target index. A full
 * rebuild is the last resort for reordering, which `Y.Array` cannot express as a
 * move — but it only triggers when the order genuinely changed.
 */
function reconcileList<T extends { id: string }>(
  list: Y.Array<Y.Map<unknown>>,
  next: T[],
  write: (map: Y.Map<unknown>, item: T) => void,
) {
  const nextIds = new Set(next.map((item) => item.id));
  for (let index = list.length - 1; index >= 0; index -= 1) if (!nextIds.has(readId(list.get(index)))) list.delete(index, 1);

  // A preliminary Y.Map cannot be read back, so every record is integrated into
  // the list first and populated afterwards — never built up detached.
  next.forEach((item, target) => {
    const existing = list.toArray().findIndex((map) => readId(map) === item.id);
    if (existing !== -1) return write(list.get(existing), item);
    const map = new Y.Map<unknown>();
    list.insert(Math.min(target, list.length), [map]);
    write(map, item);
  });

  const order = list.toArray().map(readId);
  if (order.length === next.length && order.every((id, index) => id === next[index].id)) return;
  list.delete(0, list.length);
  const rebuilt = next.map(() => new Y.Map<unknown>());
  list.insert(0, rebuilt);
  next.forEach((item, index) => write(rebuilt[index], item));
}

const writeColumn = (map: Y.Map<unknown>, column: Column) =>
  writeFields(map, {
    id: column.id, name: column.name, type: column.type, size: column.size, notNull: column.notNull,
    pk: column.pk, unique: column.unique, defaultValue: column.defaultValue, check: column.check,
    comment: column.comment, fk: column.fk,
  });

function writeTable(map: Y.Map<unknown>, table: Table) {
  writeFields(map, {
    id: table.id, name: table.name, x: table.x, y: table.y, color: table.color,
    keyStrategy: table.keyStrategy, schemaId: table.schemaId, comment: table.comment, width: table.width,
  });
  if (!(map.get("columns") instanceof Y.Array)) map.set("columns", new Y.Array<Y.Map<unknown>>());
  reconcileList(map.get("columns") as Y.Array<Y.Map<unknown>>, table.columns, writeColumn);
}

const writeRelationship = (map: Y.Map<unknown>, relationship: Relationship) =>
  writeFields(map, {
    id: relationship.id, startTableId: relationship.startTableId, startFieldId: relationship.startFieldId,
    endTableId: relationship.endTableId, endFieldId: relationship.endFieldId, fields: relationship.fields,
    name: relationship.name, cardinality: relationship.cardinality, manyLabel: relationship.manyLabel,
    updateConstraint: relationship.updateConstraint, deleteConstraint: relationship.deleteConstraint,
  });

const writeGroup = (map: Y.Map<unknown>, group: SchemaGroup) =>
  writeFields(map, { id: group.id, name: group.name, x: group.x, y: group.y, width: group.width, height: group.height, color: group.color });

const writeMemo = (map: Y.Map<unknown>, memo: Memo) =>
  writeFields(map, { id: memo.id, text: memo.text, x: memo.x, y: memo.y, width: memo.width, height: memo.height, color: memo.color });

/**
 * Applies a whole next `Schema` to the doc as one transaction. Taking a whole
 * schema — rather than granular operations — is what lets every existing
 * `commit(next)` call site in the designer stay exactly as it is.
 *
 * `origin` tags the transaction so `Y.UndoManager` can track only local edits.
 */
export function applySchemaToYDoc(ydoc: Y.Doc, next: Schema, origin?: unknown) {
  const root = schemaRoot(ydoc);
  ydoc.transact(() => {
    writeFields(root.meta, { id: next.id, name: next.name, schemaFormatVersion: next.schemaFormatVersion ?? SCHEMA_FORMAT_VERSION });
    reconcileList(root.tables, next.tables, writeTable);
    reconcileList(root.relationships, next.relationships ?? [], writeRelationship);
    reconcileList(root.groups, next.groups ?? [], writeGroup);
    reconcileList(root.memos, next.memos ?? [], writeMemo);
  }, origin);
  return ydoc;
}

const readRecord = <T>(map: Y.Map<unknown>, keys: readonly (keyof T & string)[]) =>
  keys.reduce((record, key) => {
    const value = map.get(key);
    if (value !== undefined) (record as Record<string, unknown>)[key] = value;
    return record;
  }, {} as T);

const COLUMN_KEYS = ["id", "name", "type", "size", "notNull", "pk", "unique", "defaultValue", "check", "comment"] as const;
const TABLE_KEYS = ["id", "name", "x", "y", "color", "keyStrategy", "schemaId", "comment", "width"] as const;
const RELATIONSHIP_KEYS = ["id", "startTableId", "startFieldId", "endTableId", "endFieldId", "fields", "name", "cardinality", "manyLabel", "updateConstraint", "deleteConstraint"] as const;
const GROUP_KEYS = ["id", "name", "x", "y", "width", "height", "color"] as const;
const MEMO_KEYS = ["id", "text", "x", "y", "width", "height", "color"] as const;

/**
 * Ids are unique by definition in the domain, so a repeated id is always damage —
 * typically two clients having seeded the same document, whose records the CRDT
 * merges rather than dedupes. Reading keeps the first and drops the rest so a
 * damaged document still renders, rather than duplicating every table on screen.
 */
const byId = <T extends { id: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => !seen.has(item.id) && seen.add(item.id));
};

const readColumn = (map: Y.Map<unknown>): Column => ({ ...readRecord<Column>(map, COLUMN_KEYS), fk: (map.get("fk") as Column["fk"]) ?? null });

const readTable = (map: Y.Map<unknown>): Table => ({
  ...readRecord<Table>(map, TABLE_KEYS),
  columns: byId(((map.get("columns") as Y.Array<Y.Map<unknown>> | undefined)?.toArray() ?? []).map(readColumn)),
});

/**
 * Projects the shared document back into the plain `Schema` the whole domain
 * layer already speaks, so validation, generation and export stay untouched.
 * `id` and `revision` are server-owned and may be supplied by the caller.
 */
export function schemaFromYDoc(ydoc: Y.Doc, overrides: { id?: string; revision?: number } = {}): Schema {
  const root = schemaRoot(ydoc);
  return {
    id: overrides.id ?? (root.meta.get("id") as string) ?? "",
    name: (root.meta.get("name") as string) ?? "Untitled",
    revision: overrides.revision ?? 0,
    schemaFormatVersion: (root.meta.get("schemaFormatVersion") as number) ?? SCHEMA_FORMAT_VERSION,
    tables: byId(root.tables.toArray().map(readTable)),
    relationships: byId(root.relationships.toArray().map((map) => readRecord<Relationship>(map, RELATIONSHIP_KEYS))),
    groups: byId(root.groups.toArray().map((map) => readRecord<SchemaGroup>(map, GROUP_KEYS))),
    memos: byId(root.memos.toArray().map((map) => readRecord<Memo>(map, MEMO_KEYS))),
  };
}
