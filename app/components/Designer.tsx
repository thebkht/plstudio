"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  makeColumn,
  makeTable,
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
} from "@/app/lib/schema";
import { validateSchema } from "@/app/lib/validation";
import { authClient } from "@/app/lib/auth-client";

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
              <div className="menu-separator" key={`sep-${index}`} role="none" />
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

export default function Designer({ initialSchema, projectId, workspaceSlug }: { initialSchema: Schema; projectId: string; workspaceSlug: string }) {
  const router = useRouter();
  const [schema, setSchema] = useState<Schema>(() => initialSchema);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const [grabbing, setGrabbing] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(
    null,
  );
  const [modal, setModal] = useState<"export" | "import" | null>(null);
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
  const [panelTab, setPanelTab] = useState<"tables" | "relationships">("tables");
  const [panelMode, setPanelMode] = useState<"structure" | "code">("structure");
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const lastSavedNameRef = useRef(initialSchema.name);
  const canvasRef = useRef<HTMLDivElement>(null);
  const importHighlightRef = useRef<HTMLPreElement>(null);
  /**
   * Gesture state lives in refs, not state: it updates every pointermove and
   * must not schedule a React render per frame.
   */
  const gestureRef = useRef<{
    mode: "table" | "pan";
    pointerId: number;
    tableId?: string;
    grabX: number;
    grabY: number;
    originX: number;
    originY: number;
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
  dragPositionRef.current = dragPosition;

  /** A table's on-screen position: the in-flight one while it moves, else its committed one. */
  const livePosition = useCallback(
    (table: Table) =>
      dragPosition && dragPosition.id === table.id
        ? { x: dragPosition.x, y: dragPosition.y }
        : { x: table.x, y: table.y },
    [dragPosition],
  );
  const selected =
    schema.tables.find((table) => table.id === selectedId) ?? null;
  const filteredTables = useMemo(() => {
    const query = tableQuery.trim().toUpperCase();
    return query
      ? schema.tables.filter((table) => table.name.toUpperCase().includes(query))
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
      setHistory((items) => [...items.slice(-49), cloneSchema(schema)]);
      setFuture([]);
      setSchema({ ...next, revision: schema.revision });
      setDirty(true);
    },
    [schema],
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
    (tableId: string, columnId: string, patch: Partial<Column>) =>
      commit({
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
      }),
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
    commit(next);
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
    commit({
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
    });

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [...items, cloneSchema(schema)]);
    setHistory((items) => items.slice(0, -1));
    setSchema(previous);
  };
  const redo = () => {
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
    if (!canvasRef.current || !schema.tables.length) return;
    stopAnimationRef.current?.();
    stopAnimationRef.current = null;
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 48;
    const minX = Math.min(...schema.tables.map((table) => table.x));
    const minY = Math.min(...schema.tables.map((table) => table.y));
    const maxX = Math.max(...schema.tables.map((table) => table.x + TABLE_WIDTH));
    const maxY = Math.max(
      ...schema.tables.map((table) => table.y + tableHeight(table)),
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

  const commitPosition = useCallback((id: string, x: number, y: number) => {
    setHistory((items) => [...items.slice(-49), cloneSchema(schemaRef.current)]);
    setFuture([]);
    setSchema((current) => ({
      ...current,
      tables: current.tables.map((table) =>
        table.id === id ? { ...table, x, y } : table,
      ),
    }));
    setDragPosition(null);
  }, []);

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
        Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) <
          DRAG_THRESHOLD
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
      const table = schemaRef.current.tables.find(
        (item) => item.id === gesture.tableId,
      );
      if (!rect || !table) return;
      const bounds = tableBounds(table);
      const rawX =
        (event.clientX - rect.left - panRef.current.x) / zoomRef.current - gesture.grabX;
      const rawY =
        (event.clientY - rect.top - panRef.current.y) / zoomRef.current - gesture.grabY;
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
        animateTo(current, target, velocity, flicked ? FLICK_SPRING : SETTLE_SPRING, setPan);
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
      const from = live && live.id === table.id ? { x: live.x, y: live.y } : current;
      const projected = {
        x: from.x + project(velocity.x),
        y: from.y + project(velocity.y),
      };
      const target = {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, projected.x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, projected.y)),
      };
      const flicked = Math.hypot(velocity.x, velocity.y) > 60;
      animateTo(
        from,
        target,
        velocity,
        flicked ? FLICK_SPRING : SETTLE_SPRING,
        (value) => setDragPosition({ id: table.id, ...value }),
        (value) => commitPosition(table.id, Math.round(value.x), Math.round(value.y)),
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
  }, [animateTo, commitPosition, panBounds, tableBounds]);

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
        setPan({ x: pointer.x - world.x * next, y: pointer.y - world.y * next });
        return;
      }

      const bounds = panBounds(zoomRef.current);
      setPan((current) => ({
        x: Math.max(bounds.minX, Math.min(bounds.maxX, current.x - event.deltaX)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, current.y - event.deltaY)),
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
    commit({ ...schema, tables: [...schema.tables, junction] });
    setSelectedId(junction.id);
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
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
    commit(next);
  };

  const save = async (overwrite = false) => {
    try {
      const response = await fetch(`/api/projects/${projectId}?workspace=${encodeURIComponent(workspaceSlug)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schema, overwrite }),
      });
      if (response.ok) { const next = (await response.json()) as Schema; setSchema((current) => ({ ...current, revision: next.revision })); setDirty(false); lastSavedNameRef.current = next.name; }
      else if (response.status === 409) { setToast({ text: "This project changed elsewhere. Overwrite your save?", tone: "error" }); if (window.confirm("This project changed elsewhere. Overwrite the other changes?")) await save(true); return; }
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

  useEffect(() => { if (!dirty) return; const timer = window.setTimeout(() => void save(), 1500); return () => window.clearTimeout(timer); }, [dirty, schema, projectId, workspaceSlug]);

  useEffect(() => {
    if (schema.name === lastSavedNameRef.current) return;
    const timer = window.setTimeout(async () => {
      const response = await fetch(`/api/projects/${projectId}?workspace=${encodeURIComponent(workspaceSlug)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: schema.name, revision: schema.revision }) });
      if (response.ok) { const next = (await response.json()) as Schema; setSchema((current) => ({ ...current, revision: next.revision })); lastSavedNameRef.current = next.name; setDirty(false); }
      else if (response.status === 409) setToast({ text: "The name changed elsewhere.", tone: "error" });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [schema.name, schema.revision, projectId, workspaceSlug]);

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
        else if (selectedId) setSelectedId(null);
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
    () =>
      schema.tables.flatMap((table) =>
        table.columns.flatMap((column, index) => {
          if (!column.fk) return [];
          const target = schema.tables.find(
            (item) => item.id === column.fk?.tableId,
          );
          const targetIndex =
            target?.columns.findIndex(
              (item) => item.id === column.fk?.columnId,
            ) ?? -1;
          return target && targetIndex >= 0
            ? [
                {
                  from: table,
                  fromIndex: index,
                  to: target,
                  toIndex: targetIndex,
                  id: column.id,
                },
              ]
            : [];
        }),
      ),
    [schema],
  );
  const relationshipPoint = (
    table: Table,
    index: number,
    other: Table,
  ) => {
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
      x: origin.x + TABLE_WIDTH / 2,
      y: origin.y + (dy >= 0 ? tableHeight(table) : 0),
      axis: "vertical" as const,
    };
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
          fromId: relationship.from.id,
        };
      }),
    [relationships],
  );

  const fileMenu: MenuItem[] = [
    { label: "New diagram", onSelect: async () => { const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspace: workspaceSlug, name: "Untitled Diagram" }) }); if (response.ok) { const created = await response.json() as Schema; router.push(`/${workspaceSlug}/${created.id}`); } else setToast({ text: "Could not create project.", tone: "error" }); } },
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
    { label: "Add junction table", onSelect: makeJunction, disabled: !selected },
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
    { label: "Clear invalid references", onSelect: clearInvalidForeignKeys },
  ];
  const helpMenu: MenuItem[] = [
    {
      label: "Oracle target: 12.2+",
      onSelect: () =>
        setToast({ text: "Generating DDL for Oracle 12.2 and later.", tone: "ok" }),
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
    <div className="app">
      <header className="appbar">
        <div className="appbar-brand" aria-hidden="true">
          <Database size={22} />
        </div>
        <div className="appbar-main">
          <div className="appbar-title">
            <Database size={17} className="appbar-title-icon" />
            <a className="appbar-crumb" href={`/${workspaceSlug}`}>Diagrams</a>
            <span className="appbar-slash">/</span>
            <input
              className="appbar-name"
              aria-label="Diagram name"
              value={schema.name}
              onChange={(event) => {
                setSchema((current) => ({ ...current, name: event.target.value }));
                setDirty(true);
              }}
            />
          </div>
          <button className="appbar-user" type="button" onClick={() => void authClient.signOut().then(() => router.push("/login"))}><UserRound size={16} /> Sign out</button>
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
          <Button className="share-btn" onClick={() => setModal("export")}>
            <Share2 size={15} /> Share
          </Button>
          <button type="button" className="avatar-btn" aria-label="Account">
            <UserRound size={17} />
            <ChevronDown size={13} />
          </button>
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
                          setSelectedId(selectedId === table.id ? null : table.id)
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
                                  patchTable(table.id, { name: event.target.value })
                                }
                              />
                            </label>
                            <label className="field">
                              <span className="field-label">Key generation</span>
                              <select
                                className="select"
                                value={table.keyStrategy}
                                onChange={(event) =>
                                  patchTable(table.id, {
                                    keyStrategy: event.target.value as KeyStrategy,
                                  })
                                }
                              >
                                <option value="sequence-trigger">
                                  Sequence + trigger
                                </option>
                                <option value="identity">Generated identity</option>
                                <option value="none">Manual / none</option>
                              </select>
                            </label>
                          </div>
                          {primaryKeyColumns(table).length > 1 && (
                            <p className="hint">
                              Composite primary key — manual key generation required.
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
                                  onClick={() => deleteColumn(table.id, column.id)}
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
                                      type: event.target.value as Column["type"],
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
                                    placeholder={typeSizePlaceholder(column.type)}
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
            <div className="panel-body">
              {!relationshipRows.length ? (
                <div className="empty-state">
                  <div className="empty-art" aria-hidden="true">
                    <Link2 size={38} />
                  </div>
                  <strong>No relationships</strong>
                  <p>Give a column a foreign key to link two tables.</p>
                </div>
              ) : (
                relationshipRows.map((row) => (
                  <button
                    type="button"
                    className="relationship-row"
                    key={row.id}
                    onClick={() => setSelectedId(row.fromId)}
                  >
                    <Link2 size={14} aria-hidden="true" />
                    <span className="relationship-copy">
                      <strong>{row.from}</strong>
                      <small>references {row.to}</small>
                    </span>
                  </button>
                ))
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
                      onClick={() => issue.tableId && setSelectedId(issue.tableId)}
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
                const horizontal = from.axis === "horizontal";
                const midpoint = horizontal
                  ? (to.x - from.x) / 2
                  : (to.y - from.y) / 2;
                const path = horizontal
                  ? `M ${from.x} ${from.y} C ${from.x + midpoint} ${from.y}, ${to.x - midpoint} ${to.y}, ${to.x} ${to.y}`
                  : `M ${from.x} ${from.y} C ${from.x} ${from.y + midpoint}, ${to.x} ${to.y - midpoint}, ${to.x} ${to.y}`;
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
                    <span className="table-name">{table.name.toUpperCase()}</span>
                    <span className="table-strategy">
                      {table.keyStrategy === "sequence-trigger"
                        ? "SEQ+TRG"
                        : table.keyStrategy === "identity"
                          ? "IDENTITY"
                          : ""}
                    </span>
                  </div>
                  {table.columns.map((column) => (
                    <div className="table-row" key={column.id}>
                      <span className="row-grip" aria-hidden="true" />
                      <span className="row-name">{column.name.toUpperCase()}</span>
                      <span className="row-meta">
                        {column.pk && <KeyRound size={13} aria-hidden="true" />}
                        {column.fk && (
                          <Link2 size={13} className="fk-dot" aria-hidden="true" />
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

          <div className="dock" role="toolbar" aria-label="Canvas controls">
            <button
              type="button"
              aria-label="Tidy up layout"
              onClick={autoLayout}
            >
              <LayoutGrid size={17} />
            </button>
            <span className="dock-divider" />
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-0.1)}>
              <ZoomOut size={17} />
            </button>
            <span className="dock-zoom" aria-live="polite" aria-atomic="true">
              {Math.round(zoom * 100)}%
            </span>
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(0.1)}>
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
            <button type="button" aria-label="Save to database" onClick={() => void save()}>
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

          <button
            type="button"
            className="fab"
            aria-label="Add table"
            onClick={addTable}
          >
            <Plus size={22} />
          </button>
        </div>
      </div>

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
                Export blocked: {errors[0].message} ({errors.length} error(s))
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
          <div className={`toast ${toast.tone === "error" ? "toast-error" : ""}`}>
            {toast.tone === "error" ? <X size={14} /> : <Check size={14} />}
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}
