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
  Check,
  ChevronDown,
  Copy,
  Database,
  Download,
  FileUp,
  Grid3X3,
  Home,
  KeyRound,
  LayoutGrid,
  Link2,
  Minus,
  PanelLeft,
  Plus,
  Redo2,
  Search,
  Save,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { exportSchema, generateDDL, generatePLSQL } from "@/app/lib/generators";
import { parseCreateTable } from "@/app/lib/parser";
import { chipBackgroundOn, readableTextOn } from "@/app/lib/color";
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
  makeDemoSchema,
  makeTable,
  ORACLE_TYPES,
  primaryKeyColumns,
  tableHeight,
  typeSizePlaceholder,
  typeUsesSize,
  type Schema,
  type Table,
  type Column,
  type KeyStrategy,
} from "@/app/lib/schema";
import { validateSchema } from "@/app/lib/validation";

const TABLE_WIDTH = 236;
const HEADER_HEIGHT = 38;
const ROW_HEIGHT = 27;
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

export default function Designer() {
  const [schema, setSchema] = useState<Schema>(() => makeDemoSchema());
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
  /** Keeps the sheet mounted long enough to exit along the path it entered on. */
  const [closingSheet, setClosingSheet] = useState(false);
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

  const save = async () => {
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ schema }),
      });
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
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  /** Plays the exit, then drops the selection. Instant when motion is reduced. */
  const closeSheet = useCallback(() => {
    if (prefersReducedMotion()) {
      setSelectedId(null);
      return;
    }
    setClosingSheet(true);
    setTimeout(() => {
      setSelectedId(null);
      setClosingSheet(false);
    }, 180);
  }, []);

  /** Escape closes the topmost layer — sheet, then modal. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (modal) setModal(null);
      else if (selectedId) closeSheet();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, selectedId, closeSheet]);

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

  return (
    <div className={`designer light`}>
      <header className="topbar">
        <div className="reference-nav">
          <Button className="reference-nav-button"><Home size={15} /> Dashboard</Button>
          <Button className="reference-nav-button"><Grid3X3 size={15} /> Diagrams</Button>
          <span className="reference-separator">•</span>
          <strong className="reference-page-title">Diagram Editor</strong>
          <span className="reference-separator">•</span>
          <input className="diagram-name" aria-label="Diagram name" defaultValue="Oracle Demo" />
        </div>
        <Button
          className="btn ghost sidebar-toggle"
          aria-label={sidebarOpen ? "Hide tables sidebar" : "Show tables sidebar"}
          aria-expanded={sidebarOpen}
          aria-controls="tables-sidebar"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          <PanelLeft size={16} />
        </Button>
        <div className="toolbar">
          <div className="toolbar-group">
            <Button
              className="btn ghost"
              aria-label="Undo last change"
              onClick={undo}
              isDisabled={!history.length}
            >
              <Undo2 size={16} />
            </Button>
            <Button
              className="btn ghost"
              aria-label="Redo last change"
              onClick={redo}
              isDisabled={!future.length}
            >
              <Redo2 size={16} />
            </Button>
          </div>
          <div className="toolbar-group">
            <Button className="btn" onClick={addTable}>
              <Plus size={15} /> Table
            </Button>
            <Button className="btn" onClick={() => setModal("import")}>
              <FileUp size={15} /> Import
            </Button>
            <Button className="btn" onClick={save}>
              <Save size={15} /> Save
            </Button>
            <Button className="btn primary" onClick={() => setModal("export")}>
              <Download size={15} /> Export
            </Button>
          </div>
        </div>
      </header>
      <section className={`workspace ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        <aside
          id="tables-sidebar"
          className={`tables-sidebar ${sidebarOpen ? "open" : ""}`}
          aria-label="Tables"
          aria-hidden={!sidebarOpen}
          inert={!sidebarOpen}
        >
          <div className="sidebar-head">
            <div className="sidebar-title">
              <Database size={16} />
              <strong>Database Tables</strong>
              <Badge variant="secondary">{schema.tables.length}</Badge>
            </div>
            <Button
              className="btn ghost sidebar-collapse"
              aria-label="Collapse tables sidebar"
              onClick={() => {
                setTableQuery("");
                setSidebarOpen(false);
              }}
            >
              <ChevronDown size={15} />
            </Button>
          </div>
          <Button className="sidebar-add" onClick={addTable}>
            <Plus size={15} /> Add table
          </Button>
          <label className="sidebar-search">
            <Search size={14} />
            <Input
              aria-label="Search tables"
              placeholder="Search tables"
              value={tableQuery}
              onChange={(event) => setTableQuery(event.target.value)}
            />
          </label>
          <div className="table-list">
            {filteredTables.map((table) => (
              <button
                className={`table-list-item ${selectedId === table.id ? "active" : ""}`}
                key={table.id}
                type="button"
                aria-current={selectedId === table.id ? "true" : undefined}
                onClick={() => setSelectedId(table.id)}
              >
                <span
                  className="table-list-swatch"
                  style={{ background: table.color.a }}
                  aria-hidden="true"
                />
                <span className="table-list-copy">
                  <strong>{table.name.toUpperCase()}</strong>
                  <small>{table.columns.length} columns</small>
                </span>
                <span className="table-list-more" aria-hidden="true">
                  ···
                </span>
              </button>
            ))}
            {!filteredTables.length && (
              <div className="sidebar-empty">No tables found</div>
            )}
          </div>
        </aside>
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
            <svg className="edges" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-hidden="true">
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
                return (
                  <g key={relationship.id}>
                    <path
                      d={
                        horizontal
                          ? `M ${from.x} ${from.y} C ${from.x + midpoint} ${from.y}, ${to.x - midpoint} ${to.y}, ${to.x} ${to.y}`
                          : `M ${from.x} ${from.y} C ${from.x} ${from.y + midpoint}, ${to.x} ${to.y - midpoint}, ${to.x} ${to.y}`
                      }
                      fill="none"
                      stroke={
                        selectedId === relationship.from.id ||
                        selectedId === relationship.to.id
                          ? "var(--primary)"
                          : "var(--border)"
                      }
                      strokeWidth="1.8"
                    />
                    <circle cx={from.x} cy={from.y} r="3" fill="var(--accent)" />
                    <circle cx={to.x} cy={to.y} r="3" fill="var(--primary)" />
                  </g>
                );
              })}
            </svg>
            {schema.tables.map((table) => {
              const position = livePosition(table);
              const moving = dragPosition?.id === table.id;
              const ink = readableTextOn(table.color.b);
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
                  className="table-head"
                  style={{
                    background: `linear-gradient(135deg,${table.color.a},${table.color.b})`,
                    color: ink,
                  }}
                  onPointerDown={(event) => onHeaderDown(event, table)}
                >
                  <span className="table-name">{table.name.toUpperCase()}</span>
                  <Badge
                    variant="outline"
                    className="table-strategy"
                    style={{
                      background: chipBackgroundOn(table.color.b),
                      color: ink,
                      borderColor: "transparent",
                    }}
                  >
                    {table.keyStrategy === "sequence-trigger"
                      ? "SEQ + TRG"
                      : table.keyStrategy}
                  </Badge>
                </div>
                {table.columns.map((column) => (
                  <div className="table-row" key={column.id}>
                    <span className="row-icon">
                      {column.pk ? (
                        <KeyRound size={13} />
                      ) : column.fk ? (
                        <Link2 size={13} className="fk-dot" />
                      ) : (
                        <span />
                      )}
                    </span>
                    <span className="row-name">
                      {column.name.toUpperCase()}
                    </span>
                    <span className="row-type">
                      {column.type}
                      {column.size ? `(${column.size})` : ""}
                    </span>
                  </div>
                ))}
              </div>
              );
            })}
          </div>
        </div>
        <div className="canvas-hud">
          <Button className="btn" aria-label="Zoom out" onClick={() => zoomBy(-0.1)}>
            <ZoomOut size={14} />
          </Button>
          <span className="zoom-label" aria-live="polite" aria-atomic="true">
            {Math.round(zoom * 100)}%
          </span>
          <Button className="btn" aria-label="Zoom in" onClick={() => zoomBy(0.1)}>
            <ZoomIn size={14} />
          </Button>
          <Button className="btn" onClick={fitView}>
            Fit
          </Button>
          <Button className="btn" onClick={autoLayout}>
            <LayoutGrid size={14} /> Tidy up
          </Button>
        </div>
        {selected && (
          <div
            className={`table-edit-modal-backdrop ${closingSheet ? "closing" : ""}`}
            onMouseDown={closeSheet}
          >
          <div
            className="table-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Edit table ${selected.name}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <div className="drawer-title">
                <Database size={16} color="var(--primary)" />
                <input
                  aria-label="Table name"
                  value={selected.name}
                  onChange={(event) =>
                    patchTable(selected.id, { name: event.target.value })
                  }
                />
                <span className="muted">{selected.columns.length} columns</span>
              </div>
              <div className="drawer-actions">
                <Button
                  className="btn ghost danger"
                  aria-label={`Delete table ${selected.name}`}
                  onClick={() => deleteTable(selected.id)}
                >
                  <Trash2 size={16} />
                </Button>
                <Button
                  className="btn ghost"
                  aria-label="Close table editor"
                  onClick={closeSheet}
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
            <Separator className="drawer-separator" />
            <div className="drawer-content">
              <div className="drawer-toolbar">
                <span className="field-label">Key generation</span>
                <div className="strategy">
                  <select
                    aria-label="Key generation strategy"
                    className="select"
                    value={selected.keyStrategy}
                    onChange={(event) =>
                      patchTable(selected.id, {
                        keyStrategy: event.target.value as KeyStrategy,
                      })
                    }
                  >
                    <option value="sequence-trigger">Sequence + trigger</option>
                    <option value="identity">Generated identity</option>
                    <option value="none">Manual / none</option>
                  </select>
                  {primaryKeyColumns(selected).length > 1 && (
                    <span className="muted">
                      Composite PK: manual generation required
                    </span>
                  )}
                </div>
                <Button className="btn" onClick={makeJunction}>
                  <Link2 size={14} /> Junction
                </Button>
                <Button className="btn" onClick={() => addColumn(selected.id)}>
                  <Plus size={14} /> Add column
                </Button>
              </div>
              {selected.columns.map((column) => (
                <div className="column-grid" key={column.id}>
                  <div className="cell">
                    <Input
                      className="input"
                      value={column.name}
                      onChange={(event) =>
                        patchColumn(selected.id, column.id, {
                          name: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="cell">
                    <select
                      aria-label={`Datatype for ${column.name}`}
                      className="select"
                      value={column.type}
                      onChange={(event) =>
                        patchColumn(selected.id, column.id, {
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
                        style={{ marginTop: 5 }}
                        placeholder={typeSizePlaceholder(column.type)}
                        value={column.size}
                        onChange={(event) =>
                          patchColumn(selected.id, column.id, {
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
                          patchColumn(selected.id, column.id, {
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
                          patchColumn(selected.id, column.id, {
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
                          patchColumn(selected.id, column.id, {
                            unique: isSelected,
                          })
                        }
                      />
                      UQ
                    </label>
                  </div>
                  <div className="cell">
                    <Input
                      className="input"
                      placeholder="DEFAULT expression"
                      value={column.defaultValue}
                      onChange={(event) =>
                        patchColumn(selected.id, column.id, {
                          defaultValue: event.target.value,
                        })
                      }
                    />
                    <Input
                      className="input"
                      style={{ marginTop: 5 }}
                      placeholder="CHECK expression"
                      value={column.check}
                      onChange={(event) =>
                        patchColumn(selected.id, column.id, {
                          check: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="cell">
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
                          patchColumn(selected.id, column.id, {
                            fk:
                              tableId && columnId
                                ? { tableId, columnId }
                                : null,
                          });
                        }}
                      >
                        <option value="">No reference</option>
                        {compatibleForeignKeyTargets(column).map(
                          ({ table, target }) => (
                            <option
                              key={`${table.id}::${target.id}`}
                              value={`${table.id}::${target.id}`}
                            >
                              {table.name.toUpperCase()}.
                              {target.name.toUpperCase()}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </div>
                  <Button
                    className="btn ghost danger"
                    aria-label={`Delete column ${column.name}`}
                    onClick={() => deleteColumn(selected.id, column.id)}
                  >
                    <X size={15} />
                  </Button>
                </div>
              ))}
            </div>
            {issues
              .filter((issue) => issue.tableId === selected.id)
              .slice(0, 2)
              .map((issue) => (
                <div className="issue-strip" key={issue.message}>
                  <ChevronDown size={14} />
                  {issue.message}
                </div>
              ))}
          </div>
          </div>
        )}
      </section>
      {modal === "export" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div
            className="modal"
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
                    <Check size={15} color="var(--chart-3)" />
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
            <pre className="code"><code>{highlightSql(output)}</code></pre>
          </div>
        </div>
      )}
      {modal === "import" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div
            className="modal"
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
                      importHighlightRef.current.scrollTop = event.currentTarget.scrollTop;
                      importHighlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
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
