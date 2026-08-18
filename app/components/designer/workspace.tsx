"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Delete02Icon,
  Link01Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CollabUser } from "@/app/lib/collab/useCollaborativeSchema";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { generateDDL } from "@/app/lib/generators";
import {
  appendCreateTable,
  appendMermaidER,
  parseCreateTable,
  parseMermaidER,
} from "@/app/lib/parser";
import { mergeSchemaJson, parseSchemaJson } from "@/app/lib/schema-json";
import {
  createSaveQueue,
  type SaveQueue,
  type SaveResult,
} from "@/app/lib/save-queue";
import { EMPTY_SELECTION, selectAll } from "@/app/lib/selection";
import {
  isEditingTarget,
  matchShortcut,
  shortcutById,
  shortcutHint,
  type ShortcutId,
} from "@/app/lib/shortcuts";
import { project } from "@/app/lib/motion";
import {
  groupPrefix,
  GROUP_PALETTE,
  normalizeRelationships,
  RELATIONSHIP_CONSTRAINTS,
  primaryKeyColumns,
  type Schema,
  type Table,
  type Column,
  type KeyStrategy,
  type Relationship,
  type Cardinality,
} from "@/app/lib/schema";
import { type MenuItem } from "@/app/components/designer/primitives";
import { ColumnList } from "./editor-side-panel/tables-tab/column-list";
import { UniqueConstraints } from "./editor-side-panel/tables-tab/unique-constraints";
import type { ImportMessage } from "./editor-header/modal/import";
import {
  useCanvasCommands,
  useDesignerSettings,
  useLayout,
  useSaveState,
  useSchema,
  useSelect,
  useTransformControls,
} from "@/app/hooks";
import { ControlPanel } from "./editor-header/control-panel";
import { Modals } from "./editor-header/modal/modal";
import { SidePanel } from "./editor-side-panel/side-panel";
import { CanvasHost } from "./editor-canvas/canvas-host";
import { TablesTab } from "./editor-side-panel/tables-tab/tables-tab";
import {
  RelationshipsTab,
  type RelationshipRow,
} from "./editor-side-panel/relationships-tab/relationships-tab";
import { NO_GROUP } from "./constants";
import { prepareCanvasSchema, relationshipCardinalities } from "./geometry";

export type DesignerProps = {
  initialSchema: Schema;
  projectId: string;
  workspaceSlug?: string;
  workspaceId?: string;
  shareToken?: string;
  readOnly?: boolean;
  // The email is for the account menu only — never for presence, see below.
  user?: (CollabUser & { email?: string | null }) | null;
};

export default function Workspace({
  initialSchema,
  projectId,
  workspaceSlug,
  workspaceId,
  shareToken,
  readOnly = false,
  user,
}: DesignerProps) {
  const router = useRouter();
  const {
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
    patchTable,
    patchColumn,
    deleteTable,
    deleteColumn,
    addColumn,
    reorderColumns,
    addUnique,
    patchUnique,
    deleteUnique,
    tablesById,
    groupsById,
    issues,
    errors,
  } = useSchema();
  const {
    selection,
    setSelection,
    selectionRef,
    single,
    selectedId,
    selectedGroupId,
    selectedMemoId,
    selectedIdRef,
    selectSingle,
    selectTable,
  } = useSelect();
  /*
   * Commands only. The gesture state these close over lives in
   * `editor-canvas/canvas-host`, *below* this component — what is destructured
   * here are forwarders through a context value built once for the app's
   * lifetime, so reading them costs no re-render.
   */
  const {
    addGroup,
    addMemo,
    addTable,
    assignTableToGroup,
    autoLayout,
    copySelection,
    deleteSelection,
    fitView,
    makeJunction,
    pasteSelection,
    revealTables,
    setHandMode,
    setSpaceHeld,
    zoomBy,
  } = useCanvasCommands();
  /** Came with the gestures until they moved down; it is a lookup, not a gesture. */
  const selected = (selectedId && tablesById.get(selectedId)) || null;

  const { setZoom } = useTransformControls();

  const [importMessage, setImportMessage] = useState<ImportMessage | null>(
    null,
  );
  const {
    settings: relationSettings,
    setSettings: setRelationSettings,
    isMac,
  } = useDesignerSettings();
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    isResizingSidebar,
    onSidebarResizeStart,
    resetSidebarWidth,
    panelTab,
    setPanelTab,
    panelMode,
    setPanelMode,
    modal,
    setModal,
    openMenu,
    setOpenMenu,
    userMenuOpen,
    setUserMenuOpen,
    issuesOpen,
    setIssuesOpen,
    tableQuery,
    setTableQuery,
    relationshipQuery,
    setRelationshipQuery,
    openRelationshipId,
    setOpenRelationshipId,
    collapsedGroupIds,
    setCollapsedGroupIds,
  } = useLayout();
  const { dirty, setDirty, saveState, setSaveState } = useSaveState();
  useEffect(() => {
    /*
     * Reporting only. `SchemaProvider` already ran `prepareCanvasSchema` on the
     * way in, so repairing a second time here would redo an O(n²) sweep on every
     * open and commit its own result back — marking a freshly opened diagram
     * dirty. Comparing the seeded schema against the raw one says the same thing
     * for free.
     */
    const moved = schema.tables.some(
      (table, index) =>
        table.x !== initialSchema.tables[index]?.x ||
        table.y !== initialSchema.tables[index]?.y,
    );
    if (moved) toast.success("Overlapping tables were separated.");
    // Seeding only: re-running this on every `commit` would fight live edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSchema]);
  const filteredTables = useMemo(() => {
    const query = tableQuery.trim().toUpperCase();
    return query
      ? schema.tables.filter((table) =>
          table.name.toUpperCase().includes(query),
        )
      : schema.tables;
  }, [schema.tables, tableQuery]);
  /**
   * Id indexes over the schema. The card tree resolves a foreign key target and
   * a group for every column of every table on every render, and a linear find
   * inside those loops makes the render quadratic in table count. Build the
   * lookups once per schema instead.
   */
  /**
   * The tables panel mirrors the canvas' schema groups: one accordion section
   * per group, plus an ungrouped bucket. Empty groups stay visible so a group
   * created on the canvas is still discoverable here, but a search hides them —
   * "0 tables" is not a match.
   */
  const tableSections = useMemo(() => {
    const byGroup = new Map<string, Table[]>();
    filteredTables.forEach((table) => {
      const key = groupsById.has(table.schemaId ?? "")
        ? table.schemaId!
        : NO_GROUP;
      const bucket = byGroup.get(key);
      if (bucket) bucket.push(table);
      else byGroup.set(key, [table]);
    });
    const searching = Boolean(tableQuery.trim());
    return [
      ...(schema.groups ?? []).map((group) => ({
        id: group.id,
        name: group.name,
        prefix: groupPrefix(group),
        accent: GROUP_PALETTE[group.color].border,
        tables: byGroup.get(group.id) ?? [],
      })),
      {
        id: NO_GROUP,
        name: "Ungrouped",
        prefix: "",
        accent: "var(--ink-4)",
        tables: byGroup.get(NO_GROUP) ?? [],
      },
    ].filter(
      (section) =>
        section.tables.length || (!searching && section.id !== NO_GROUP),
    );
  }, [filteredTables, groupsById, schema.groups, tableQuery]);
  /**
   * Selecting a table on the canvas opens its editor in the panel, so its
   * section has to open with it — otherwise the editor is behind a collapsed
   * accordion the user never touched.
   */
  useEffect(() => {
    const table = schema.tables.find((item) => item.id === selectedId);
    if (!table) return;
    const sectionId = groupsById.has(table.schemaId ?? "")
      ? table.schemaId!
      : NO_GROUP;
    setCollapsedGroupIds((current) =>
      current.has(sectionId)
        ? new Set([...current].filter((id) => id !== sectionId))
        : current,
    );
  }, [selectedId, schema.tables, groupsById]);
  /**
   * Candidate FK targets bucketed by column type, so the editor's per-column
   * select is a map lookup rather than a fresh sweep of the whole schema.
   */
  const foreignKeyCandidates = useMemo(() => {
    const byType = new Map<string, { table: Table; target: Column }[]>();
    const byColumnId = new Map<string, { table: Table; target: Column }>();
    schema.tables
      .filter(
        (table) =>
          table.id !== selectedId && primaryKeyColumns(table).length <= 1,
      )
      .forEach((table) =>
        table.columns.forEach((target) => {
          const entry = { table, target };
          const bucket = byType.get(target.type);
          if (bucket) bucket.push(entry);
          else byType.set(target.type, [entry]);
          byColumnId.set(target.id, entry);
        }),
      );
    return { byType, byColumnId };
  }, [schema.tables, selectedId]);

  const compatibleForeignKeyTargets = useCallback(
    (column: Column) => {
      const matches = foreignKeyCandidates.byType.get(column.type) ?? [];
      // A column whose target has since changed type still has to list that
      // target, or the select would silently drop the FK it is displaying.
      const current = column.fk
        ? foreignKeyCandidates.byColumnId.get(column.fk.columnId)
        : undefined;
      return current && !matches.includes(current)
        ? [...matches, current]
        : matches;
    },
    [foreignKeyCandidates],
  );

  const importSchema = (text: string) => {
    const result = parseCreateTable(text);
    if (!result.schema) {
      setImportMessage({ ok: false, text: result.errors.join(" ") });
      return;
    }
    setImportMessage({
      ok: true,
      text: `${result.schema.tables.length} table(s) imported.${result.warnings.length ? ` ${result.warnings.length} warning(s).` : ""}`,
    });
    commit(result.schema);
    selectTable(result.schema.tables[0]?.id ?? null);
  };
  /**
   * The other half of import: keep the diagram and land the script's tables
   * under it. Nothing already on the canvas is edited, so the only new thing
   * to say is what was added and what was already there.
   */
  const appendSchema = (text: string) => {
    const result = appendCreateTable(schema, text);
    if (!result.schema) {
      setImportMessage({ ok: false, text: result.errors.join(" ") });
      return;
    }
    setImportMessage({
      ok: true,
      text: `${result.added.length} table(s) added.${result.skipped.length ? ` Already in this project: ${result.skipped.join(", ")}.` : ""}${result.warnings.length ? ` ${result.warnings.length} warning(s).` : ""}`,
    });
    commit(result.schema);
    selectTable(result.added[0]?.id ?? null);
    revealTables(result.added);
  };
  /**
   * The JSON half of the same two actions. A file carries the id and revision
   * of the project it was saved from, which address a different row on a
   * different server; the open project keeps its own.
   */
  const importJson = (text: string) => {
    const result = parseSchemaJson(text);
    if (!result.schema) {
      setImportMessage({ ok: false, text: result.errors.join(" ") });
      return;
    }
    setImportMessage({
      ok: true,
      text: `${result.schema.tables.length} table(s) imported.${result.warnings.length ? ` ${result.warnings.length} warning(s).` : ""}`,
    });
    commit({ ...result.schema, id: schema.id, revision: schema.revision });
    selectTable(result.schema.tables[0]?.id ?? null);
  };
  const appendJson = (text: string) => {
    const result = mergeSchemaJson(schema, text);
    if (!result.schema) {
      setImportMessage({ ok: false, text: result.errors.join(" ") });
      return;
    }
    setImportMessage({
      ok: true,
      text: `${result.added.length} table(s) added.${result.skipped.length ? ` Already in this project: ${result.skipped.join(", ")}.` : ""}${result.warnings.length ? ` ${result.warnings.length} warning(s).` : ""}`,
    });
    commit(result.schema);
    selectTable(result.added[0]?.id ?? null);
    revealTables(result.added);
  };
  const importMermaid = (text: string) => {
    const result = parseMermaidER(text);
    if (!result.schema) {
      setImportMessage({ ok: false, text: result.errors.join(" ") });
      return;
    }
    setImportMessage({
      ok: true,
      text: `${result.schema.tables.length} table(s) imported.${result.warnings.length ? ` ${result.warnings.length} warning(s).` : ""}`,
    });
    commit({ ...result.schema, id: schema.id, revision: schema.revision });
    selectTable(result.schema.tables[0]?.id ?? null);
  };
  const appendMermaid = (text: string) => {
    const result = appendMermaidER(schema, text);
    if (!result.schema) {
      setImportMessage({ ok: false, text: result.errors.join(" ") });
      return;
    }
    setImportMessage({
      ok: true,
      text: `${result.added.length} table(s) added.${result.skipped.length ? ` Already in this project: ${result.skipped.join(", ")}.` : ""}${result.warnings.length ? ` ${result.warnings.length} warning(s).` : ""}`,
    });
    commit(result.schema);
    selectTable(result.added[0]?.id ?? null);
    revealTables(result.added);
  };
  const clearInvalidForeignKeys = () => {
    const next = {
      ...schema,
      tables: schema.tables.map((table) => ({
        ...table,
        columns: table.columns.map((column) => {
          if (!column.fk) return column;
          const targetTable = schema.tables.find(
            (candidate) => candidate.id === column.fk?.tableId,
          );
          const targetColumn = targetTable?.columns.find(
            (candidate) => candidate.id === column.fk?.columnId,
          );
          const isValid =
            targetTable &&
            targetColumn &&
            primaryKeyColumns(targetTable).length <= 1 &&
            targetColumn.type === column.type;
          return isValid ? column : { ...column, fk: null };
        }),
      })),
    };
    commit(normalizeRelationships(next));
  };

  /**
   * One write at a time, newest snapshot wins, and each response's revision
   * seeds the next request — see `createSaveQueue` for why that last part is
   * what keeps consecutive saves from conflicting with themselves.
   *
   * Built once per project. Everything it needs that changes goes through a
   * ref, so the queue is never torn down mid-write.
   */
  const saveQueueRef = useRef<SaveQueue | null>(null);
  const revisionRef = useRef(schema.revision);
  revisionRef.current = schema.revision;
  const announceSaveRef = useRef<(result: SaveResult) => void>(() => {});
  if (!saveQueueRef.current)
    saveQueueRef.current = createSaveQueue({
      revision: () => revisionRef.current,
      onRevision: setRevision,
      onState: setSaveState,
      onResult: (result) => announceSaveRef.current(result),
      write: async (next, revision, overwrite) => {
        const query = new URLSearchParams();
        if (workspaceSlug) query.set("workspace", workspaceSlug);
        if (shareToken) query.set("shareToken", shareToken);
        const response = await fetch(
          `/api/projects/${projectId}${query.toString() ? `?${query}` : ""}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              schema: { ...next, revision },
              overwrite,
            }),
          },
        );
        if (response.ok) {
          const saved = (await response.json()) as Schema;
          return { status: "saved", revision: saved.revision };
        }
        if (response.status === 409) {
          // The body carries the record as it now stands, so the overwrite
          // that follows is sent against the revision that rejected us.
          const current = (await response.json().catch(() => null)) as {
            revision?: number;
          } | null;
          return {
            status: "conflict",
            revision: current?.revision ?? revision,
          };
        }
        return {
          status: "failed",
          message: "Project storage is unavailable.",
        };
      },
    });
  const saveQueue = saveQueueRef.current;

  /**
   * Saving to the project file. An autosave says nothing when it works (the
   * appbar badge already reports state), whereas manual saves toast on success.
   */
  const [explicitSave, setExplicitSave] = useState(false);
  announceSaveRef.current = (result) => {
    if (result.status === "saved") {
      setDirty(false);
      if (explicitSave || !relationSettings.autoSave) {
        toast.success("Project saved.");
      }
      setExplicitSave(false);
      return;
    }
    setExplicitSave(false);
    if (result.status === "conflict") {
      toast.error("This project changed elsewhere.", {
        description: "Saving now would overwrite the other changes.",
        duration: Infinity,
        action: { label: "Overwrite", onClick: () => void save(true) },
      });
      return;
    }
    toast.error(result.message);
  };

  const save = (overwrite = false) => {
    if (readOnly) return Promise.resolve();
    setExplicitSave(true);
    return saveQueue.flush(schemaRef.current, { overwrite });
  };

  /**
   * The autosave itself: when enabled in settings, every edit of this client's
   * re-arms the debounce, so a burst of typing writes once when it stops.
   * Gated on `dirty` and `relationSettings.autoSave`.
   */
  useEffect(() => {
    if (readOnly || !dirty || !relationSettings.autoSave) return;
    saveQueue.push(schema);
  }, [dirty, readOnly, relationSettings.autoSave, saveQueue, schema]);

  useEffect(() => () => saveQueue.cancel(), [saveQueue]);

  /**
   * When autosave is enabled: a tab closed mid-debounce flushes the edits.
   */
  useEffect(() => {
    if (readOnly || !relationSettings.autoSave) return;
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (saveQueue.state !== "pending") return;
      void saveQueue.flush(schemaRef.current);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [readOnly, relationSettings.autoSave, saveQueue]);

  /**
   * When autosave is disabled (default): warn before closing the tab or
   * navigating away if there are unsaved changes.
   */
  useEffect(() => {
    if (!dirty || readOnly || relationSettings.autoSave) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, readOnly, relationSettings.autoSave]);

  /**
   * Whatever the canvas selection currently is, remove it — in one commit, so
   * a swept-up cluster comes back on a single ⌘Z rather than one card at a time.
   */
  const pasteSelectionRef = useRef(pasteSelection);
  pasteSelectionRef.current = pasteSelection;
  const modalRef = useRef(modal);
  modalRef.current = modal;

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (readOnly || isEditingTarget(event.target) || modalRef.current) return;
      const text = event.clipboardData?.getData("text/plain")?.trim();
      // Only claim the event for something that looks like our envelope;
      // anything else belongs to whatever the user was really pasting into.
      if (!text || !text.startsWith("{")) return;
      event.preventDefault();
      pasteSelectionRef.current(text);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [readOnly]);

  /** Every command a chord can reach. Ids without an entry here stay inert. */
  const shortcutActions: Partial<Record<ShortcutId, () => void>> = {
    save: () => void save(),
    /*
     * Overwrite only once the server has already said there is a conflict and
     * the toast has reported it — pressing this then is the keyboard equivalent
     * of its Overwrite action. With nothing in contention it is a plain save,
     * so the chord can never discard a peer's work unannounced.
     */
    forceSave: () => void save(saveState === "conflict"),
    export: () => setModal("export"),
    import: () => setModal("import"),
    share: () => setModal("share"),
    undo,
    redo,
    addColumn: () => selected && addColumn(selected.id),
    addTable,
    addGroup,
    addMemo,
    junction: makeJunction,
    selectAll: () => setSelection(selectAll(schema)),
    copySelectionSql: () => copySelection("sql"),
    copySelectionJson: () => copySelection("json"),
    deleteSelection,
    zoomIn: () => zoomBy(0.1),
    zoomOut: () => zoomBy(-0.1),
    zoomReset: () => setZoom(1),
    fitView,
    toggleHand: () => setHandMode((on) => !on),
    tidyLayout: autoLayout,
    toggleSidebar: () => setSidebarOpen((open) => !open),
    shortcutsHelp: () => setModal("shortcuts"),
  };
  /** Menu items fire the same closures as the chords, so the two can never diverge. */
  const run = (id: ShortcutId) => () => shortcutActions[id]?.();
  const hint = (id: ShortcutId) => shortcutHint(id, isMac);

  /**
   * Escape closes the topmost layer; everything else resolves through the shortcut
   * table. The handler lives in a ref so the listener is bound once rather than
   * re-bound on every render, while still seeing the latest closure.
   */
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (event: KeyboardEvent) => {
    // `code`, not `key`, so the hold survives non-US layouts. preventDefault
    // stops both the page scroll and Space activating a focused dock button.
    if (event.code === "Space") {
      if (isEditingTarget(event.target) || modal || openMenu || userMenuOpen)
        return;
      event.preventDefault();
      if (!event.repeat) setSpaceHeld(true);
      return;
    }
    if (event.key === "Escape") {
      // Overlays dismiss themselves; Escape only clears canvas selection.
      if (modal || openMenu || userMenuOpen) return;
      setSelection(EMPTY_SELECTION);
      return;
    }
    const id = matchShortcut(event, isMac);
    const shortcut = id && shortcutById(id);
    if (!id || !shortcut) return;
    // An open layer owns the keyboard, apart from the help sheet itself.
    if ((modal || openMenu || userMenuOpen) && id !== "shortcutsHelp") return;
    if (shortcut.mutating && readOnly) return;
    const run = shortcutActions[id];
    if (!run) return;
    event.preventDefault();
    run();
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /**
   * The other half of the Space hold. `blur` matters as much as `keyup`: tabbing
   * away mid-hold means the keyup lands on another window, and without this the
   * canvas would come back stuck in hand mode.
   */
  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) =>
      event.code === "Space" && setSpaceHeld(false);
    const clear = () => setSpaceHeld(false);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
    };
  }, []);

  const relationships = useMemo(
    () =>
      (schema.relationships ?? []).flatMap((relationship) => {
        const from = schema.tables.find(
          (table) => table.id === relationship.startTableId,
        );
        const to = schema.tables.find(
          (table) => table.id === relationship.endTableId,
        );
        const pair = relationship.fields[0] ?? {
          startFieldId: relationship.startFieldId,
          endFieldId: relationship.endFieldId,
        };
        const fromIndex =
          from?.columns.findIndex(
            (column) => column.id === pair.startFieldId,
          ) ?? -1;
        const toIndex =
          to?.columns.findIndex((column) => column.id === pair.endFieldId) ??
          -1;
        return from && to && fromIndex >= 0 && toIndex >= 0
          ? [
              {
                relationship,
                from,
                fromIndex,
                to,
                toIndex,
                id: relationship.id,
              },
            ]
          : [];
      }),
    [schema],
  );
  /** Tallied once instead of filtering the whole list per table card. */
  const relationshipCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
    relationships.forEach((item) => {
      bump(item.from.id);
      if (item.to.id !== item.from.id) bump(item.to.id);
    });
    return counts;
  }, [relationships]);

  const patchRelationship = (id: string, patch: Partial<Relationship>) => {
    if (readOnly) return;
    commit(
      normalizeRelationships({
        ...schema,
        relationships: (schema.relationships ?? []).map((relationship) =>
          relationship.id === id ? { ...relationship, ...patch } : relationship,
        ),
      }),
    );
  };

  const deleteRelationship = (id: string) => {
    if (readOnly) return;
    commit(
      normalizeRelationships({
        ...schema,
        relationships: (schema.relationships ?? []).filter(
          (relationship) => relationship.id !== id,
        ),
      }),
    );
    if (openRelationshipId === id) setOpenRelationshipId(null);
  };

  const swapRelationship = (relationship: Relationship) => {
    patchRelationship(relationship.id, {
      startTableId: relationship.endTableId,
      startFieldId: relationship.endFieldId,
      endTableId: relationship.startTableId,
      endFieldId: relationship.startFieldId,
      fields: relationship.fields.map((pair) => ({
        startFieldId: pair.endFieldId,
        endFieldId: pair.startFieldId,
      })),
      name: `fk_${schema.tables.find((table) => table.id === relationship.endTableId)?.name ?? "table"}_${schema.tables.find((table) => table.id === relationship.endTableId)?.columns.find((column) => column.id === relationship.endFieldId)?.name ?? "field"}_${schema.tables.find((table) => table.id === relationship.startTableId)?.name ?? "table"}`,
    });
  };

  const relationshipRows = useMemo(
    () =>
      relationships.map((relationship) => {
        const column = relationship.from.columns[relationship.fromIndex];
        const target = relationship.to.columns[relationship.toIndex];
        return {
          id: relationship.id,
          from: `${relationship.from.name.toUpperCase()}.${column.name.toUpperCase()}`,
          to: `${relationship.to.name.toUpperCase()}.${target.name.toUpperCase()}`,
          cardinality: relationshipCardinalities(
            relationship.relationship,
          ).join(":"),
          fromId: relationship.from.id,
          name: relationship.relationship.name,
          relationship: relationship.relationship,
          // Already resolved here; the row body used to look both up again on
          // every render of the sidebar, which is every drag frame.
          startTable: relationship.from,
          endTable: relationship.to,
        };
      }),
    [relationships],
  );

  const fileMenu: MenuItem[] = [
    {
      label: "New diagram",
      onSelect: async () => {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(workspaceSlug ? { workspace: workspaceSlug } : {}),
            name: "Untitled Diagram",
          }),
        });
        if (response.ok) {
          const created = (await response.json()) as Schema;
          router.push(
            workspaceSlug
              ? `/${workspaceSlug}/${created.id}`
              : `/project/${created.id}`,
          );
        } else toast.error("Could not create project.");
      },
    },
    { separator: true },
    { label: "Import…", onSelect: run("import"), hint: hint("import") },
    { label: "Export…", onSelect: run("export"), hint: hint("export") },
    { separator: true },
    { label: "Save to database", onSelect: run("save"), hint: hint("save") },
    {
      label: "Force save",
      onSelect: run("forceSave"),
      // Only ever different from Save while a conflict is outstanding, so it
      // stays out of the way until it has something to offer.
      disabled: saveState !== "conflict",
      hint: hint("forceSave"),
    },
  ];
  const editMenu: MenuItem[] = [
    {
      label: "Undo",
      onSelect: run("undo"),
      disabled: !canUndo,
      hint: hint("undo"),
    },
    {
      label: "Redo",
      onSelect: run("redo"),
      disabled: !canRedo,
      hint: hint("redo"),
    },
    { separator: true },
    { label: "Add table", onSelect: run("addTable"), hint: hint("addTable") },
    {
      label: "Add schema group",
      onSelect: run("addGroup"),
      hint: hint("addGroup"),
    },
    { label: "Add memo", onSelect: run("addMemo"), hint: hint("addMemo") },
    {
      label: "Add junction table",
      onSelect: run("junction"),
      disabled: !selected,
      hint: hint("junction"),
    },
    { separator: true },
    {
      label: "Delete selection",
      onSelect: run("deleteSelection"),
      disabled: !selectedId && !selectedGroupId && !selectedMemoId,
      hint: hint("deleteSelection"),
    },
  ];
  const viewMenu: MenuItem[] = [
    { label: "Zoom in", onSelect: run("zoomIn"), hint: hint("zoomIn") },
    { label: "Zoom out", onSelect: run("zoomOut"), hint: hint("zoomOut") },
    {
      label: "Reset zoom",
      onSelect: run("zoomReset"),
      hint: hint("zoomReset"),
    },
    { label: "Fit to screen", onSelect: run("fitView"), hint: hint("fitView") },
    { separator: true },
    {
      label: "Tidy up layout",
      onSelect: run("tidyLayout"),
      hint: hint("tidyLayout"),
    },
    {
      label: sidebarOpen ? "Hide side panel" : "Show side panel",
      onSelect: run("toggleSidebar"),
      hint: hint("toggleSidebar"),
    },
  ];
  const settingsMenu: MenuItem[] = [
    {
      label: `${relationSettings.showCardinality ? "Hide" : "Show"} cardinality`,
      onSelect: () =>
        setRelationSettings((current) => ({
          ...current,
          showCardinality: !current.showCardinality,
        })),
    },
    {
      label: `${relationSettings.showRelationshipLabels ? "Hide" : "Show"} relationship labels`,
      onSelect: () =>
        setRelationSettings((current) => ({
          ...current,
          showRelationshipLabels: !current.showRelationshipLabels,
        })),
    },
    {
      label: `${relationSettings.dimUnrelated ? "Turn off" : "Turn on"} focus dimming`,
      onSelect: () =>
        setRelationSettings((current) => ({
          ...current,
          dimUnrelated: !current.dimUnrelated,
        })),
    },
    {
      label: `${relationSettings.autoSave ? "Turn off" : "Turn on"} auto-save`,
      onSelect: () =>
        setRelationSettings((current) => {
          const next = !current.autoSave;
          toast.success(
            next ? "Auto-save turned on." : "Auto-save turned off.",
          );
          return { ...current, autoSave: next };
        }),
    },
    { separator: true },
    { label: "Clear invalid references", onSelect: clearInvalidForeignKeys },
  ];
  const helpMenu: MenuItem[] = [
    {
      label: "Keyboard shortcuts",
      onSelect: run("shortcutsHelp"),
      hint: hint("shortcutsHelp"),
    },
    { separator: true },
    {
      label: "Oracle target: 12.2+",
      onSelect: () =>
        toast.success("Generating DDL for Oracle 12.2 and later."),
    },
  ];

  const tableEntity = (table: Table) => (
    <Collapsible
      className={`entity ${selectedId === table.id ? "open" : ""}`}
      key={table.id}
      isExpanded={selectedId === table.id}
      onExpandedChange={(expanded) => selectTable(expanded ? table.id : null)}
    >
      <CollapsibleTrigger className="entity-head">
        <span
          className="entity-swatch"
          style={{ background: table.color.a }}
          aria-hidden="true"
        />
        <span className="entity-copy">
          <strong>{table.name.toUpperCase()}</strong>
          <small>{table.columns.length} columns</small>
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="entity-chevron"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {selectedId === table.id ? (
          <div className="entity-body">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor={`name-${table.id}`}>Table name</FieldLabel>
                <Input
                  id={`name-${table.id}`}
                  value={table.name}
                  onChange={(event) =>
                    patchTable(table.id, { name: event.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Key generation</FieldLabel>
                <Select
                  className="w-full"
                  aria-label="Key generation"
                  selectedKey={table.keyStrategy}
                  onSelectionChange={(key) =>
                    patchTable(table.id, { keyStrategy: key as KeyStrategy })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem id="sequence-trigger">
                        Sequence + trigger
                      </SelectItem>
                      <SelectItem id="identity">Generated identity</SelectItem>
                      <SelectItem id="none">Manual / none</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Schema group</FieldLabel>
                <Select
                  className="w-full"
                  aria-label="Schema group"
                  isDisabled={readOnly}
                  selectedKey={table.schemaId ?? NO_GROUP}
                  onSelectionChange={(key) =>
                    assignTableToGroup(
                      table.id,
                      key === NO_GROUP ? "" : String(key),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem id={NO_GROUP}>Ungrouped</SelectItem>
                      {(schema.groups ?? []).map((group) => (
                        <SelectItem key={group.id} id={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`comment-${table.id}`}>
                  Table comment
                </FieldLabel>
                <Input
                  id={`comment-${table.id}`}
                  placeholder="COMMENT ON TABLE"
                  value={table.comment ?? ""}
                  onChange={(event) =>
                    patchTable(table.id, { comment: event.target.value })
                  }
                />
              </Field>
            </FieldGroup>
            {primaryKeyColumns(table).length > 1 && (
              <p className="hint">
                Composite primary key — manual key generation required.
              </p>
            )}

            <ColumnList
              table={table}
              readOnly={readOnly}
              patchColumn={patchColumn}
              deleteColumn={deleteColumn}
              reorderColumns={reorderColumns}
              compatibleForeignKeyTargets={compatibleForeignKeyTargets}
            />

            <UniqueConstraints
              table={table}
              readOnly={readOnly}
              addUnique={addUnique}
              patchUnique={patchUnique}
              deleteUnique={deleteUnique}
            />

            <div className="flex gap-2 flex-col">
              <ButtonGroup className="w-full">
                <Button
                  variant="outline"
                  onClick={() => addColumn(table.id)}
                  className="w-full"
                >
                  <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
                  Add column
                </Button>
              </ButtonGroup>

              <ButtonGroup className="w-full">
                <Button
                  variant="outline"
                  onClick={() => makeJunction(table.id)}
                >
                  <HugeiconsIcon icon={Link01Icon} data-icon="inline-start" />
                  Junction
                </Button>
                <Button variant="outline" onClick={() => deleteTable(table.id)}>
                  <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
                  Delete
                </Button>
              </ButtonGroup>
            </div>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );

  const menus: Array<{ name: string; items: MenuItem[] }> = [
    { name: "File", items: fileMenu },
    { name: "Edit", items: editMenu },
    { name: "View", items: viewMenu },
    { name: "Settings", items: settingsMenu },
    { name: "Help", items: helpMenu },
  ];

  const relationshipEntity = (row: RelationshipRow) => {
    const relationship = row.relationship;
    const { startTable, endTable } = row;
    const pairs = relationship.fields.length
      ? relationship.fields
      : [
          {
            startFieldId: relationship.startFieldId,
            endFieldId: relationship.endFieldId,
          },
        ];
    return (
      <Collapsible
        className={`relationship-editor ${openRelationshipId === relationship.id ? "open" : ""}`}
        key={relationship.id}
        isExpanded={openRelationshipId === relationship.id}
        onExpandedChange={(expanded) =>
          setOpenRelationshipId(expanded ? relationship.id : null)
        }
      >
        <CollapsibleTrigger className="relationship-row relationship-editor-head">
          <HugeiconsIcon icon={Link01Icon} aria-hidden="true" />
          <span className="relationship-copy">
            <strong>{relationship.name}</strong>
            <small>
              {row.from} → {row.to} · {row.cardinality}
            </small>
          </span>
          <HugeiconsIcon icon={ArrowDown01Icon} className="entity-chevron" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {openRelationshipId === relationship.id ? (
            <div className="relationship-editor-body">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor={`rel-name-${relationship.id}`}>
                    Name
                  </FieldLabel>
                  <Input
                    id={`rel-name-${relationship.id}`}
                    value={relationship.name}
                    disabled={readOnly}
                    onChange={(event) =>
                      patchRelationship(relationship.id, {
                        name: event.target.value,
                      })
                    }
                  />
                </Field>
                <div className="relationship-endpoints">
                  <span>
                    <b>Foreign</b>
                    {startTable?.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Swap relationship endpoints"
                    isDisabled={readOnly}
                    onClick={() => swapRelationship(relationship)}
                  >
                    <HugeiconsIcon icon={Link01Icon} />
                  </Button>
                  <span>
                    <b>Primary</b>
                    {endTable?.name}
                  </span>
                </div>
                <Field>
                  <FieldLabel>Cardinality</FieldLabel>
                  <Select
                    className="w-full"
                    aria-label="Cardinality"
                    isDisabled={readOnly}
                    selectedKey={relationship.cardinality}
                    onSelectionChange={(key) =>
                      patchRelationship(relationship.id, {
                        cardinality: key as Cardinality,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem id="one_to_one">One to one</SelectItem>
                        <SelectItem id="one_to_many">One to many</SelectItem>
                        <SelectItem id="many_to_one">Many to one</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {relationship.cardinality !== "one_to_one" && (
                  <Field>
                    <FieldLabel htmlFor={`rel-many-${relationship.id}`}>
                      Many-side label
                    </FieldLabel>
                    <Input
                      id={`rel-many-${relationship.id}`}
                      value={relationship.manyLabel}
                      disabled={readOnly}
                      onChange={(event) =>
                        patchRelationship(relationship.id, {
                          manyLabel: event.target.value,
                        })
                      }
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel>On update</FieldLabel>
                  <Select
                    className="w-full"
                    aria-label="On update"
                    isDisabled={readOnly}
                    selectedKey={relationship.updateConstraint}
                    onSelectionChange={(key) =>
                      patchRelationship(relationship.id, {
                        updateConstraint:
                          key as Relationship["updateConstraint"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {RELATIONSHIP_CONSTRAINTS.map((constraint) => (
                          <SelectItem key={constraint} id={constraint}>
                            {constraint}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>On delete</FieldLabel>
                  <Select
                    className="w-full"
                    aria-label="On delete"
                    isDisabled={readOnly}
                    selectedKey={relationship.deleteConstraint}
                    onSelectionChange={(key) =>
                      patchRelationship(relationship.id, {
                        deleteConstraint:
                          key as Relationship["deleteConstraint"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {RELATIONSHIP_CONSTRAINTS.map((constraint) => (
                          <SelectItem key={constraint} id={constraint}>
                            {constraint}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <FieldSet className="relationship-pairs">
                <FieldLegend variant="label">Composite key</FieldLegend>
                {pairs.map((pair, index) => (
                  <div
                    className="relationship-pair"
                    key={`${pair.startFieldId}-${pair.endFieldId}-${index}`}
                  >
                    <Select
                      className="w-full"
                      aria-label="Foreign-side column"
                      isDisabled={readOnly}
                      selectedKey={pair.startFieldId}
                      onSelectionChange={(key) =>
                        patchRelationship(relationship.id, {
                          fields: pairs.map((item, pairIndex) =>
                            pairIndex === index
                              ? {
                                  ...item,
                                  startFieldId: String(key),
                                }
                              : item,
                          ),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {startTable?.columns.map((column) => (
                            <SelectItem key={column.id} id={column.id}>
                              {column.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Select
                      className="w-full"
                      aria-label="Primary-side column"
                      isDisabled={readOnly}
                      selectedKey={pair.endFieldId}
                      onSelectionChange={(key) =>
                        patchRelationship(relationship.id, {
                          fields: pairs.map((item, pairIndex) =>
                            pairIndex === index
                              ? {
                                  ...item,
                                  endFieldId: String(key),
                                }
                              : item,
                          ),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {endTable?.columns.map((column) => (
                            <SelectItem key={column.id} id={column.id}>
                              {column.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {pairs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove relationship field pair"
                        isDisabled={readOnly}
                        onClick={() =>
                          patchRelationship(relationship.id, {
                            fields: pairs.filter(
                              (_, pairIndex) => pairIndex !== index,
                            ),
                          })
                        }
                      >
                        <HugeiconsIcon icon={Delete02Icon} />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="self-start"
                  isDisabled={
                    readOnly ||
                    pairs.length >=
                      Math.min(
                        startTable?.columns.length ?? 0,
                        endTable?.columns.length ?? 0,
                      )
                  }
                  onClick={() => {
                    const start = startTable?.columns.find(
                      (column) =>
                        !pairs.some((pair) => pair.startFieldId === column.id),
                    );
                    const end = endTable?.columns.find(
                      (column) =>
                        !pairs.some((pair) => pair.endFieldId === column.id),
                    );
                    if (start && end)
                      patchRelationship(relationship.id, {
                        fields: [
                          ...pairs,
                          {
                            startFieldId: start.id,
                            endFieldId: end.id,
                          },
                        ],
                      });
                  }}
                >
                  <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />{" "}
                  Add field
                </Button>
              </FieldSet>
              <Button
                variant="outline"
                className="relationship-delete"
                isDisabled={readOnly}
                onClick={() => deleteRelationship(relationship.id)}
              >
                <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />{" "}
                Delete relationship
              </Button>
            </div>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className={`app ${readOnly ? "share-read-only" : ""}`}>
      <ControlPanel
        menus={menus}
        save={save}
        workspaceSlug={workspaceSlug}
        readOnly={readOnly}
        user={user}
      />

      <SidebarProvider
        className={`body min-h-0 flex-1 ${isResizingSidebar ? "is-resizing" : ""}`}
        style={
          { "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties
        }
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      >
        <SidePanel
          relationshipCount={relationshipRows.length}
          tablesTab={
            <TablesTab
              tables={schema.tables}
              filteredTables={filteredTables}
              sections={tableSections}
              hasGroups={Boolean((schema.groups ?? []).length)}
              onAddTable={() => addTable()}
              renderTable={tableEntity}
            />
          }
          relationshipsTab={
            <RelationshipsTab
              rows={relationshipRows}
              renderRow={relationshipEntity}
            />
          }
        />

        {!sidebarOpen && (
          <SidebarTrigger className="panel-reveal" aria-label="Show side panel">
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </SidebarTrigger>
        )}

        <CanvasHost
          readOnly={readOnly}
          save={save}
          relationships={relationships}
          relationshipCounts={relationshipCounts}
          runShortcut={(id: ShortcutId) => shortcutActions[id]?.()}
        />
      </SidebarProvider>

      <Modals
        projectId={projectId}
        workspaceSlug={workspaceSlug}
        workspaceId={workspaceId}
        readOnly={readOnly}
        importMessage={importMessage}
        onImportMessage={setImportMessage}
        onReplace={(text, format) => {
          if (format === "json") importJson(text);
          else if (format === "mermaid") importMermaid(text);
          else importSchema(text);
        }}
        onAppend={(text, format) => {
          if (format === "json") appendJson(text);
          else if (format === "mermaid") appendMermaid(text);
          else appendSchema(text);
        }}
        onClearInvalidForeignKeys={clearInvalidForeignKeys}
      />
    </div>
  );
}
