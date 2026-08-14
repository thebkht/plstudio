"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  useCollaborativeSchema,
  type CollabUser,
} from "@/app/lib/collab/useCollaborativeSchema";
import {
  makeColumn,
  nextId,
  normalizeRelationships,
  typeUsesSize,
  type Column,
  type Schema,
  type SchemaGroup,
  type Table,
} from "@/app/lib/schema";
import { generateDDL } from "@/app/lib/generators";
import { validateSchema } from "@/app/lib/validation";
import type { ValidationIssue } from "@/app/lib/validation";
import { useLayout } from "@/app/hooks/use-layout";
import { useSaveState } from "@/app/hooks/use-save-state";
import { prepareCanvasSchema } from "../geometry";

export type SchemaProviderProps = {
  initialSchema: Schema;
  projectId: string;
  workspaceSlug?: string;
  shareToken?: string;
  readOnly: boolean;
  user?: (CollabUser & { email?: string | null }) | null;
  children: ReactNode;
};

export type SchemaContextValue = {
  schema: Schema;
  /** Read by gesture handlers that only hold a ref to current state. */
  schemaRef: React.RefObject<Schema>;
  commit: (next: Schema) => void;
  commitWith: (mutate: (current: Schema) => Schema) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setRevision: (revision: number) => void;
  collabStatus: ReturnType<typeof useCollaborativeSchema>["status"];
  peers: ReturnType<typeof useCollaborativeSchema>["peers"];
  setCursor: ReturnType<typeof useCollaborativeSchema>["setCursor"];
  broadcastSelection: ReturnType<typeof useCollaborativeSchema>["setSelection"];
  patchTable: (id: string, patch: Partial<Table>) => void;
  patchColumn: (
    tableId: string,
    columnId: string,
    patch: Partial<Column>,
  ) => void;
  deleteTable: (id: string) => void;
  deleteColumn: (tableId: string, columnId: string) => void;
  addColumn: (tableId: string) => void;
  reorderColumns: (tableId: string, from: number, to: number) => void;
  tablesById: Map<string, Table>;
  groupsById: Map<string, SchemaGroup>;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  ddl: string;
};

export const SchemaContext = createContext<SchemaContextValue | null>(null);

export function SchemaProvider({
  initialSchema,
  projectId,
  workspaceSlug,
  shareToken,
  readOnly,
  user,
  children,
}: SchemaProviderProps) {
  const { panelMode } = useLayout();
  const { setDirty } = useSaveState();

  // Awareness broadcasts this object to every peer, so hand the hook only the
  // presence fields; the email stays local to `NavUser`.
  const collabUser = useMemo(
    () => (user ? { id: user.id, name: user.name, image: user.image } : user),
    [user],
  );
  const {
    schema,
    commit: commitShared,
    undo: undoShared,
    redo: redoShared,
    canUndo,
    canRedo,
    setRevision,
    status: collabStatus,
    peers,
    setCursor,
    setSelection: broadcastSelection,
  } = useCollaborativeSchema({
    projectId,
    initialSchema: useMemo(
      () => prepareCanvasSchema(initialSchema),
      [initialSchema],
    ),
    readOnly,
    user: collabUser,
    shareToken,
    workspaceSlug,
  });

  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  /**
   * Every edit lands in the shared document; undo history is the CRDT's, scoped
   * to this client. `dirty` only tracks whether an explicit save is pending —
   * saving to the project file is manual.
   */
  const commit = useCallback(
    (next: Schema) => {
      if (readOnly) return;
      commitShared(next);
      setDirty(true);
    },
    [commitShared, readOnly, setDirty],
  );

  /** Functional form of `commit`, for gesture handlers that only hold a ref to current state. */
  const commitWith = useCallback(
    (mutate: (current: Schema) => Schema) => commit(mutate(schemaRef.current)),
    [commit],
  );

  /** Undo walks only this client's own edits — never a collaborator's. */
  const undo = useCallback(() => {
    if (readOnly) return;
    undoShared();
    setDirty(true);
  }, [readOnly, undoShared, setDirty]);
  const redo = useCallback(() => {
    if (readOnly) return;
    redoShared();
    setDirty(true);
  }, [readOnly, redoShared, setDirty]);

  const patchTable = useCallback(
    (id: string, patch: Partial<Table>) =>
      commitWith((current) => ({
        ...current,
        tables: current.tables.map((table) =>
          table.id === id ? { ...table, ...patch } : table,
        ),
      })),
    [commitWith],
  );

  const patchColumn = useCallback(
    (tableId: string, columnId: string, patch: Partial<Column>) => {
      /*
       * Changing away from a sized type drops the size with it. Leaving the old
       * VARCHAR2 length on a DATE column would surface as DATE(255) on the card
       * and as a "does not accept a size" validation error the user never typed.
       */
      const applied =
        patch.type && !typeUsesSize(patch.type)
          ? { ...patch, size: "" }
          : patch;
      const next = {
        ...schema,
        tables: schema.tables.map((table) =>
          table.id === tableId
            ? {
                ...table,
                columns: table.columns.map((column) =>
                  column.id === columnId ? { ...column, ...applied } : column,
                ),
              }
            : table,
        ),
      };
      if ("fk" in patch) {
        const relationships = (schema.relationships ?? []).filter(
          (relationship) =>
            !relationship.fields.some(
              (pair) =>
                relationship.startTableId === tableId &&
                pair.startFieldId === columnId,
            ),
        );
        const fk = patch.fk;
        if (fk) {
          const table = schema.tables.find((item) => item.id === tableId);
          const column = table?.columns.find((item) => item.id === columnId);
          const target = schema.tables.find((item) => item.id === fk.tableId);
          const targetColumn = target?.columns.find(
            (item) => item.id === fk.columnId,
          );
          if (table && column && target && targetColumn)
            relationships.push({
              id: nextId("rel"),
              startTableId: table.id,
              startFieldId: column.id,
              endTableId: target.id,
              endFieldId: targetColumn.id,
              fields: [
                { startFieldId: column.id, endFieldId: targetColumn.id },
              ],
              name: `fk_${table.name}_${column.name}_${target.name}`,
              cardinality: "many_to_one",
              manyLabel: "n",
              updateConstraint: "No action",
              deleteConstraint: "No action",
            });
        }
        commit(normalizeRelationships({ ...next, relationships }));
      } else commit(next);
    },
    [commit, schema],
  );

  const deleteTable = useCallback(
    (id: string) => {
      commitWith((current) =>
        normalizeRelationships({
          ...current,
          tables: current.tables
            .filter((table) => table.id !== id)
            .map((table) => ({
              ...table,
              columns: table.columns.map((column) =>
                column.fk?.tableId === id ? { ...column, fk: null } : column,
              ),
            })),
        }),
      );
    },
    [commitWith],
  );

  const deleteColumn = useCallback(
    (tableId: string, columnId: string) =>
      commitWith((current) =>
        normalizeRelationships({
          ...current,
          tables: current.tables.map((table) =>
            table.id === tableId
              ? {
                  ...table,
                  columns: table.columns.filter(
                    (column) => column.id !== columnId,
                  ),
                }
              : {
                  ...table,
                  columns: table.columns.map((column) =>
                    column.fk?.columnId === columnId
                      ? { ...column, fk: null }
                      : column,
                  ),
                },
          ),
        }),
      ),
    [commitWith],
  );

  const addColumn = useCallback(
    (tableId: string) => {
      if (!schemaRef.current.tables.some((item) => item.id === tableId)) return;
      commitWith((current) => ({
        ...current,
        tables: current.tables.map((item) =>
          item.id === tableId
            ? {
                ...item,
                columns: [
                  ...item.columns,
                  makeColumn({ name: `COLUMN_${item.columns.length + 1}` }),
                ],
              }
            : item,
        ),
      }));
    },
    [commitWith],
  );

  const reorderColumns = useCallback(
    (tableId: string, from: number, to: number) => {
      if (from === to) return;
      commitWith((current) => ({
        ...current,
        tables: current.tables.map((table) => {
          if (table.id !== tableId) return table;
          const columns = [...table.columns];
          const [moved] = columns.splice(from, 1);
          if (!moved) return table;
          columns.splice(to, 0, moved);
          return { ...table, columns };
        }),
      }));
    },
    [commitWith],
  );

  const tablesById = useMemo(
    () => new Map(schema.tables.map((table) => [table.id, table])),
    [schema.tables],
  );
  const groupsById = useMemo(
    () => new Map((schema.groups ?? []).map((group) => [group.id, group])),
    [schema.groups],
  );

  const issues = useMemo(() => validateSchema(schema), [schema]);
  const errors = useMemo(
    () => issues.filter((issue) => issue.severity === "error"),
    [issues],
  );
  /**
   * Generating SQL is the most expensive thing a schema change can trigger, and
   * almost every schema change discards the result: the code panel and the
   * export dialog are the only readers. Gate each generator on a visible reader
   * so typing doesn't rebuild DDL nobody is looking at.
   */
  const ddl = useMemo(
    () => (panelMode === "code" ? generateDDL(schema) : ""),
    [panelMode, schema],
  );

  const value = useMemo(
    () => ({
      schema,
      schemaRef,
      commit,
      commitWith,
      undo,
      redo,
      canUndo,
      canRedo,
      setRevision,
      collabStatus,
      peers,
      setCursor,
      broadcastSelection,
      patchTable,
      patchColumn,
      deleteTable,
      deleteColumn,
      addColumn,
      reorderColumns,
      tablesById,
      groupsById,
      issues,
      errors,
      ddl,
    }),
    [
      schema,
      commit,
      commitWith,
      undo,
      redo,
      canUndo,
      canRedo,
      setRevision,
      collabStatus,
      peers,
      setCursor,
      broadcastSelection,
      patchTable,
      patchColumn,
      deleteTable,
      deleteColumn,
      addColumn,
      reorderColumns,
      tablesById,
      groupsById,
      issues,
      errors,
      ddl,
    ],
  );
  return (
    <SchemaContext.Provider value={value}>{children}</SchemaContext.Provider>
  );
}
