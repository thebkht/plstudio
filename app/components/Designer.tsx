"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Download,
  FileUp,
  KeyRound,
  LayoutGrid,
  Link2,
  Maximize2,
  Plus,
  Redo2,
  Save,
  Search,
  Share2,
  StickyNote,
  TablePropertiesIcon as TablePlus,
  Trash2,
  Undo2,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { exportSchema, generateDDL, generatePLSQL } from "@/app/lib/generators";
import { parseCreateTable } from "@/app/lib/parser";
import { typeColorVar } from "@/app/lib/datatype-color";
import {
  Spring,
  VelocityTracker,
  project,
  rubberClamp,
  runFrameLoop,
  type Vec,
} from "@/app/lib/motion";
import {
  cloneSchema,
  GROUP_PALETTE,
  makeColumn,
  makeMemo,
  makeSchemaGroup,
  makeTable,
  normalizeMemos,
  normalizeGroups,
  normalizeRelationships,
  nextId,
  RELATIONSHIP_CONSTRAINTS,
  ORACLE_TYPES,
  primaryKeyColumns,
  tableHeight,
  typeSizePlaceholder,
  typeUsesSize,
  TABLE_WIDTH,
  TABLE_COLOR_STRIP_HEIGHT,
  TABLE_HEADER_HEIGHT,
  TABLE_FIELD_HEIGHT,
  type Schema,
  type Table,
  type Column,
  type KeyStrategy,
  type Memo,
  type MemoColor,
  type SchemaGroup,
  type Relationship,
  type Cardinality,
} from "@/app/lib/schema";
import { validateSchema } from "@/app/lib/validation";
import { authClient } from "@/app/lib/auth-client";
import BrandMark from "@/app/components/BrandMark";

/** Header offset for row anchors: the colour strip sits above the title bar. */
const HEADER_HEIGHT = TABLE_COLOR_STRIP_HEIGHT + TABLE_HEADER_HEIGHT;
const ROW_HEIGHT = TABLE_FIELD_HEIGHT;
const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 1800;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.8;
/** Movement before a press is treated as a drag rather than a tap. */
const DRAG_THRESHOLD = 4;
/** Arrow-key nudge for keyboard positioning. */
const NUDGE = 8;
const MEMO_MIN_WIDTH = 180;
const MEMO_MIN_HEIGHT = 100;
const MEMO_MAX_WIDTH = 560;
const MEMO_MAX_HEIGHT = 520;
const GROUP_MIN_WIDTH = 360;
const GROUP_MIN_HEIGHT = 260;
const GROUP_HEADER_HEIGHT = 42;
const MEMO_COLORS: { id: MemoColor; label: string; background: string; border: string }[] = [
  { id: "yellow", label: "Yellow", background: "#fff7bf", border: "#6b58f5" },
  { id: "blue", label: "Blue", background: "#dff3ff", border: "#287da8" },
  { id: "green", label: "Green", background: "#e8f7d7", border: "#72b92d" },
  { id: "pink", label: "Pink", background: "#ffe4e9", border: "#d85d78" },
];

function repairInitialLayout(schema: Schema): Schema {
  const next = cloneSchema(schema);
  const gap = 24;
  const overlaps = (table: Table, x: number, y: number) => next.tables.some((other) => {
    if (other.id === table.id) return false;
    return x < other.x + TABLE_WIDTH + gap && x + TABLE_WIDTH + gap > other.x && y < other.y + tableHeight(other) + gap && y + tableHeight(table) + gap > other.y;
  });
  next.tables.forEach((table, index) => {
    if (index === 0 || !overlaps(table, table.x, table.y)) return;
    const startX = table.x;
    const startY = table.y;
    for (let ring = 1; ring <= 24; ring += 1) {
      const step = 48 * ring;
      const candidates = [
        { x: startX + step, y: startY }, { x: startX - step, y: startY },
        { x: startX, y: startY + step }, { x: startX, y: startY - step },
        { x: startX + step, y: startY + step }, { x: startX - step, y: startY + step },
        { x: startX + step, y: startY - step }, { x: startX - step, y: startY - step },
      ];
      const free = candidates.find((candidate) => candidate.x >= 0 && candidate.y >= 0 && candidate.x <= CANVAS_WIDTH - TABLE_WIDTH && candidate.y <= CANVAS_HEIGHT - tableHeight(table) && !overlaps(table, candidate.x, candidate.y));
      if (free) { table.x = free.x; table.y = free.y; break; }
    }
  });
  return next;
}

function prepareCanvasSchema(schema: Schema): Schema {
  const next = repairInitialLayout(normalizeGroups(normalizeRelationships(schema)));
  next.memos = normalizeMemos(next.memos);
  return next;
}

/** Momentum handoff wants a little overshoot; everything else settles flat. */
const FLICK_SPRING = { damping: 0.82, response: 0.42 };
const SETTLE_SPRING = { damping: 1, response: 0.34 };

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

const SQL_TOKEN =
  /(--[^\n]*|'(?:''|[^'])*'|\b\d+(?:\.\d+)?\b|\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|SEQUENCE|TRIGGER|OR|REPLACE|BEFORE|AFTER|INSERTING|UPDATING|DELETING|ON|FOR|EACH|ROW|BEGIN|END|IF|THEN|ELSE|NULL|NOT|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|UNIQUE|CHECK|DEFAULT|AS|IS|AND|OR|NUMBER|VARCHAR2|CHAR|DATE|TIMESTAMP|CLOB|BLOB|RAW|IDENTITY|GENERATED|ALWAYS|BY|COMMIT|RETURNING|PACKAGE|BODY|FUNCTION|PROCEDURE|OPEN|CURSOR|VALUES)\b)/gi;

function highlightSql(source: string): ReactNode[] {
  const pieces: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  SQL_TOKEN.lastIndex = 0;
  while ((match = SQL_TOKEN.exec(source))) {
    if (match.index > cursor) pieces.push(source.slice(cursor, match.index));
    const token = match[0];
    const kind = token.startsWith("--")
      ? "comment"
      : token.startsWith("'")
        ? "string"
        : /^\d/.test(token)
          ? "number"
          : "keyword";
    pieces.push(
      <span className={`sql-token ${kind}`} key={`${match.index}-${token}`}>
        {token}
      </span>,
    );
    cursor = match.index + token.length;
  }
  if (cursor < source.length) pieces.push(source.slice(cursor));
  return pieces;
}

type MenuItem =
  | { label: string; onSelect: () => void; disabled?: boolean; hint?: string }
  | { separator: true };

/** A menubar menu. Opens on click, closes on select, Escape, or outside press. */
function Menu({
  name,
  items,
  open,
  anyOpen,
  onOpenChange,
}: {
  name: string;
  items: MenuItem[];
  open: boolean;
  /** Once one menu is open, hovering the others switches between them. */
  anyOpen: boolean;
  onOpenChange: (name: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onOpenChange(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(null);
    };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", escape);
    };
  }, [open, onOpenChange]);

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className={`menu-trigger ${open ? "open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(open ? null : name)}
        onPointerEnter={() => anyOpen && onOpenChange(name)}
      >
        {name}
      </button>
      {open && (
        <div className="menu-popup" role="menu">
          {items.map((item, index) =>
            "separator" in item ? (
              <div
                className="menu-separator"
                key={`sep-${index}`}
                role="none"
              />
            ) : (
              <button
                type="button"
                role="menuitem"
                className="menu-item"
                key={item.label}
                disabled={item.disabled}
                onClick={() => {
                  onOpenChange(null);
                  item.onSelect();
                }}
              >
                <span>{item.label}</span>
                {item.hint && <kbd>{item.hint}</kbd>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default function Designer({
  initialSchema,
  projectId,
  workspaceSlug,
  workspaceId,
  shareToken,
  readOnly = false,
}: {
  initialSchema: Schema;
  projectId: string;
  workspaceSlug?: string;
  workspaceId?: string;
  shareToken?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [schema, setSchema] = useState<Schema>(() => prepareCanvasSchema(initialSchema));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [history, setHistory] = useState<Schema[]>([]);
  const [future, setFuture] = useState<Schema[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  /** Live position of the table under the pointer; schema is written once on release. */
  const [dragPosition, setDragPosition] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [dragMemoPosition, setDragMemoPosition] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resizeMemo, setResizeMemo] = useState<{ id: string; width: number; height: number } | null>(null);
  const [dragGroupPosition, setDragGroupPosition] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resizeGroup, setResizeGroup] = useState<{ id: string; width: number; height: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [toast, setToast] = useState<{
    text: string;
    tone: "ok" | "error";
  } | null>(null);
  const [modal, setModal] = useState<"export" | "import" | "share" | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [workspaceInviteLink, setWorkspaceInviteLink] = useState("");
  const [workspaceInviteBusy, setWorkspaceInviteBusy] = useState(false);
  const [exportTab, setExportTab] = useState<"ddl" | "plsql" | "combined">(
    "ddl",
  );
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<"tables" | "relationships">(
    "tables",
  );
  const [panelMode, setPanelMode] = useState<"structure" | "code">("structure");
  const [relationshipQuery, setRelationshipQuery] = useState("");
  const [openRelationshipId, setOpenRelationshipId] = useState<string | null>(null);
  const [relationSettings, setRelationSettings] = useState({ showCardinality: true, showRelationshipLabels: true });
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [linking, setLinking] = useState<{
    pointerId: number;
    sourceTableId: string;
    sourceColumnId: string;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const [dirty, setDirty] = useState(false);
  const lastSavedNameRef = useRef(initialSchema.name);
  useEffect(() => {
    const repaired = prepareCanvasSchema(initialSchema);
    const changed = repaired.tables.some((table, index) => table.x !== initialSchema.tables[index]?.x || table.y !== initialSchema.tables[index]?.y);
    if (changed) {
      setSchema(repaired);
      setDirty(true);
      setToast({ text: "Overlapping tables were separated.", tone: "ok" });
    }
  }, [initialSchema]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const importHighlightRef = useRef<HTMLPreElement>(null);
  /**
   * Gesture state lives in refs, not state: it updates every pointermove and
   * must not schedule a React render per frame.
   */
  const gestureRef = useRef<{
    mode: "table" | "memo" | "memo-resize" | "group" | "group-resize" | "pan";
    pointerId: number;
    tableId?: string;
    groupId?: string;
    memoId?: string;
    grabX: number;
    grabY: number;
    originX: number;
    originY: number;
    originWidth?: number;
    originHeight?: number;
    startX: number;
    startY: number;
    moved: boolean;
    tracker: VelocityTracker;
  } | null>(null);
  const springsRef = useRef<{ x: Spring; y: Spring } | null>(null);
  const stopAnimationRef = useRef<(() => void) | null>(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const schemaRef = useRef(schema);
  const dragPositionRef = useRef(dragPosition);
  panRef.current = pan;
  zoomRef.current = zoom;
  schemaRef.current = schema;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("drawsql-settings");
      if (saved) setRelationSettings((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch { /* Ignore malformed local settings. */ }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("drawsql-settings", JSON.stringify(relationSettings));
  }, [relationSettings]);
  dragPositionRef.current = dragPosition;

  /** A table's on-screen position: the in-flight one while it moves, else its committed one. */
  const livePosition = useCallback(
    (table: Table) =>
      dragPosition && dragPosition.id === table.id
        ? { x: dragPosition.x, y: dragPosition.y }
        : { x: table.x, y: table.y },
    [dragPosition],
  );
  const liveMemo = useCallback(
    (memo: Memo) => {
      const position = dragMemoPosition?.id === memo.id ? dragMemoPosition : memo;
      const size = resizeMemo?.id === memo.id ? resizeMemo : memo;
      return { x: position.x, y: position.y, width: size.width, height: size.height };
    },
    [dragMemoPosition, resizeMemo],
  );
  const liveGroup = useCallback(
    (group: SchemaGroup) => {
      const position = dragGroupPosition?.id === group.id ? dragGroupPosition : group;
      const size = resizeGroup?.id === group.id ? resizeGroup : group;
      return { x: position.x, y: position.y, width: size.width, height: size.height };
    },
    [dragGroupPosition, resizeGroup],
  );
  const canvasPoint = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (event.clientX - rect.left - pan.x) / zoom,
        y: (event.clientY - rect.top - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom],
  );
  const rowPoint = useCallback(
    (table: Table, columnIndex: number) => {
      const position = livePosition(table);
      return {
        x: position.x,
        y:
          position.y +
          HEADER_HEIGHT +
          columnIndex * ROW_HEIGHT +
          ROW_HEIGHT / 2,
      };
    },
    [livePosition],
  );
  const startLinking = (
    event: ReactPointerEvent,
    table: Table,
    column: Column,
    columnIndex: number,
  ) => {
    event.stopPropagation();
    const point = rowPoint(table, columnIndex);
    setLinking({
      pointerId: event.pointerId,
      sourceTableId: table.id,
      sourceColumnId: column.id,
      startX: point.x,
      startY: point.y,
      x: point.x,
      y: point.y,
    });
  };
  const finishLinking = (event: ReactPointerEvent) => {
    if (!linking || linking.pointerId !== event.pointerId) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-table-id][data-column-id]");
    const targetTableId = target?.dataset.tableId;
    const targetColumnId = target?.dataset.columnId;
    if (
      targetTableId &&
      targetColumnId &&
      !(
        targetTableId === linking.sourceTableId &&
        targetColumnId === linking.sourceColumnId
      )
    ) {
      const sourceTable = schema.tables.find(
        (table) => table.id === linking.sourceTableId,
      );
      const sourceColumn = sourceTable?.columns.find(
        (column) => column.id === linking.sourceColumnId,
      );
      const targetTable = schema.tables.find(
        (table) => table.id === targetTableId,
      );
      const targetColumn = targetTable?.columns.find(
        (column) => column.id === targetColumnId,
      );
      if (
        sourceTable &&
        sourceColumn &&
        targetTable &&
        targetColumn &&
        sourceColumn.type === targetColumn.type
      ) {
        const child = sourceColumn.pk
          ? { table: targetTable, column: targetColumn }
          : { table: sourceTable, column: sourceColumn };
        const parent = sourceColumn.pk
          ? { table: sourceTable, column: sourceColumn }
          : { table: targetTable, column: targetColumn };
        if (!child.column.pk && parent.column.pk) {
          const relationship: Relationship = {
            id: nextId("rel"),
            startTableId: child.table.id,
            startFieldId: child.column.id,
            endTableId: parent.table.id,
            endFieldId: parent.column.id,
            fields: [{ startFieldId: child.column.id, endFieldId: parent.column.id }],
            name: `fk_${child.table.name}_${child.column.name}_${parent.table.name}`,
            cardinality: "many_to_one",
            manyLabel: "n",
            updateConstraint: "No action",
            deleteConstraint: "No action",
          };
          commit(normalizeRelationships({ ...schema, relationships: [...(schema.relationships ?? []), relationship] }));
          setPanelTab("relationships");
          setToast({
            text: `Linked ${child.table.name}.${child.column.name} to ${parent.table.name}.${parent.column.name}.`,
            tone: "ok",
          });
        }
      }
    }
    setLinking(null);
  };
  const selected =
    schema.tables.find((table) => table.id === selectedId) ?? null;
  const filteredTables = useMemo(() => {
    const query = tableQuery.trim().toUpperCase();
    return query
      ? schema.tables.filter((table) =>
          table.name.toUpperCase().includes(query),
        )
      : schema.tables;
  }, [schema.tables, tableQuery]);
  const compatibleForeignKeyTargets = (column: Column) =>
    schema.tables
      .filter(
        (table) =>
          table.id !== selectedId && primaryKeyColumns(table).length <= 1,
      )
      .flatMap((table) =>
        table.columns
          .filter(
            (target) =>
              target.type === column.type || target.id === column.fk?.columnId,
          )
          .map((target) => ({ table, target })),
      );
  const issues = useMemo(() => validateSchema(schema), [schema]);
  const errors = issues.filter((issue) => issue.severity === "error");
  const ddl = useMemo(() => generateDDL(schema), [schema]);
  const plsql = useMemo(() => generatePLSQL(schema), [schema]);
  const combined = useMemo(() => exportSchema(schema), [schema]);
  const output =
    exportTab === "ddl" ? ddl : exportTab === "plsql" ? plsql : combined;

  const commit = useCallback(
    (next: Schema) => {
      if (readOnly) return;
      setHistory((items) => [...items.slice(-49), cloneSchema(schema)]);
      setFuture([]);
      setSchema({ ...next, revision: schema.revision });
      setDirty(true);
    },
    [readOnly, schema],
  );

  const patchTable = useCallback(
    (id: string, patch: Partial<Table>) =>
      commit({
        ...schema,
        tables: schema.tables.map((table) =>
          table.id === id ? { ...table, ...patch } : table,
        ),
      }),
    [commit, schema],
  );
  const patchColumn = useCallback(
    (tableId: string, columnId: string, patch: Partial<Column>) => {
      const next = {
        ...schema,
        tables: schema.tables.map((table) =>
          table.id === tableId
            ? {
                ...table,
                columns: table.columns.map((column) =>
                  column.id === columnId ? { ...column, ...patch } : column,
              ),
            }
            : table,
        ),
      };
      if ("fk" in patch) {
        const relationships = (schema.relationships ?? []).filter((relationship) =>
          !relationship.fields.some((pair) => relationship.startTableId === tableId && pair.startFieldId === columnId),
        );
        const fk = patch.fk;
        if (fk) {
          const table = schema.tables.find((item) => item.id === tableId);
          const column = table?.columns.find((item) => item.id === columnId);
          const target = schema.tables.find((item) => item.id === fk.tableId);
          const targetColumn = target?.columns.find((item) => item.id === fk.columnId);
          if (table && column && target && targetColumn) relationships.push({
            id: nextId("rel"),
            startTableId: table.id,
            startFieldId: column.id,
            endTableId: target.id,
            endFieldId: targetColumn.id,
            fields: [{ startFieldId: column.id, endFieldId: targetColumn.id }],
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

  const deleteTable = (id: string) => {
    const next = {
      ...schema,
      tables: schema.tables
        .filter((table) => table.id !== id)
        .map((table) => ({
          ...table,
          columns: table.columns.map((column) =>
            column.fk?.tableId === id ? { ...column, fk: null } : column,
          ),
        })),
    };
    commit(normalizeRelationships(next));
    if (selectedId === id) setSelectedId(null);
  };
  const addTable = () => {
    const table = makeTable(
      `TABLE_${schema.tables.length + 1}`,
      90 + (schema.tables.length % 4) * 70,
      100 + (schema.tables.length % 3) * 75,
      schema.tables.length,
    );
    commit({ ...schema, tables: [...schema.tables, table] });
    setSelectedId(table.id);
  };
  const addColumn = (tableId: string) => {
    const table = schema.tables.find((item) => item.id === tableId);
    if (!table) return;
    commit({
      ...schema,
      tables: schema.tables.map((item) =>
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
    });
  };
  const deleteColumn = (tableId: string, columnId: string) =>
    commit(normalizeRelationships({
      ...schema,
      tables: schema.tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              columns: table.columns.filter((column) => column.id !== columnId),
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
    }));

  const undo = () => {
    if (readOnly) return;
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [...items, cloneSchema(schema)]);
    setHistory((items) => items.slice(0, -1));
    setSchema(previous);
  };
  const redo = () => {
    if (readOnly) return;
    const next = future.at(-1);
    if (!next) return;
    setHistory((items) => [...items, cloneSchema(schema)]);
    setFuture((items) => items.slice(0, -1));
    setSchema(next);
  };
  const autoLayout = () => {
    const next = {
      ...schema,
      tables: schema.tables.map((table, index) => ({
        ...table,
        x: 70 + (index % 4) * 360,
        y: 70 + Math.floor(index / 4) * 270,
      })),
    };
    commit(next);
  };
  const fitView = () => {
    if (!canvasRef.current || (!schema.tables.length && !(schema.groups ?? []).length)) return;
    stopAnimationRef.current?.();
    stopAnimationRef.current = null;
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 48;
    const minX = Math.min(
      ...schema.tables.map((table) => table.x),
      ...(schema.groups ?? []).map((group) => group.x),
    );
    const minY = Math.min(
      ...schema.tables.map((table) => table.y),
      ...(schema.groups ?? []).map((group) => group.y),
    );
    const maxX = Math.max(
      ...schema.tables.map((table) => table.x + TABLE_WIDTH),
      ...(schema.groups ?? []).map((group) => group.x + group.width),
    );
    const maxY = Math.max(
      ...schema.tables.map((table) => table.y + tableHeight(table)),
      ...(schema.groups ?? []).map((group) => group.y + group.height),
    );
    const next = Math.max(
      MIN_ZOOM,
      Math.min(
        1.15,
        Math.min(
          (rect.width - padding * 2) / Math.max(1, maxX - minX),
          (rect.height - padding * 2) / Math.max(1, maxY - minY),
        ),
      ),
    );
    setZoom(next);
    // Centre the diagram's bounding box rather than resetting to a fixed corner.
    setPan({
      x: (rect.width - (maxX - minX) * next) / 2 - minX * next,
      y: (rect.height - (maxY - minY) * next) / 2 - minY * next,
    });
  };

  /** Where a table may rest, in canvas coordinates. */
  const tableBounds = useCallback(
    (table: Table) => ({
      minX: 0,
      maxX: CANVAS_WIDTH - TABLE_WIDTH,
      minY: 0,
      maxY: CANVAS_HEIGHT - tableHeight(table),
    }),
    [],
  );

  const resolveTablePosition = useCallback((id: string, x: number, y: number) => {
    const tables = schemaRef.current.tables;
    const table = tables.find((candidate) => candidate.id === id);
    if (!table) return { x, y };
    const bounds = tableBounds(table);
    const clamp = (value: Vec) => ({
      x: Math.max(bounds.minX, Math.min(bounds.maxX, Math.round(value.x))),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, Math.round(value.y))),
    });
    const collides = (position: Vec) => tables.some((other) => {
      if (other.id === id) return false;
      return position.x < other.x + TABLE_WIDTH + 18 &&
        position.x + TABLE_WIDTH + 18 > other.x &&
        position.y < other.y + tableHeight(other) + 18 &&
        position.y + tableHeight(table) + 18 > other.y;
    });
    const initial = clamp({ x, y });
    if (!collides(initial)) return initial;
    const step = 48;
    for (let ring = 1; ring <= 24; ring += 1) {
      const candidates = [
        { x: x + ring * step, y }, { x: x - ring * step, y },
        { x, y: y + ring * step }, { x, y: y - ring * step },
        { x: x + ring * step, y: y + ring * step }, { x: x - ring * step, y: y + ring * step },
        { x: x + ring * step, y: y - ring * step }, { x: x - ring * step, y: y - ring * step },
      ];
      const free = candidates.map(clamp).find((candidate) => !collides(candidate));
      if (free) return free;
    }
    return initial;
  }, [tableBounds]);

  /** Pan limits that always keep some of the diagram on screen. */
  const panBounds = useCallback((scale: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const slack = 160;
    const width = rect?.width ?? 0;
    const height = rect?.height ?? 0;
    return {
      minX: Math.min(0, width - CANVAS_WIDTH * scale) - slack,
      maxX: slack,
      minY: Math.min(0, height - CANVAS_HEIGHT * scale) - slack,
      maxY: slack,
    };
  }, []);

  const commitPosition = useCallback((id: string, x: number, y: number, schemaId?: string | null) => {
    if (readOnly) return;
    const resolved = resolveTablePosition(id, x, y);
    setHistory((items) => [
      ...items.slice(-49),
      cloneSchema(schemaRef.current),
    ]);
    setFuture([]);
    setSchema((current) => ({
      ...current,
      tables: current.tables.map((table) =>
        table.id === id ? { ...table, x: resolved.x, y: resolved.y, schemaId: schemaId === undefined ? table.schemaId : schemaId || undefined } : table,
      ),
    }));
    setDragPosition(null);
  }, [readOnly, resolveTablePosition]);

  const stopAnimation = useCallback(() => {
    stopAnimationRef.current?.();
    stopAnimationRef.current = null;
  }, []);

  /**
   * Springs a value pair from its current position to `target`, seeded with the
   * gesture's release velocity so there is no seam between drag and animation.
   */
  const animateTo = useCallback(
    (
      from: Vec,
      target: Vec,
      velocity: Vec,
      options: { damping: number; response: number },
      onFrame: (value: Vec) => void,
      onSettle?: (value: Vec) => void,
    ) => {
      stopAnimation();
      if (prefersReducedMotion()) {
        onFrame(target);
        onSettle?.(target);
        return;
      }
      // X and Y get independent springs; a single spring on 2D distance
      // desyncs whenever the two axes carry different velocities.
      const springX = new Spring(from.x, options);
      const springY = new Spring(from.y, options);
      springX.setTarget(target.x, velocity.x);
      springY.setTarget(target.y, velocity.y);
      springsRef.current = { x: springX, y: springY };
      stopAnimationRef.current = runFrameLoop((dt) => {
        const movingX = springX.step(dt);
        const movingY = springY.step(dt);
        const value = { x: springX.value, y: springY.value };
        onFrame(value);
        if (movingX || movingY) return true;
        springsRef.current = null;
        stopAnimationRef.current = null;
        onSettle?.(value);
        return false;
      });
    },
    [stopAnimation],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const now = event.timeStamp || performance.now();
      if (
        !gesture.moved &&
        Math.hypot(
          event.clientX - gesture.startX,
          event.clientY - gesture.startY,
        ) < DRAG_THRESHOLD
      ) {
        return; // hysteresis: not a drag yet
      }
      gesture.moved = true;

      if (gesture.mode === "pan") {
        const bounds = panBounds(zoomRef.current);
        const rawX = gesture.originX + event.clientX - gesture.startX;
        const rawY = gesture.originY + event.clientY - gesture.startY;
        const next = {
          x: rubberClamp(rawX, bounds.minX, bounds.maxX, window.innerWidth),
          y: rubberClamp(rawY, bounds.minY, bounds.maxY, window.innerHeight),
        };
        gesture.tracker.add(next.x, next.y, now);
        setPan(next);
        return;
      }

      const rect = canvasRef.current?.getBoundingClientRect();
      const group = schemaRef.current.groups?.find((item) => item.id === gesture.groupId);
      if (gesture.mode === "group" || gesture.mode === "group-resize") {
        if (!rect || !group) return;
        const point = {
          x: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
          y: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
        };
        if (gesture.mode === "group") {
          const bounds = groupBounds(group);
          setDragGroupPosition({
            id: group.id,
            x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x - gesture.grabX)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y - gesture.grabY)),
          });
        } else {
          setResizeGroup({
            id: group.id,
            width: Math.max(GROUP_MIN_WIDTH, Math.min(CANVAS_WIDTH - group.x, gesture.originWidth! + point.x - gesture.grabX)),
            height: Math.max(GROUP_MIN_HEIGHT, Math.min(CANVAS_HEIGHT - group.y, gesture.originHeight! + point.y - gesture.grabY)),
          });
        }
        return;
      }
      const memo = schemaRef.current.memos?.find((item) => item.id === gesture.memoId);
      if (gesture.mode === "memo" || gesture.mode === "memo-resize") {
        if (!rect || !memo) return;
        const point = {
          x: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
          y: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
        };
        if (gesture.mode === "memo") {
          const bounds = memoBounds(memo);
          setDragMemoPosition({
            id: memo.id,
            x: Math.max(bounds.minX, Math.min(bounds.maxX, point.x - gesture.grabX)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, point.y - gesture.grabY)),
          });
        } else {
          setResizeMemo({
            id: memo.id,
            width: Math.max(MEMO_MIN_WIDTH, Math.min(MEMO_MAX_WIDTH, gesture.originWidth! + point.x - gesture.grabX)),
            height: Math.max(MEMO_MIN_HEIGHT, Math.min(MEMO_MAX_HEIGHT, gesture.originHeight! + point.y - gesture.grabY)),
          });
        }
        return;
      }

      const table = schemaRef.current.tables.find(
        (item) => item.id === gesture.tableId,
      );
      if (!rect || !table) return;
      const bounds = tableBounds(table);
      const rawX =
        (event.clientX - rect.left - panRef.current.x) / zoomRef.current -
        gesture.grabX;
      const rawY =
        (event.clientY - rect.top - panRef.current.y) / zoomRef.current -
        gesture.grabY;
      const next = {
        x: rubberClamp(rawX, bounds.minX, bounds.maxX, CANVAS_WIDTH),
        y: rubberClamp(rawY, bounds.minY, bounds.maxY, CANVAS_HEIGHT),
      };
      gesture.tracker.add(next.x, next.y, now);
      setDragPosition({ id: table.id, ...next });
    };

    const up = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      gestureRef.current = null;
      setGrabbing(false);
      const now = event.timeStamp || performance.now();
      const velocity = gesture.tracker.velocity(now);

      if (gesture.mode === "pan") {
        if (!gesture.moved) return;
        const bounds = panBounds(zoomRef.current);
        const current = panRef.current;
        const projected = {
          x: current.x + project(velocity.x),
          y: current.y + project(velocity.y),
        };
        const target = {
          x: Math.max(bounds.minX, Math.min(bounds.maxX, projected.x)),
          y: Math.max(bounds.minY, Math.min(bounds.maxY, projected.y)),
        };
        const flicked = Math.hypot(velocity.x, velocity.y) > 60;
        animateTo(
          current,
          target,
          velocity,
          flicked ? FLICK_SPRING : SETTLE_SPRING,
          setPan,
        );
        return;
      }

      const memo = schemaRef.current.memos?.find((item) => item.id === gesture.memoId);
      const group = schemaRef.current.groups?.find((item) => item.id === gesture.groupId);
      if (gesture.mode === "group" && group) {
        const live = dragGroupPosition;
        if (gesture.moved && live?.id === group.id) commitGroupPosition(group.id, live.x, live.y);
        else setDragGroupPosition(null);
        return;
      }
      if (gesture.mode === "group-resize" && group) {
        const live = resizeGroup;
        if (gesture.moved && live?.id === group.id) commitGroupSize(group.id, live.width, live.height);
        else setResizeGroup(null);
        return;
      }
      if (gesture.mode === "memo" && memo) {
        const live = dragMemoPosition;
        if (gesture.moved && live?.id === memo.id) {
          commitMemoPosition(memo.id, live.x, live.y);
        } else {
          setDragMemoPosition(null);
        }
        return;
      }
      if (gesture.mode === "memo-resize" && memo) {
        const live = resizeMemo;
        if (gesture.moved && live?.id === memo.id) {
          commitMemoSize(memo.id, live.width, live.height);
        } else {
          setResizeMemo(null);
        }
        return;
      }

      const table = schemaRef.current.tables.find(
        (item) => item.id === gesture.tableId,
      );
      if (!table) return;
      if (!gesture.moved) {
        setDragPosition(null);
        return; // a tap, not a drag — selection already happened on pointerdown
      }
      const bounds = tableBounds(table);
      const current = {
        x: gesture.originX,
        y: gesture.originY,
      };
      const live = dragPositionRef.current;
      const from =
        live && live.id === table.id ? { x: live.x, y: live.y } : current;
      const projected = {
        x: from.x + project(velocity.x),
        y: from.y + project(velocity.y),
      };
      const projectedTarget = {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, projected.x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, projected.y)),
      };
      const target = resolveTablePosition(table.id, projectedTarget.x, projectedTarget.y);
      const tableCenter = { x: target.x + TABLE_WIDTH / 2, y: target.y + tableHeight(table) / 2 };
      const targetGroup = (schemaRef.current.groups ?? []).find((group) => {
        const position = liveGroup(group);
        return tableCenter.x >= position.x && tableCenter.x <= position.x + position.width &&
          tableCenter.y >= position.y + GROUP_HEADER_HEIGHT && tableCenter.y <= position.y + position.height;
      });
      const flicked = Math.hypot(velocity.x, velocity.y) > 60;
      animateTo(
        from,
        target,
        velocity,
        flicked ? FLICK_SPRING : SETTLE_SPRING,
        (value) => setDragPosition({ id: table.id, ...value }),
        (value) =>
          commitPosition(table.id, Math.round(value.x), Math.round(value.y), targetGroup?.id ?? null),
      );
    };

    const cancel = (event: PointerEvent) => up(event);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [animateTo, commitGroupPosition, commitGroupSize, commitMemoPosition, commitMemoSize, commitPosition, dragGroupPosition, dragMemoPosition, groupBounds, liveGroup, memoBounds, panBounds, resolveTablePosition, resizeGroup, resizeMemo, tableBounds]);

  /**
   * Wheel handling is attached natively because React registers `wheel`
   * passively, which makes `preventDefault` a no-op and lets the page scroll.
   *
   * Scroll pans and ctrl/⌘-scroll (trackpad pinch) zooms, matching the
   * convention in every other diagram editor.
   */
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      stopAnimation();
      const rect = element.getBoundingClientRect();

      if (event.ctrlKey || event.metaKey) {
        const currentZoom = zoomRef.current;
        const next = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, currentZoom * Math.exp(-event.deltaY * 0.01)),
        );
        if (next === currentZoom) return;
        // Keep the point under the cursor pinned while the scale changes.
        const pointer = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
        const world = {
          x: (pointer.x - panRef.current.x) / currentZoom,
          y: (pointer.y - panRef.current.y) / currentZoom,
        };
        setZoom(next);
        setPan({
          x: pointer.x - world.x * next,
          y: pointer.y - world.y * next,
        });
        return;
      }

      const bounds = panBounds(zoomRef.current);
      setPan((current) => ({
        x: Math.max(
          bounds.minX,
          Math.min(bounds.maxX, current.x - event.deltaX),
        ),
        y: Math.max(
          bounds.minY,
          Math.min(bounds.maxY, current.y - event.deltaY),
        ),
      }));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [panBounds, stopAnimation]);

  /** Zoom around the viewport centre, for the HUD buttons and keyboard. */
  const zoomBy = useCallback(
    (delta: number) => {
      stopAnimation();
      const rect = canvasRef.current?.getBoundingClientRect();
      const currentZoom = zoomRef.current;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom + delta));
      if (next === currentZoom || !rect) {
        setZoom(next);
        return;
      }
      const centre = { x: rect.width / 2, y: rect.height / 2 };
      const world = {
        x: (centre.x - panRef.current.x) / currentZoom,
        y: (centre.y - panRef.current.y) / currentZoom,
      };
      setZoom(next);
      setPan({ x: centre.x - world.x * next, y: centre.y - world.y * next });
    },
    [stopAnimation],
  );

  const onCanvasDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    stopAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(null);
    setSelectedGroupId(null);
    setSelectedMemoId(null);
    setEditingMemoId(null);
    setGrabbing(true);
    const tracker = new VelocityTracker();
    tracker.add(pan.x, pan.y, event.timeStamp || performance.now());
    gestureRef.current = {
      mode: "pan",
      pointerId: event.pointerId,
      grabX: 0,
      grabY: 0,
      originX: pan.x,
      originY: pan.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      tracker,
    };
  };

  const onHeaderDown = (
    event: React.PointerEvent<HTMLDivElement>,
    table: Table,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSelectedId(table.id);
    setSelectedGroupId(null);
    setSelectedMemoId(null);
    setEditingMemoId(null);
    setGrabbing(true);
    const origin = livePosition(table);
    const tracker = new VelocityTracker();
    tracker.add(origin.x, origin.y, event.timeStamp || performance.now());
    gestureRef.current = {
      mode: "table",
      pointerId: event.pointerId,
      tableId: table.id,
      // Respect where the card was grabbed — snapping to its centre would
      // break the illusion that the card is stuck to the pointer.
      grabX: (event.clientX - rect.left - pan.x) / zoom - origin.x,
      grabY: (event.clientY - rect.top - pan.y) / zoom - origin.y,
      originX: origin.x,
      originY: origin.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      tracker,
    };
  };

  const onMemoDown = (event: React.PointerEvent<HTMLElement>, memo: Memo) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = liveMemo(memo);
    setSelectedId(null);
    setSelectedGroupId(null);
    setSelectedMemoId(memo.id);
    setGrabbing(true);
    gestureRef.current = {
      mode: "memo",
      pointerId: event.pointerId,
      memoId: memo.id,
      grabX: (event.clientX - rect.left - pan.x) / zoom - position.x,
      grabY: (event.clientY - rect.top - pan.y) / zoom - position.y,
      originX: position.x,
      originY: position.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      tracker: new VelocityTracker(),
    };
  };

  const onMemoResizeDown = (event: React.PointerEvent<HTMLButtonElement>, memo: Memo) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = liveMemo(memo);
    const pointer = {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
    setSelectedId(null);
    setSelectedMemoId(memo.id);
    setGrabbing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      mode: "memo-resize",
      pointerId: event.pointerId,
      memoId: memo.id,
      grabX: pointer.x,
      grabY: pointer.y,
      originX: position.x,
      originY: position.y,
      originWidth: position.width,
      originHeight: position.height,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      tracker: new VelocityTracker(),
    };
  };

  function memoBounds(memo: Memo) {
    return {
      minX: 0,
      maxX: CANVAS_WIDTH - memo.width,
      minY: 0,
      maxY: CANVAS_HEIGHT - memo.height,
    };
  }

  function commitGroupPosition(id: string, x: number, y: number) {
    if (readOnly) return;
    const current = schemaRef.current;
    if (!current.groups?.some((item) => item.id === id)) return;
    setHistory((items) => [...items.slice(-49), cloneSchema(current)]);
    setFuture([]);
    setSchema((next) => ({
      ...next,
      groups: (next.groups ?? []).map((item) => item.id === id ? {
        ...item,
        x: Math.max(0, Math.min(CANVAS_WIDTH - item.width, Math.round(x))),
        y: Math.max(0, Math.min(CANVAS_HEIGHT - item.height, Math.round(y))),
      } : item),
    }));
    setDragGroupPosition(null);
  }

  function commitGroupSize(id: string, width: number, height: number) {
    if (readOnly) return;
    const current = schemaRef.current;
    if (!current.groups?.some((item) => item.id === id)) return;
    setHistory((items) => [...items.slice(-49), cloneSchema(current)]);
    setFuture([]);
    setSchema((next) => ({
      ...next,
      groups: (next.groups ?? []).map((item) => item.id === id ? {
        ...item,
        width: Math.max(GROUP_MIN_WIDTH, Math.min(CANVAS_WIDTH - item.x, Math.round(width))),
        height: Math.max(GROUP_MIN_HEIGHT, Math.min(CANVAS_HEIGHT - item.y, Math.round(height))),
      } : item),
    }));
    setResizeGroup(null);
  }

  function groupBounds(group: SchemaGroup) {
    return {
      minX: 0,
      maxX: CANVAS_WIDTH - group.width,
      minY: 0,
      maxY: CANVAS_HEIGHT - group.height,
    };
  }

  const onGroupDown = (event: React.PointerEvent<HTMLElement>, group: SchemaGroup) => {
    if (event.button !== 0 || readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    stopAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = liveGroup(group);
    setSelectedGroupId(group.id);
    setSelectedId(null);
    setSelectedMemoId(null);
    setGrabbing(true);
    gestureRef.current = {
      mode: "group",
      pointerId: event.pointerId,
      memoId: undefined,
      grabX: (event.clientX - rect.left - pan.x) / zoom - position.x,
      grabY: (event.clientY - rect.top - pan.y) / zoom - position.y,
      originX: position.x,
      originY: position.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      tracker: new VelocityTracker(),
    };
    gestureRef.current.groupId = group.id;
  };

  const onGroupResizeDown = (event: React.PointerEvent<HTMLButtonElement>, group: SchemaGroup) => {
    if (event.button !== 0 || readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const position = liveGroup(group);
    const pointer = {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
    setSelectedGroupId(group.id);
    setSelectedId(null);
    setGrabbing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      mode: "group-resize",
      pointerId: event.pointerId,
      groupId: group.id,
      grabX: pointer.x,
      grabY: pointer.y,
      originX: position.x,
      originY: position.y,
      originWidth: position.width,
      originHeight: position.height,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      tracker: new VelocityTracker(),
    };
  };

  function commitMemoPosition(id: string, x: number, y: number) {
    if (readOnly) return;
    const current = schemaRef.current;
    const memo = current.memos?.find((item) => item.id === id);
    if (!memo) return;
    const bounds = memoBounds(memo);
    setHistory((items) => [...items.slice(-49), cloneSchema(current)]);
    setFuture([]);
    setSchema((next) => ({
      ...next,
      memos: (next.memos ?? []).map((item) => item.id === id ? {
        ...item,
        x: Math.max(bounds.minX, Math.min(bounds.maxX, Math.round(x))),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, Math.round(y))),
      } : item),
    }));
    setDragMemoPosition(null);
  }

  function commitMemoSize(id: string, width: number, height: number) {
    if (readOnly) return;
    const current = schemaRef.current;
    if (!current.memos?.some((item) => item.id === id)) return;
    setHistory((items) => [...items.slice(-49), cloneSchema(current)]);
    setFuture([]);
    setSchema((next) => ({
      ...next,
      memos: (next.memos ?? []).map((item) => item.id === id ? {
        ...item,
        width: Math.max(MEMO_MIN_WIDTH, Math.min(MEMO_MAX_WIDTH, Math.round(width))),
        height: Math.max(MEMO_MIN_HEIGHT, Math.min(MEMO_MAX_HEIGHT, Math.round(height))),
      } : item),
    }));
    setResizeMemo(null);
  }

  const addMemo = () => {
    const index = schema.memos?.length ?? 0;
    const memo = makeMemo("", 120 + (index % 4) * 70, 100 + (index % 3) * 70, "yellow");
    commit({ ...schema, memos: [...(schema.memos ?? []), memo] });
    setSelectedId(null);
    setSelectedMemoId(memo.id);
    setEditingMemoId(memo.id);
  };

  const addGroup = () => {
    const index = schema.groups?.length ?? 0;
    const group = makeSchemaGroup(`Schema ${index + 1}`, 90 + (index % 3) * 120, 80 + (index % 2) * 120, index);
    commit({ ...schema, groups: [...(schema.groups ?? []), group] });
    setSelectedGroupId(group.id);
    setSelectedId(null);
    setSelectedMemoId(null);
  };

  const patchGroup = (id: string, patch: Partial<SchemaGroup>) => {
    if (readOnly) return;
    commit({ ...schema, groups: (schema.groups ?? []).map((group) => group.id === id ? { ...group, ...patch } : group) });
  };

  const deleteGroup = (id: string) => {
    if (readOnly) return;
    commit({
      ...schema,
      groups: (schema.groups ?? []).filter((group) => group.id !== id),
      tables: schema.tables.map((table) => table.schemaId === id ? { ...table, schemaId: undefined } : table),
    });
    if (selectedGroupId === id) setSelectedGroupId(null);
  };

  const assignTableToGroup = (tableId: string, schemaId: string) => {
    if (readOnly) return;
    commit({
      ...schema,
      tables: schema.tables.map((table) => table.id === tableId ? { ...table, schemaId: schemaId || undefined } : table),
    });
  };

  const patchMemo = (id: string, patch: Partial<Memo>) => {
    if (readOnly) return;
    setSchema((current) => ({
      ...current,
      memos: (current.memos ?? []).map((memo) => memo.id === id ? { ...memo, ...patch } : memo),
    }));
    setDirty(true);
  };

  const deleteMemo = (id: string) => {
    commit({ ...schema, memos: (schema.memos ?? []).filter((memo) => memo.id !== id) });
    if (selectedMemoId === id) setSelectedMemoId(null);
    if (editingMemoId === id) setEditingMemoId(null);
  };

  /** Keyboard parity for positioning a card that has focus. */
  const onCardKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    table: Table,
  ) => {
    const deltas: Record<string, Vec> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const step = NUDGE * (event.shiftKey ? 3 : 1);
    const bounds = tableBounds(table);
    commitPosition(
      table.id,
      Math.max(bounds.minX, Math.min(bounds.maxX, table.x + delta.x * step)),
      Math.max(bounds.minY, Math.min(bounds.maxY, table.y + delta.y * step)),
    );
  };

  const makeJunction = () => {
    const picked = schema.tables.filter((table) => table.id === selectedId);
    if (picked.length !== 1 || schema.tables.length < 2) return;
    const left = picked[0];
    const right = schema.tables.find((table) => table.id !== left.id);
    if (!right) return;
    const leftPk = primaryKeyColumns(left)[0];
    const rightPk = primaryKeyColumns(right)[0];
    if (!leftPk || !rightPk) return;
    const junction = makeTable(
      `${left.name}_${right.name}`,
      left.x + 330,
      left.y + 150,
      schema.tables.length,
    );
    junction.keyStrategy = "none";
    junction.columns = [
      makeColumn({
        name: `${left.name}_ID`,
        type: leftPk.type,
        size: leftPk.size,
        pk: true,
        notNull: true,
        fk: { tableId: left.id, columnId: leftPk.id },
      }),
      makeColumn({
        name: `${right.name}_ID`,
        type: rightPk.type,
        size: rightPk.size,
        pk: true,
        notNull: true,
        fk: { tableId: right.id, columnId: rightPk.id },
      }),
    ];
    commit(normalizeRelationships({ ...schema, tables: [...schema.tables, junction] }));
    setSelectedId(junction.id);
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const copyShareText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast({ text: "Link copied.", tone: "ok" });
    } catch {
      setShareError("Clipboard access failed. Select and copy the link manually.");
    }
  };

  const generateShareLink = async () => {
    setShareBusy(true);
    setShareError("");
    try {
      const query = workspaceSlug ? `?workspace=${encodeURIComponent(workspaceSlug)}` : "";
      const response = await fetch(`/api/projects/${projectId}/share${query}`, { method: "POST" });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error || "Could not create project link.");
      setShareLink(body.url);
      await copyShareText(body.url);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not create project link.");
    } finally {
      setShareBusy(false);
    }
  };

  const inviteToWorkspace = async () => {
    if (!workspaceSlug || !workspaceEmail.trim()) return;
    setWorkspaceInviteBusy(true);
    setShareError("");
    try {
      await (authClient.organization as any).setActive({ organizationSlug: workspaceSlug });
      const result = await (authClient.organization as any).inviteMember({ organizationId: workspaceId, email: workspaceEmail.trim(), role: "member" });
      if (result.error || !result.data?.id) throw new Error(result.error?.message || "Could not create workspace invitation.");
      const url = `${window.location.origin}/invite/${result.data.id}`;
      setWorkspaceInviteLink(url);
      await copyShareText(url);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not create workspace invitation.");
    } finally {
      setWorkspaceInviteBusy(false);
    }
  };
  const download = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportTab === "plsql" ? "packages.sql" : "schema.sql";
    link.click();
    URL.revokeObjectURL(url);
  };
  const importSchema = () => {
    const result = parseCreateTable(importText);
    if (!result.schema) {
      setImportMessage({ ok: false, text: result.errors.join(" ") });
      return;
    }
    setImportMessage({
      ok: true,
      text: `${result.schema.tables.length} table(s) imported.${result.warnings.length ? ` ${result.warnings.length} warning(s).` : ""}`,
    });
    commit(result.schema);
    setSelectedId(result.schema.tables[0]?.id ?? null);
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

  const save = async (overwrite = false) => {
    if (readOnly) return;
    try {
      const query = new URLSearchParams();
      if (workspaceSlug) query.set("workspace", workspaceSlug);
      if (shareToken) query.set("shareToken", shareToken);
      const response = await fetch(
        `/api/projects/${projectId}${query.toString() ? `?${query}` : ""}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ schema, overwrite }),
        },
      );
      if (response.ok) {
        const next = (await response.json()) as Schema;
        setSchema((current) => ({ ...current, revision: next.revision }));
        setDirty(false);
        lastSavedNameRef.current = next.name;
      } else if (response.status === 409) {
        setToast({
          text: "This project changed elsewhere. Overwrite your save?",
          tone: "error",
        });
        if (
          window.confirm(
            "This project changed elsewhere. Overwrite the other changes?",
          )
        )
          await save(true);
        return;
      }
      setToast(
        response.ok
          ? { text: "Project saved.", tone: "ok" }
          : {
              text: "Database save unavailable — configure DATABASE_URL.",
              tone: "error",
            },
      );
    } catch {
      setToast({ text: "Could not reach the server.", tone: "error" });
    }
  };

  useEffect(() => {
    if (readOnly || !dirty) return;
    const timer = window.setTimeout(() => void save(), 1500);
    return () => window.clearTimeout(timer);
  }, [dirty, projectId, readOnly, schema, shareToken, workspaceSlug]);

  useEffect(() => {
    if (readOnly) return;
    if (schema.name === lastSavedNameRef.current) return;
    const timer = window.setTimeout(async () => {
      const query = new URLSearchParams();
      if (workspaceSlug) query.set("workspace", workspaceSlug);
      if (shareToken) query.set("shareToken", shareToken);
      const response = await fetch(
        `/api/projects/${projectId}${query.toString() ? `?${query}` : ""}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: schema.name,
            revision: schema.revision,
          }),
        },
      );
      if (response.ok) {
        const next = (await response.json()) as Schema;
        setSchema((current) => ({ ...current, revision: next.revision }));
        lastSavedNameRef.current = next.name;
        setDirty(false);
      } else if (response.status === 409)
        setToast({ text: "The name changed elsewhere.", tone: "error" });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [projectId, readOnly, schema.name, schema.revision, shareToken, workspaceSlug]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  /** Escape closes the topmost layer; ⌘S saves and ⌘E exports. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (modal) setModal(null);
        else if (openMenu) setOpenMenu(null);
        else if (userMenuOpen) setUserMenuOpen(false);
        else if (selectedId) setSelectedId(null);
        else if (selectedGroupId) setSelectedGroupId(null);
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void save();
      } else if (key === "e") {
        event.preventDefault();
        setModal("export");
      } else if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const relationships = useMemo(
    () => (schema.relationships ?? []).flatMap((relationship) => {
      const from = schema.tables.find((table) => table.id === relationship.startTableId);
      const to = schema.tables.find((table) => table.id === relationship.endTableId);
      const pair = relationship.fields[0] ?? { startFieldId: relationship.startFieldId, endFieldId: relationship.endFieldId };
      const fromIndex = from?.columns.findIndex((column) => column.id === pair.startFieldId) ?? -1;
      const toIndex = to?.columns.findIndex((column) => column.id === pair.endFieldId) ?? -1;
      return from && to && fromIndex >= 0 && toIndex >= 0 ? [{ relationship, from, fromIndex, to, toIndex, id: relationship.id }] : [];
    }),
    [schema],
  );
  const relationshipPoint = (table: Table, index: number, other: Table) => {
    // Anchors follow the live position so edges stay attached mid-drag.
    const origin = livePosition(table);
    const otherOrigin = livePosition(other);
    const tableCenter = {
      x: origin.x + TABLE_WIDTH / 2,
      y: origin.y + tableHeight(table) / 2,
    };
    const otherCenter = {
      x: otherOrigin.x + TABLE_WIDTH / 2,
      y: otherOrigin.y + tableHeight(other) / 2,
    };
    const dx = otherCenter.x - tableCenter.x;
    const dy = otherCenter.y - tableCenter.y;
    const rowY = origin.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return {
        x: origin.x + (dx >= 0 ? TABLE_WIDTH : 0),
        y: rowY,
        axis: "horizontal" as const,
      };
    }

    return {
      x: origin.x + TABLE_WIDTH,
      y: rowY,
      axis: "vertical" as const,
    };
  };

  const relationshipCardinalities = (relationship: Relationship) => {
    if (relationship.cardinality === "one_to_one") return ["1", "1"];
    if (relationship.cardinality === "one_to_many") return ["1", relationship.manyLabel || "n"];
    return [relationship.manyLabel || "n", "1"];
  };

  const patchRelationship = (id: string, patch: Partial<Relationship>) => {
    if (readOnly) return;
    commit(normalizeRelationships({
      ...schema,
      relationships: (schema.relationships ?? []).map((relationship) => relationship.id === id ? { ...relationship, ...patch } : relationship),
    }));
  };

  const deleteRelationship = (id: string) => {
    if (readOnly) return;
    commit(normalizeRelationships({ ...schema, relationships: (schema.relationships ?? []).filter((relationship) => relationship.id !== id) }));
    if (openRelationshipId === id) setOpenRelationshipId(null);
  };

  const swapRelationship = (relationship: Relationship) => {
    patchRelationship(relationship.id, {
      startTableId: relationship.endTableId,
      startFieldId: relationship.endFieldId,
      endTableId: relationship.startTableId,
      endFieldId: relationship.startFieldId,
      fields: relationship.fields.map((pair) => ({ startFieldId: pair.endFieldId, endFieldId: pair.startFieldId })),
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
          cardinality: relationshipCardinalities(relationship.relationship).join(":"),
          fromId: relationship.from.id,
          name: relationship.relationship.name,
          relationship: relationship.relationship,
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
        } else setToast({ text: "Could not create project.", tone: "error" });
      },
    },
    { separator: true },
    { label: "Import DDL…", onSelect: () => setModal("import") },
    { label: "Export…", onSelect: () => setModal("export"), hint: "⌘E" },
    { separator: true },
    { label: "Save to database", onSelect: save, hint: "⌘S" },
  ];
  const editMenu: MenuItem[] = [
    { label: "Undo", onSelect: undo, disabled: !history.length, hint: "⌘Z" },
    { label: "Redo", onSelect: redo, disabled: !future.length, hint: "⇧⌘Z" },
    { separator: true },
    { label: "Add table", onSelect: addTable },
    { label: "Add schema group", onSelect: addGroup },
    {
      label: "Add junction table",
      onSelect: makeJunction,
      disabled: !selected,
    },
    { separator: true },
    {
      label: "Delete selected table",
      onSelect: () => selected && deleteTable(selected.id),
      disabled: !selected,
    },
  ];
  const viewMenu: MenuItem[] = [
    { label: "Zoom in", onSelect: () => zoomBy(0.1), hint: "⌘+" },
    { label: "Zoom out", onSelect: () => zoomBy(-0.1), hint: "⌘−" },
    { label: "Fit to screen", onSelect: fitView, hint: "⇧1" },
    { separator: true },
    { label: "Tidy up layout", onSelect: autoLayout },
    {
      label: sidebarOpen ? "Hide side panel" : "Show side panel",
      onSelect: () => setSidebarOpen((open) => !open),
    },
  ];
  const settingsMenu: MenuItem[] = [
    {
      label: `${relationSettings.showCardinality ? "Hide" : "Show"} cardinality`,
      onSelect: () => setRelationSettings((current) => ({ ...current, showCardinality: !current.showCardinality })),
    },
    {
      label: `${relationSettings.showRelationshipLabels ? "Hide" : "Show"} relationship labels`,
      onSelect: () => setRelationSettings((current) => ({ ...current, showRelationshipLabels: !current.showRelationshipLabels })),
    },
    { separator: true },
    { label: "Clear invalid references", onSelect: clearInvalidForeignKeys },
  ];
  const helpMenu: MenuItem[] = [
    {
      label: "Oracle target: 12.2+",
      onSelect: () =>
        setToast({
          text: "Generating DDL for Oracle 12.2 and later.",
          tone: "ok",
        }),
    },
  ];

  const menus: Array<{ name: string; items: MenuItem[] }> = [
    { name: "File", items: fileMenu },
    { name: "Edit", items: editMenu },
    { name: "View", items: viewMenu },
    { name: "Settings", items: settingsMenu },
    { name: "Help", items: helpMenu },
  ];

  return (
    <div className={`app ${readOnly ? "share-read-only" : ""}`}>
      <header className="appbar">
        <a className="appbar-brand" aria-label="DrawSQL home" href="/">
          <BrandMark compact />
        </a>
        <div className="appbar-main">
          <div className="appbar-title">
            <Database size={17} className="appbar-title-icon" />
            <a
              className="appbar-crumb"
              href={workspaceSlug ? `/${workspaceSlug}` : "/"}
            >
              {workspaceSlug ? "Diagrams" : "My diagrams"}
            </a>
            <span className="appbar-slash">/</span>
            <input
              className="appbar-name"
              aria-label="Diagram name"
              value={schema.name}
              onChange={(event) => {
                if (readOnly) return;
                setSchema((current) => ({
                  ...current,
                  name: event.target.value,
                }));
                setDirty(true);
              }}
            />
          </div>
          <div className="menubar">
            {menus.map((menu) => (
              <Menu
                key={menu.name}
                name={menu.name}
                items={menu.items}
                open={openMenu === menu.name}
                anyOpen={openMenu !== null}
                onOpenChange={setOpenMenu}
              />
            ))}
            <span className={`status-chip ${dirty ? "dirty" : ""}`}>
              {dirty ? "Unsaved changes" : "No changes"}
            </span>
          </div>
        </div>
        <div className="appbar-actions">
          <Button className="share-btn" onClick={() => setModal("share")}>
            <Share2 size={15} /> Share
          </Button>
          <div className="user-menu">
            <button
              type="button"
              className="avatar-btn"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((open) => !open)}
            >
              <UserRound size={17} />
              <ChevronDown size={13} />
            </button>
            {userMenuOpen && (
              <div className="user-menu-popup" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    void authClient.signOut().then(() => router.push("/login"))
                  }
                >
                  <UserRound size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className={`body ${sidebarOpen ? "" : "panel-hidden"}`}>
        <aside className="panel" aria-label="Diagram structure">
          <div className="panel-tabs" role="tablist">
            <button
              type="button"
              className="tab-arrow"
              aria-label="Hide side panel"
              onClick={() => setSidebarOpen(false)}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === "tables"}
              className={`panel-tab ${panelTab === "tables" ? "active" : ""}`}
              onClick={() => setPanelTab("tables")}
            >
              Tables ({schema.tables.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panelTab === "relationships"}
              className={`panel-tab ${panelTab === "relationships" ? "active" : ""}`}
              onClick={() => setPanelTab("relationships")}
            >
              Relationships ({relationshipRows.length})
            </button>
          </div>

          {panelMode === "code" ? (
            <pre className="panel-code">
              <code>{highlightSql(ddl)}</code>
            </pre>
          ) : panelTab === "tables" ? (
            <>
              <div className="panel-toolbar">
                <label className="panel-search">
                  <Search size={15} />
                  <input
                    aria-label="Search tables"
                    placeholder="Search..."
                    value={tableQuery}
                    onChange={(event) => setTableQuery(event.target.value)}
                  />
                </label>
                <Button className="add-link" onClick={addTable}>
                  <Plus size={15} /> Add table
                </Button>
              </div>
              <div className="panel-body">
                {!schema.tables.length ? (
                  <div className="empty-state">
                    <div className="empty-art" aria-hidden="true">
                      <Database size={40} />
                      <span className="empty-badge">
                        <Plus size={16} />
                      </span>
                    </div>
                    <strong>No tables</strong>
                    <p>Start building your diagram!</p>
                    <Button className="btn primary" onClick={addTable}>
                      <Plus size={15} /> Add table
                    </Button>
                  </div>
                ) : !filteredTables.length ? (
                  <div className="empty-state">
                    <strong>No matches</strong>
                    <p>No table names contain “{tableQuery}”.</p>
                  </div>
                ) : (
                  filteredTables.map((table) => (
                    <div
                      className={`entity ${selectedId === table.id ? "open" : ""}`}
                      key={table.id}
                    >
                      <button
                        type="button"
                        className="entity-head"
                        aria-expanded={selectedId === table.id}
                        onClick={() =>
                          setSelectedId(
                            selectedId === table.id ? null : table.id,
                          )
                        }
                      >
                        <span
                          className="entity-swatch"
                          style={{ background: table.color.a }}
                          aria-hidden="true"
                        />
                        <span className="entity-copy">
                          <strong>{table.name.toUpperCase()}</strong>
                          <small>{table.columns.length} columns</small>
                        </span>
                        <ChevronDown
                          size={15}
                          className="entity-chevron"
                          aria-hidden="true"
                        />
                      </button>
                      {selectedId === table.id && (
                        <div className="entity-body">
                          <div className="field-row">
                            <label className="field">
                              <span className="field-label">Table name</span>
                              <Input
                                className="input"
                                value={table.name}
                                onChange={(event) =>
                                  patchTable(table.id, {
                                    name: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="field">
                              <span className="field-label">
                                Key generation
                              </span>
                              <select
                                className="select"
                                value={table.keyStrategy}
                                onChange={(event) =>
                                  patchTable(table.id, {
                                    keyStrategy: event.target
                                      .value as KeyStrategy,
                                  })
                                }
                              >
                                <option value="sequence-trigger">
                                  Sequence + trigger
                                </option>
                                <option value="identity">
                                  Generated identity
                                </option>
                                <option value="none">Manual / none</option>
                              </select>
                            </label>
                            <label className="field">
                              <span className="field-label">Schema group</span>
                              <select
                                className="select"
                                value={table.schemaId ?? ""}
                                disabled={readOnly}
                                onChange={(event) => assignTableToGroup(table.id, event.target.value)}
                              >
                                <option value="">Ungrouped</option>
                                {(schema.groups ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                              </select>
                            </label>
                          </div>
                          <label className="field">
                            <span className="field-label">Table comment</span>
                            <Input
                              className="input"
                              aria-label={`Comment for table ${table.name}`}
                              placeholder="COMMENT ON TABLE"
                              value={table.comment ?? ""}
                              onChange={(event) =>
                                patchTable(table.id, {
                                  comment: event.target.value,
                                })
                              }
                            />
                          </label>
                          {primaryKeyColumns(table).length > 1 && (
                            <p className="hint">
                              Composite primary key — manual key generation
                              required.
                            </p>
                          )}

                          {table.columns.map((column) => (
                            <div className="column-card" key={column.id}>
                              <div className="column-card-head">
                                <Input
                                  className="input"
                                  aria-label={`Name of column ${column.name}`}
                                  value={column.name}
                                  onChange={(event) =>
                                    patchColumn(table.id, column.id, {
                                      name: event.target.value,
                                    })
                                  }
                                />
                                <Button
                                  className="icon-btn danger"
                                  aria-label={`Delete column ${column.name}`}
                                  onClick={() =>
                                    deleteColumn(table.id, column.id)
                                  }
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                              <div className="column-card-row">
                                <select
                                  aria-label={`Datatype for ${column.name}`}
                                  className="select"
                                  value={column.type}
                                  onChange={(event) =>
                                    patchColumn(table.id, column.id, {
                                      type: event.target
                                        .value as Column["type"],
                                    })
                                  }
                                >
                                  {ORACLE_TYPES.map((type) => (
                                    <option key={type}>{type}</option>
                                  ))}
                                </select>
                                {typeUsesSize(column.type) && (
                                  <Input
                                    className="input"
                                    aria-label={`Size for ${column.name}`}
                                    placeholder={typeSizePlaceholder(
                                      column.type,
                                    )}
                                    value={column.size}
                                    onChange={(event) =>
                                      patchColumn(table.id, column.id, {
                                        size: event.target.value,
                                      })
                                    }
                                  />
                                )}
                              </div>
                              <div className="checks">
                                <label>
                                  <Checkbox
                                    isSelected={column.pk}
                                    onChange={(isSelected) =>
                                      patchColumn(table.id, column.id, {
                                        pk: isSelected,
                                        fk: isSelected ? null : column.fk,
                                      })
                                    }
                                  />
                                  PK
                                </label>
                                <label>
                                  <Checkbox
                                    isSelected={column.notNull}
                                    onChange={(isSelected) =>
                                      patchColumn(table.id, column.id, {
                                        notNull: isSelected,
                                      })
                                    }
                                  />
                                  NN
                                </label>
                                <label>
                                  <Checkbox
                                    isSelected={column.unique}
                                    onChange={(isSelected) =>
                                      patchColumn(table.id, column.id, {
                                        unique: isSelected,
                                      })
                                    }
                                  />
                                  UQ
                                </label>
                              </div>
                              <Input
                                className="input"
                                aria-label={`Default for ${column.name}`}
                                placeholder="DEFAULT expression"
                                value={column.defaultValue}
                                onChange={(event) =>
                                  patchColumn(table.id, column.id, {
                                    defaultValue: event.target.value,
                                  })
                                }
                              />
                              <Input
                                className="input"
                                aria-label={`Check for ${column.name}`}
                                placeholder="CHECK expression"
                                value={column.check}
                                onChange={(event) =>
                                  patchColumn(table.id, column.id, {
                                    check: event.target.value,
                                  })
                                }
                              />
                              <Input
                                className="input"
                                aria-label={`Comment for ${column.name}`}
                                placeholder="COLUMN COMMENT"
                                value={column.comment ?? ""}
                                onChange={(event) =>
                                  patchColumn(table.id, column.id, {
                                    comment: event.target.value,
                                  })
                                }
                              />
                              {!column.pk && (
                                <select
                                  aria-label={`Foreign key for ${column.name}`}
                                  className="select"
                                  value={
                                    column.fk
                                      ? `${column.fk.tableId}::${column.fk.columnId}`
                                      : ""
                                  }
                                  onChange={(event) => {
                                    const [tableId, columnId] =
                                      event.target.value.split("::");
                                    patchColumn(table.id, column.id, {
                                      fk:
                                        tableId && columnId
                                          ? { tableId, columnId }
                                          : null,
                                    });
                                  }}
                                >
                                  <option value="">No reference</option>
                                  {compatibleForeignKeyTargets(column).map(
                                    ({ table: target, target: field }) => (
                                      <option
                                        key={`${target.id}::${field.id}`}
                                        value={`${target.id}::${field.id}`}
                                      >
                                        {target.name.toUpperCase()}.
                                        {field.name.toUpperCase()}
                                      </option>
                                    ),
                                  )}
                                </select>
                              )}
                            </div>
                          ))}

                          <div className="entity-actions">
                            <Button
                              className="btn"
                              onClick={() => addColumn(table.id)}
                            >
                              <Plus size={14} /> Add column
                            </Button>
                            <Button className="btn" onClick={makeJunction}>
                              <Link2 size={14} /> Junction
                            </Button>
                            <Button
                              className="btn danger"
                              onClick={() => deleteTable(table.id)}
                            >
                              <Trash2 size={14} /> Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="panel-body relationship-panel-body">
              <label className="panel-search relationship-search">
                <Search size={15} />
                <input
                  aria-label="Search relationships"
                  placeholder="Search relationships..."
                  value={relationshipQuery}
                  onChange={(event) => setRelationshipQuery(event.target.value)}
                />
              </label>
              {!relationshipRows.length ? (
                <div className="empty-state">
                  <div className="empty-art" aria-hidden="true">
                    <Link2 size={38} />
                  </div>
                  <strong>No relationships</strong>
                  <p>Give a column a foreign key to link two tables.</p>
                </div>
              ) : (
                relationshipRows
                  .filter((row) => row.name.toUpperCase().includes(relationshipQuery.trim().toUpperCase()))
                  .map((row) => {
                    const relationship = row.relationship;
                    const startTable = schema.tables.find((table) => table.id === relationship.startTableId);
                    const endTable = schema.tables.find((table) => table.id === relationship.endTableId);
                    const pairs = relationship.fields.length ? relationship.fields : [{ startFieldId: relationship.startFieldId, endFieldId: relationship.endFieldId }];
                    return (
                      <section className={`relationship-editor ${openRelationshipId === relationship.id ? "open" : ""}`} key={relationship.id}>
                        <button type="button" className="relationship-row relationship-editor-head" aria-expanded={openRelationshipId === relationship.id} onClick={() => setOpenRelationshipId(openRelationshipId === relationship.id ? null : relationship.id)}>
                          <Link2 size={14} aria-hidden="true" />
                          <span className="relationship-copy"><strong>{relationship.name}</strong><small>{row.from} → {row.to} · {row.cardinality}</small></span>
                          <ChevronDown size={15} className="entity-chevron" />
                        </button>
                        {openRelationshipId === relationship.id && (
                          <div className="relationship-editor-body">
                            <label className="field"><span className="field-label">Name</span><Input value={relationship.name} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { name: event.target.value })} /></label>
                            <div className="relationship-endpoints"><span><b>Foreign</b>{startTable?.name}</span><button type="button" className="icon-btn" aria-label="Swap relationship endpoints" disabled={readOnly} onClick={() => swapRelationship(relationship)}><Link2 size={14} /></button><span><b>Primary</b>{endTable?.name}</span></div>
                            <label className="field"><span className="field-label">Cardinality</span><select className="select" value={relationship.cardinality} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { cardinality: event.target.value as Cardinality })}><option value="one_to_one">One to one</option><option value="one_to_many">One to many</option><option value="many_to_one">Many to one</option></select></label>
                            {relationship.cardinality !== "one_to_one" && <label className="field"><span className="field-label">Many-side label</span><Input value={relationship.manyLabel} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { manyLabel: event.target.value })} /></label>}
                            <div className="field-row"><label className="field"><span className="field-label">On update</span><select className="select" value={relationship.updateConstraint} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { updateConstraint: event.target.value as Relationship["updateConstraint"] })}>{RELATIONSHIP_CONSTRAINTS.map((constraint) => <option key={constraint}>{constraint}</option>)}</select></label><label className="field"><span className="field-label">On delete</span><select className="select" value={relationship.deleteConstraint} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { deleteConstraint: event.target.value as Relationship["deleteConstraint"] })}>{RELATIONSHIP_CONSTRAINTS.map((constraint) => <option key={constraint}>{constraint}</option>)}</select></label></div>
                            <div className="relationship-pairs"><div className="field-label">Composite key</div>{pairs.map((pair, index) => { const start = schema.tables.find((table) => table.id === relationship.startTableId); const end = schema.tables.find((table) => table.id === relationship.endTableId); return <div className="relationship-pair" key={`${pair.startFieldId}-${pair.endFieldId}-${index}`}><select className="select" value={pair.startFieldId} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { fields: pairs.map((item, pairIndex) => pairIndex === index ? { ...item, startFieldId: event.target.value } : item) })}>{start?.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select><select className="select" value={pair.endFieldId} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { fields: pairs.map((item, pairIndex) => pairIndex === index ? { ...item, endFieldId: event.target.value } : item) })}>{end?.columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}</select>{pairs.length > 1 && <Button className="icon-btn danger" aria-label="Remove relationship field pair" isDisabled={readOnly} onClick={() => patchRelationship(relationship.id, { fields: pairs.filter((_, pairIndex) => pairIndex !== index) })}><Trash2 size={13} /></Button>}</div>; })}<Button className="btn" isDisabled={readOnly || pairs.length >= Math.min(startTable?.columns.length ?? 0, endTable?.columns.length ?? 0)} onClick={() => { const start = startTable?.columns.find((column) => !pairs.some((pair) => pair.startFieldId === column.id)); const end = endTable?.columns.find((column) => !pairs.some((pair) => pair.endFieldId === column.id)); if (start && end) patchRelationship(relationship.id, { fields: [...pairs, { startFieldId: start.id, endFieldId: end.id }] }); }}><Plus size={13} /> Add field</Button></div>
                            <Button className="btn danger relationship-delete" isDisabled={readOnly} onClick={() => deleteRelationship(relationship.id)}><Trash2 size={14} /> Delete relationship</Button>
                          </div>
                        )}
                      </section>
                    );
                  })
              )}
            </div>
          )}

          <div className="panel-footer">
            <span className="counter" title="Tables">
              <Database size={14} /> {schema.tables.length}
            </span>
            <span className="counter" title="Relationships">
              <Link2 size={14} /> {relationshipRows.length}
            </span>
            <div className="segmented" role="group" aria-label="Panel view">
              <button
                type="button"
                className={panelMode === "structure" ? "active" : ""}
                aria-pressed={panelMode === "structure"}
                onClick={() => setPanelMode("structure")}
              >
                <LayoutGrid size={13} /> Structure
              </button>
              <button
                type="button"
                className={panelMode === "code" ? "active" : ""}
                aria-pressed={panelMode === "code"}
                onClick={() => setPanelMode("code")}
              >
                <Code2 size={13} /> Code
              </button>
            </div>
          </div>

          <div className={`issues-bar ${issuesOpen ? "open" : ""}`}>
            <button
              type="button"
              className="issues-head"
              aria-expanded={issuesOpen}
              onClick={() => setIssuesOpen((open) => !open)}
            >
              <AlertTriangle
                size={15}
                className={errors.length ? "warn danger" : "warn"}
              />
              <span>Issues</span>
              <span className={`issue-count ${errors.length ? "bad" : ""}`}>
                {issues.length}
              </span>
              <ChevronDown size={15} className="issues-chevron" />
            </button>
            {issuesOpen && (
              <div className="issues-list">
                {!issues.length ? (
                  <p className="issues-empty">No problems found.</p>
                ) : (
                  issues.slice(0, 40).map((issue) => (
                    <button
                      type="button"
                      className={`issue ${issue.severity}`}
                      key={`${issue.message}-${issue.columnId ?? issue.tableId ?? ""}`}
                      onClick={() =>
                        issue.tableId && setSelectedId(issue.tableId)
                      }
                    >
                      {issue.message}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {!sidebarOpen && (
          <button
            type="button"
            className="panel-reveal"
            aria-label="Show side panel"
            onClick={() => setSidebarOpen(true)}
          >
            <ChevronRight size={16} />
          </button>
        )}

        <div
          ref={canvasRef}
          className={`canvas-wrap ${grabbing ? "grabbing" : ""}`}
          onPointerDown={onCanvasDown}
          onPointerMove={(event) =>
            linking &&
            setLinking((current) =>
              current ? { ...current, ...canvasPoint(event) } : current,
            )
          }
          onPointerUp={finishLinking}
          onPointerCancel={(event) => {
            if (linking?.pointerId === event.pointerId) setLinking(null);
          }}
        >
          <div
            className="canvas"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              willChange: grabbing || dragPosition ? "transform" : undefined,
            }}
          >
            {(schema.groups ?? []).map((group) => {
              const position = liveGroup(group);
              const palette = GROUP_PALETTE[group.color];
              const selectedGroup = selectedGroupId === group.id;
              const moving = dragGroupPosition?.id === group.id;
              return (
                <section
                  className={`schema-group ${selectedGroup ? "selected" : ""} ${moving ? "moving" : ""}`}
                  key={group.id}
                  role="group"
                  aria-label={`Schema group ${group.name}`}
                  style={{
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                    width: position.width,
                    height: position.height,
                    background: palette.background,
                    borderColor: palette.border,
                    zIndex: 0,
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedGroupId(group.id);
                    setSelectedId(null);
                    setSelectedMemoId(null);
                  }}
                >
                  <div
                    className="schema-group-head"
                    style={{ background: palette.header, color: palette.text, borderColor: palette.border }}
                    onPointerDown={(event) => onGroupDown(event, group)}
                  >
                    <Database size={15} aria-hidden="true" />
                    <input
                      className="schema-group-name"
                      aria-label={`Name of schema group ${group.name}`}
                      value={group.name}
                      disabled={readOnly}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => patchGroup(group.id, { name: event.target.value })}
                    />
                    <div className="schema-group-actions" onPointerDown={(event) => event.stopPropagation()}>
                      {Object.entries(GROUP_PALETTE).map(([color, option]) => (
                        <button
                          type="button"
                          key={color}
                          className={`schema-group-color ${group.color === color ? "active" : ""}`}
                          aria-label={`Use ${color} group color`}
                          aria-pressed={group.color === color}
                          disabled={readOnly}
                          style={{ background: option.border }}
                          onClick={() => patchGroup(group.id, { color: color as SchemaGroup["color"] })}
                        />
                      ))}
                      <button type="button" className="schema-group-delete" aria-label={`Delete schema group ${group.name}`} disabled={readOnly} onClick={() => deleteGroup(group.id)}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <button type="button" className="schema-group-resize" aria-label={`Resize schema group ${group.name}`} disabled={readOnly} onPointerDown={(event) => onGroupResizeDown(event, group)} />
                </section>
              );
            })}
            {(schema.memos ?? []).map((memo) => {
              const position = liveMemo(memo);
              const color = MEMO_COLORS.find((item) => item.id === memo.color) ?? MEMO_COLORS[0];
              const selectedMemo = selectedMemoId === memo.id;
              return (
                <article
                  className={`memo-card ${selectedMemo ? "selected" : ""}`}
                  key={memo.id}
                  role="group"
                  tabIndex={0}
                  aria-label="Memo"
                  style={{
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                    width: position.width,
                    height: position.height,
                    background: color.background,
                    borderColor: color.border,
                    zIndex: selectedMemo ? 4 : 1,
                  }}
                  onPointerDown={(event) => onMemoDown(event, memo)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(null);
                    setSelectedMemoId(memo.id);
                  }}
                  onKeyDown={(event) => {
                    if ((event.key === "Delete" || event.key === "Backspace") && document.activeElement?.tagName !== "TEXTAREA") {
                      event.preventDefault();
                      deleteMemo(memo.id);
                    }
                  }}
                >
                  <div className="memo-toolbar" onPointerDown={(event) => onMemoDown(event, memo)}>
                    <StickyNote size={14} aria-hidden="true" />
                    <span className="memo-drag-label">Memo</span>
                    <div className="memo-actions" onPointerDown={(event) => event.stopPropagation()}>
                      {MEMO_COLORS.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          className={`memo-color memo-color-${option.id} ${memo.color === option.id ? "active" : ""}`}
                          aria-label={`Use ${option.label} memo color`}
                          aria-pressed={memo.color === option.id}
                          onClick={() => patchMemo(memo.id, { color: option.id })}
                        />
                      ))}
                      <button
                        type="button"
                        className="memo-delete"
                        aria-label="Delete memo"
                        onClick={() => deleteMemo(memo.id)}
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="memo-text"
                    value={memo.text}
                    aria-label="Memo text"
                    placeholder="Write a memo..."
                    onFocus={() => {
                      setSelectedId(null);
                      setSelectedMemoId(memo.id);
                      setEditingMemoId(memo.id);
                    }}
                    onChange={(event) => patchMemo(memo.id, { text: event.target.value })}
                    onBlur={() => {
                      setEditingMemoId((current) => current === memo.id ? null : current);
                      if (!memo.text.trim()) deleteMemo(memo.id);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="memo-resize"
                    aria-label="Resize memo"
                    onPointerDown={(event) => onMemoResizeDown(event, memo)}
                  />
                  {editingMemoId === memo.id && <span className="memo-edit-hint">Editing</span>}
                </article>
              );
            })}
            <svg
              className="edges"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              aria-hidden="true"
            >
            {relationships.map((relationship) => {
                const from = relationshipPoint(
                  relationship.from,
                  relationship.fromIndex,
                  relationship.to,
                );
                const to = relationshipPoint(
                  relationship.to,
                  relationship.toIndex,
                  relationship.from,
                );
                const deltaX = to.x - from.x;
                const deltaY = to.y - from.y;
                const midpointX = from.x + deltaX / 2;
                const radius = Math.min(10, Math.abs(deltaX) / 2, Math.abs(deltaY) / 2);
                const horizontalDirection = Math.sign(deltaX) || 1;
                const verticalDirection = Math.sign(deltaY) || 1;
                const path = Math.abs(deltaY) <= 36
                  ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
                  : `M ${from.x} ${from.y} H ${midpointX - horizontalDirection * radius} Q ${midpointX} ${from.y} ${midpointX} ${from.y + verticalDirection * radius} V ${to.y - verticalDirection * radius} Q ${midpointX} ${to.y} ${midpointX + horizontalDirection * radius} ${to.y} H ${to.x}`;
                const [fromCardinality, toCardinality] = relationshipCardinalities(relationship.relationship);
                // Keep the markers outside the table cards. The SVG is painted
                // before the cards, so markers placed exactly on the endpoints
                // would be covered by the card backgrounds.
                const markerDistance = 28;
                const fromMarker = from.axis === "horizontal"
                  ? { x: from.x + Math.sign(to.x - from.x || relationship.to.x - relationship.from.x) * markerDistance, y: from.y }
                  : { x: from.x, y: from.y + Math.sign(to.y - from.y || relationship.to.y - relationship.from.y) * markerDistance };
                const toMarker = to.axis === "horizontal"
                  ? { x: to.x - Math.sign(to.x - from.x || relationship.to.x - relationship.from.x) * markerDistance, y: to.y }
                  : { x: to.x, y: to.y - Math.sign(to.y - from.y || relationship.to.y - relationship.from.y) * markerDistance };
                const active =
                  selectedId === relationship.from.id ||
                  selectedId === relationship.to.id;
                return (
                  <g className="relationship" key={relationship.id}>
                    {/* Invisible fat stroke so the thin line is easy to hover. */}
                    <path d={path} className="relationship-hit" />
                    <path
                      d={path}
                      className={`relationship-path ${active ? "active" : ""}`}
                    />
                    {relationSettings.showCardinality && <>
                      <rect className="relationship-marker" x={fromMarker.x - 14} y={fromMarker.y - 12} width="28" height="24" rx="12" />
                      <text className="relationship-marker-text" x={fromMarker.x} y={fromMarker.y}>{fromCardinality}</text>
                      <rect className="relationship-marker" x={toMarker.x - 14} y={toMarker.y - 12} width="28" height="24" rx="12" />
                      <text className="relationship-marker-text" x={toMarker.x} y={toMarker.y}>{toCardinality}</text>
                    </>}
                    {relationSettings.showRelationshipLabels && <text className="relationship-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2} textAnchor="middle">{relationship.relationship.name}</text>}
                  </g>
                );
              })}
            </svg>
            {schema.tables.map((table) => {
              const position = livePosition(table);
              const moving = dragPosition?.id === table.id;
              return (
                <div
                  className={`table-card ${selectedId === table.id ? "selected" : ""} ${moving ? "moving" : ""}`}
                  key={table.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedId === table.id}
                  aria-label={`Table ${table.name}, ${table.columns.length} columns. Arrow keys move it.`}
                  style={{
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                    willChange: moving ? "transform" : undefined,
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setSelectedId(table.id);
                  }}
                  onKeyDown={(event) => onCardKeyDown(event, table)}
                >
                  <div
                    className="table-strip"
                    style={{ background: table.color.a }}
                    aria-hidden="true"
                  />
                  <div
                    className="table-head"
                    onPointerDown={(event) => onHeaderDown(event, table)}
                  >
                    <span className="table-name">
                      {table.name.toUpperCase()}
                    </span>
                    <span className="table-strategy">
                      {table.keyStrategy === "sequence-trigger"
                        ? "SEQ+TRG"
                        : table.keyStrategy === "identity"
                          ? "IDENTITY"
                          : ""}
                    </span>
                  </div>
                  {table.columns.map((column) => (
                    <div
                      className="table-row"
                      key={column.id}
                      data-table-id={table.id}
                      data-column-id={column.id}
                    >
                      <span
                        className="row-grip"
                        role="button"
                        tabIndex={0}
                        aria-label={`Link ${table.name}.${column.name}`}
                        onPointerDown={(event) =>
                          startLinking(
                            event,
                            table,
                            column,
                            table.columns.indexOf(column),
                          )
                        }
                        aria-hidden="false"
                      />
                      <span className="row-name">
                        {column.name.toUpperCase()}
                      </span>
                      <span className="row-meta">
                        {column.pk && <KeyRound size={13} aria-hidden="true" />}
                        {column.fk && (
                          <Link2
                            size={13}
                            className="fk-dot"
                            aria-hidden="true"
                          />
                        )}
                        {!column.notNull && !column.pk && (
                          <span className="row-nullable" title="Nullable">
                            ?
                          </span>
                        )}
                        <span
                          className="row-type"
                          style={{ color: typeColorVar(column.type) }}
                        >
                          {column.type}
                          {column.size ? `(${column.size})` : ""}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {linking && (
            <svg
              className="linking-overlay"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              }}
              aria-hidden="true"
            >
              <path
                d={`M ${linking.startX} ${linking.startY} L ${linking.x} ${linking.y}`}
              />
            </svg>
          )}

          <div className="dock" role="toolbar" aria-label="Canvas controls">
            <button
              type="button"
              aria-label="Tidy up layout"
              onClick={autoLayout}
            >
              <LayoutGrid size={17} />
            </button>
            <span className="dock-divider" />
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => zoomBy(-0.1)}
            >
              <ZoomOut size={17} />
            </button>
            <span className="dock-zoom" aria-live="polite" aria-atomic="true">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => zoomBy(0.1)}
            >
              <ZoomIn size={17} />
            </button>
            <span className="dock-divider" />
            <button
              type="button"
              aria-label="Undo"
              disabled={!history.length}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
            <button
              type="button"
              aria-label="Redo"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={17} />
            </button>
            <span className="dock-divider" />
            <button type="button" aria-label="Add table" onClick={addTable}>
              <TablePlus size={17} />
            </button>
            <button type="button" aria-label="Add schema group" onClick={addGroup}>
              <Database size={17} />
            </button>
            <button type="button" aria-label="Add memo" onClick={addMemo}>
              <StickyNote size={17} />
            </button>
            <button
              type="button"
              aria-label="Add junction table"
              disabled={!selected}
              onClick={makeJunction}
            >
              <Link2 size={17} />
            </button>
            <button type="button" aria-label="Fit to screen" onClick={fitView}>
              <Maximize2 size={17} />
            </button>
            <span className="dock-divider" />
            <button
              type="button"
              aria-label="Save to database"
              onClick={() => void save()}
            >
              <Save size={17} />
            </button>
            <button
              type="button"
              aria-label="Export SQL"
              onClick={() => setModal("export")}
            >
              <Download size={17} />
            </button>
          </div>
        </div>
      </div>

      {modal === "share" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div className="modal share-modal" role="dialog" aria-modal="true" aria-label="Share project" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-head">
              <div><strong>Share project</strong><div className="brand-sub">Invite people to collaborate on this diagram.</div></div>
              <Button className="btn ghost" aria-label="Close dialog" onClick={() => setModal(null)}><X size={15} /></Button>
            </div>
            <section className="share-section">
              <h3>Project invite link</h3>
              <p>Anyone with the link can preview the project. Sign-in is required to edit.</p>
              {shareLink ? <div className="share-link-row"><Input aria-label="Project invite link" value={shareLink} readOnly /><Button className="btn" onClick={() => void copyShareText(shareLink)}><Copy size={15} /> Copy</Button></div> : <Button className="btn primary" isDisabled={shareBusy} onClick={() => void generateShareLink()}>{shareBusy ? "Generating…" : "Generate invite link"}</Button>}
              {shareLink && <Button className="btn danger" isDisabled={shareBusy} onClick={() => { if (window.confirm("Revoke this link and generate a new one?")) void generateShareLink(); }}>{shareBusy ? "Generating…" : "Revoke and generate new link"}</Button>}
            </section>
            {workspaceSlug && <section className="share-section">
              <h3>Invite to workspace</h3>
              <p>Send a single-use invitation to a workspace member.</p>
              <div className="share-link-row"><Input aria-label="Invitee email" type="email" placeholder="person@example.com" value={workspaceEmail} onChange={(event) => setWorkspaceEmail(event.target.value)} /><Button className="btn primary" isDisabled={workspaceInviteBusy || !workspaceEmail.trim()} onClick={() => void inviteToWorkspace()}>{workspaceInviteBusy ? "Generating…" : "Generate link"}</Button></div>
              {workspaceInviteLink && <div className="share-link-row"><Input aria-label="Workspace invitation link" value={workspaceInviteLink} readOnly /><Button className="btn" onClick={() => void copyShareText(workspaceInviteLink)}><Copy size={15} /> Copy</Button></div>}
            </section>}
            {shareError && <p className="error-text">{shareError}</p>}
          </div>
        </div>
      )}

      {modal === "export" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Export SQL"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div className="tabs">
                {(
                  [
                    ["ddl", "DDL"],
                    ["plsql", "PL/SQL Packages"],
                    ["combined", "Combined"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    className={`tab ${exportTab === key ? "active" : ""}`}
                    key={key}
                    onClick={() => setExportTab(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="toolbar">
                <Button
                  className="btn ghost"
                  aria-label="Copy export"
                  onClick={copyOutput}
                >
                  {copied ? (
                    <Check size={15} color="var(--type-binary)" />
                  ) : (
                    <Copy size={15} />
                  )}
                </Button>
                <Button
                  className="btn ghost"
                  aria-label="Download export"
                  onClick={download}
                >
                  <Download size={15} />
                </Button>
                <Button
                  className="btn ghost"
                  aria-label="Close dialog"
                  onClick={() => setModal(null)}
                >
                  <X size={15} />
                </Button>
              </div>
            </div>
            {errors.length > 0 && (
              <div className="issue-strip danger">
                <X size={14} />
                <span className="issue-strip-copy">
                  Export blocked: {errors[0].message} ({errors.length} error(s))
                </span>
                <Button className="btn" onClick={clearInvalidForeignKeys}>
                  Clear invalid references
                </Button>
              </div>
            )}
            <pre className="code">
              <code>{highlightSql(output)}</code>
            </pre>
          </div>
        </div>
      )}

      {modal === "import" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Import Oracle DDL"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <strong>Import Oracle DDL</strong>
                <div className="brand-sub">
                  Supported CREATE TABLE subset · all-or-nothing
                </div>
              </div>
              <Button
                className="btn ghost"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={15} />
              </Button>
            </div>
            <div className="import-area">
              <div className="sql-editor">
                <pre
                  ref={importHighlightRef}
                  className="sql-highlight"
                  aria-hidden="true"
                >
                  <code>{highlightSql(importText)}</code>
                </pre>
                <Textarea
                  aria-label="Oracle DDL input"
                  className="textarea sql-input"
                  placeholder="CREATE TABLE STUDENT ( ID NUMBER NOT NULL, NAME VARCHAR2(100), CONSTRAINT PK_STUDENT PRIMARY KEY (ID) );"
                  value={importText}
                  onScroll={(event) => {
                    if (importHighlightRef.current) {
                      importHighlightRef.current.scrollTop =
                        event.currentTarget.scrollTop;
                      importHighlightRef.current.scrollLeft =
                        event.currentTarget.scrollLeft;
                    }
                  }}
                  onChange={(event) => setImportText(event.target.value)}
                />
              </div>
              {importMessage && (
                <div
                  className={`parse-result ${importMessage.ok ? "" : "parse-error"}`}
                >
                  {importMessage.text}
                </div>
              )}
              <div className="toolbar">
                <Button className="btn" onClick={() => setImportText(ddl)}>
                  Use current export
                </Button>
                <Button className="btn primary" onClick={importSchema}>
                  <FileUp size={15} /> Parse and replace
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div
            className={`toast ${toast.tone === "error" ? "toast-error" : ""}`}
          >
            {toast.tone === "error" ? <X size={14} /> : <Check size={14} />}
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}
