"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
  Copy01Icon,
  DatabaseIcon,
  Delete02Icon,
  Download04Icon,
  FingerPrintIcon,
  FloppyDiskIcon,
  GitMergeIcon,
  GridViewIcon,
  HandGrabIcon,
  Key01Icon,
  Layers01Icon,
  Link01Icon,
  Maximize01Icon,
  PanelLeftOpenIcon,
  PlusSignIcon,
  Search01Icon,
  Share08Icon,
  SourceCodeIcon,
  StickyNote01Icon,
  Table01Icon,
  Tag01Icon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useCollaborativeSchema,
  type CollabUser,
} from "@/app/lib/collab/useCollaborativeSchema";
import { PeerAvatars, PeerCursors } from "@/app/components/collab-presence";
import NavUser from "@/app/components/nav-user";
import { Alert, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { HoverCard } from "@/components/ui/hover-card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Input } from "@/components/ui/input";
import { generateDDL } from "@/app/lib/generators";
import {
  appendCreateTable,
  appendMermaidER,
  parseCreateTable,
  parseMermaidER,
} from "@/app/lib/parser";
import {
  exportSchemaJson,
  mergeSchemaJson,
  parseSchemaJson,
} from "@/app/lib/schema-json";
import {
  createSaveQueue,
  type SaveQueue,
  type SaveResult,
  type SaveState,
} from "@/app/lib/save-queue";
import {
  EMPTY_SELECTION,
  isSelected,
  marqueeSelection,
  moveSelection,
  movingEntities,
  pruneSelection,
  rectFromPoints,
  removeSelection,
  selectAll,
  selectOnly,
  selectionBounds,
  selectionCount,
  selectionSchema,
  toggleSelected,
  type CanvasSelection,
  type Rect,
  type SelectionKind,
} from "@/app/lib/selection";
import { typeColorVar } from "@/app/lib/datatype-color";
import {
  SHORTCUTS,
  SHORTCUT_GROUPS,
  isEditingTarget,
  isMacPlatform,
  matchShortcut,
  shortcutById,
  shortcutHint,
  type ShortcutId,
} from "@/app/lib/shortcuts";
import {
  FLICK_SPRING,
  SETTLE_SPRING,
  Spring,
  VelocityTracker,
  prefersReducedMotion,
  project,
  runFrameLoop,
  type Vec,
} from "@/app/lib/motion";
import {
  groupPrefix,
  GROUP_PALETTE,
  makeColumn,
  makeMemo,
  makeSchemaGroup,
  makeTable,
  normalizeRelationships,
  clampTableWidth,
  nextId,
  prefixTableName,
  RELATIONSHIP_CONSTRAINTS,
  ORACLE_TYPES,
  primaryKeyColumns,
  stripTablePrefix,
  tableHeight,
  tableWidth,
  typeSizePlaceholder,
  typeUsesSize,
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
import BrandMark from "@/app/components/brand-mark";
import {
  ColumnCard,
  ColumnFlag,
  DockButton,
  KEY_STRATEGY_LABEL,
  Menu,
  Menubar,
  ShortcutKeys,
  TableSummaryCard,
  type MenuItem,
} from "@/app/components/designer/primitives";
import { RelationshipEdge } from "@/app/components/designer/relationship-edge";
import { ExportModal } from "@/app/components/designer/export-modal";
import { ColumnList } from "@/app/components/designer/column-list";
import { highlightSql } from "@/app/components/designer/highlight";
import {
  ImportModal,
  type ImportMessage,
} from "@/app/components/designer/import-modal";
import { TableCard } from "./designer/table-card";
import {
  DRAG_THRESHOLD,
  GRID_DOT_RADIUS,
  GRID_FADE_END,
  GRID_FADE_START,
  GRID_SIZE,
  GROUP_HEADER_HEIGHT,
  GROUP_MIN_HEIGHT,
  GROUP_MIN_WIDTH,
  HEADER_HEIGHT,
  MAX_ZOOM,
  MEMO_COLORS,
  MEMO_MAX_HEIGHT,
  MEMO_MAX_WIDTH,
  MEMO_MIN_HEIGHT,
  MEMO_MIN_WIDTH,
  MIN_ZOOM,
  NO_GROUP,
  NO_REFERENCE,
  NUDGE,
  ROW_HEIGHT,
  TABLE_GAP,
  ZOOM_SENSITIVITY,
  ZOOM_STEP_LIMIT,
  type PanelMode,
  type PanelTab,
} from "./designer/constants";
import {
  enclosedBy,
  insideGroup,
  keywordHint,
  prepareCanvasSchema,
  resizeDelta,
  wheelScale,
} from "./designer/geometry";

export default function Designer({
  initialSchema,
  projectId,
  workspaceSlug,
  workspaceId,
  shareToken,
  readOnly = false,
  user,
}: {
  initialSchema: Schema;
  projectId: string;
  workspaceSlug?: string;
  workspaceId?: string;
  shareToken?: string;
  readOnly?: boolean;
  // The email is for the account menu only — never for presence, see below.
  user?: (CollabUser & { email?: string | null }) | null;
}) {
  const router = useRouter();
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
  /**
   * One selection for the whole canvas. The three ids below are *derived* from
   * it rather than stored beside it: everything that acts on "the selected
   * table" — the side panel, ⌘↵, the junction command, the context menus — means
   * exactly one thing selected, which is what `single` says. Two sources of
   * truth here would drift within a release.
   */
  const [selection, setSelection] = useState<CanvasSelection>(EMPTY_SELECTION);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const single = selectionCount(selection) === 1;
  const selectedId = single ? (selection.tables[0] ?? null) : null;
  const selectedGroupId = single ? (selection.groups[0] ?? null) : null;
  const selectedMemoId = single ? (selection.memos[0] ?? null) : null;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  /** Replace the selection with one thing. Stable, so cards can memoize on it. */
  const selectSingle = useCallback(
    (kind: SelectionKind, id: string | null) =>
      setSelection(id ? selectOnly(kind, id) : EMPTY_SELECTION),
    [],
  );
  const selectTable = useCallback(
    (id: string | null) => selectSingle("table", id),
    [selectSingle],
  );
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  /**
   * Memos that have held text at some point. A memo left blank was never really
   * created, so blurring it discards it; one the user has just emptied is a memo
   * they are still editing, and silently deleting it on a stray click away would
   * destroy work. Seeded on focus so memos loaded from the document count too.
   */
  const memoHadText = useRef(new Set<string>());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  /** Live position of the table under the pointer; schema is written once on release. */
  const [dragPosition, setDragPosition] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  /** Live width of the table being resized; committed once on release. */
  const [resizeTable, setResizeTable] = useState<{
    id: string;
    width: number;
  } | null>(null);
  const [dragMemoPosition, setDragMemoPosition] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [resizeMemo, setResizeMemo] = useState<{
    id: string;
    width: number;
    height: number;
  } | null>(null);
  /**
   * `dx`/`dy` are the offset from the group's committed origin. Members ride
   * along on that delta, so a group drag stays one state write per frame no
   * matter how many tables and memos sit inside it.
   */
  const [dragGroupPosition, setDragGroupPosition] = useState<{
    id: string;
    x: number;
    y: number;
    dx: number;
    dy: number;
  } | null>(null);
  const [resizeGroup, setResizeGroup] = useState<{
    id: string;
    width: number;
    height: number;
  } | null>(null);
  /**
   * The offset a multi-selection is currently dragged by. One delta for the
   * whole set, on the same reasoning as `dragGroupPosition`: a state write per
   * frame per selected card would make a fifty-table drag fifty times the work.
   */
  const [dragSelection, setDragSelection] = useState<{
    dx: number;
    dy: number;
  } | null>(null);
  /** The rectangle being swept, in canvas space. Null when no marquee is live. */
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  /**
   * The hand tool. `handMode` is the sticky dock toggle; `spaceHeld` is the
   * momentary hold. Panning reads the union, so the two can never disagree —
   * releasing Space while the toggle is on leaves hand mode on, as in Figma.
   */
  const [handMode, setHandMode] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panMode = handMode || spaceHeld;
  const [modal, setModal] = useState<
    "export" | "import" | "share" | "shortcuts" | null
  >(null);
  /**
   * Chord glyphs differ per platform, and the platform is unknowable during SSR —
   * so this settles after mount rather than during render, to keep hydration clean.
   */
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(isMacPlatform()), []);

  /**
   * The zoom level a screen reader hears. Continuous zoom changes many times a
   * second, so the announcement waits for the gesture to stop rather than
   * narrating every frame of it.
   */
  const [settledZoom, setSettledZoom] = useState(100);
  useEffect(() => {
    const timer = setTimeout(() => setSettledZoom(Math.round(zoom * 100)), 400);
    return () => clearTimeout(timer);
  }, [zoom]);
  const [shareLink, setShareLink] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [workspaceInviteLink, setWorkspaceInviteLink] = useState("");
  const [workspaceInviteBusy, setWorkspaceInviteBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [importMessage, setImportMessage] = useState<ImportMessage | null>(
    null,
  );
  const [tableQuery, setTableQuery] = useState("");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(
    new Set(),
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState<number>(417);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarResizingRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("drawsql_sidebar_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 280 && parsed <= 800) {
          setSidebarWidth(parsed);
        }
      }
    } catch {}
  }, []);

  const updateSidebarWidth = useCallback((width: number) => {
    const clamped = Math.max(280, Math.min(800, width));
    setSidebarWidth(clamped);
    try {
      localStorage.setItem("drawsql_sidebar_width", clamped.toString());
    } catch {}
  }, []);

  const onSidebarResizeStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      sidebarResizingRef.current = {
        startX: event.clientX,
        startWidth: sidebarWidth,
      };
      setIsResizingSidebar(true);
    },
    [sidebarWidth],
  );

  useEffect(() => {
    if (!isResizingSidebar) return;
    const move = (event: PointerEvent) => {
      const ref = sidebarResizingRef.current;
      if (!ref) return;
      const deltaX = event.clientX - ref.startX;
      updateSidebarWidth(ref.startWidth + deltaX);
    };
    const release = () => {
      if (sidebarResizingRef.current) {
        sidebarResizingRef.current = null;
        setIsResizingSidebar(false);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [isResizingSidebar, updateSidebarWidth]);

  const [panelTab, setPanelTab] = useState<PanelTab>("tables");
  const [panelMode, setPanelMode] = useState<PanelMode>("structure");
  const [relationshipQuery, setRelationshipQuery] = useState("");
  const [openRelationshipId, setOpenRelationshipId] = useState<string | null>(
    null,
  );
  const [relationSettings, setRelationSettings] = useState({
    showCardinality: true,
    showRelationshipLabels: true,
    autoSave: false,
  });
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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  useEffect(() => {
    const repaired = prepareCanvasSchema(initialSchema);
    const changed = repaired.tables.some(
      (table, index) =>
        table.x !== initialSchema.tables[index]?.x ||
        table.y !== initialSchema.tables[index]?.y,
    );
    if (changed) {
      commit(repaired);
      toast.success("Overlapping tables were separated.");
    }
    // Seeding only: re-running this on every `commit` would fight live edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSchema]);
  const canvasRef = useRef<HTMLDivElement>(null);
  /**
   * Gesture state lives in refs, not state: it updates every pointermove and
   * must not schedule a React render per frame.
   */
  const gestureRef = useRef<{
    mode:
      | "table"
      | "table-resize"
      | "memo"
      | "memo-resize"
      | "group"
      | "group-resize"
      | "pan"
      /** Sweeping a rectangle over empty canvas. */
      | "marquee"
      /** Dragging everything selected, as one. */
      | "selection";
    pointerId: number;
    tableId?: string;
    groupId?: string;
    memoId?: string;
    /** What the marquee unions onto — the selection held when the sweep began. */
    base?: CanvasSelection;
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
  /**
   * The release handler needs the live gesture values, but reading them from
   * state would put them in the pointer effect's dependency array — and they
   * change every frame, so the window listeners would be torn down and
   * re-attached ~60 times a second. Mirror them into refs instead.
   */
  const dragGroupPositionRef = useRef(dragGroupPosition);
  const resizeGroupRef = useRef(resizeGroup);
  const dragMemoPositionRef = useRef(dragMemoPosition);
  const resizeMemoRef = useRef(resizeMemo);
  const resizeTableRef = useRef(resizeTable);
  const dragSelectionRef = useRef(dragSelection);
  dragSelectionRef.current = dragSelection;
  panRef.current = pan;
  zoomRef.current = zoom;
  schemaRef.current = schema;
  dragGroupPositionRef.current = dragGroupPosition;
  resizeGroupRef.current = resizeGroup;
  dragMemoPositionRef.current = dragMemoPosition;
  resizeMemoRef.current = resizeMemo;
  resizeTableRef.current = resizeTable;

  /**
   * Puts the dot lattice into canvas space. `.canvas` has `transform-origin: 0
   * 0`, so canvas point (0, 0) sits at screen (`pan.x`, `pan.y`) — anchoring
   * the tiling there is what makes a dot stay on the same point of the diagram
   * while the camera moves. The half-tile shift centres each dot on a lattice
   * point rather than in the middle of its tile, matching drawDB's pattern
   * offset of `-gridCircleRadius`.
   */
  const gridStyle = useMemo(() => {
    const size = GRID_SIZE * zoom;
    return {
      "--grid-size": `${size}px`,
      "--grid-dot-radius": `${GRID_DOT_RADIUS * zoom}px`,
      "--grid-x": `${pan.x - size / 2}px`,
      "--grid-y": `${pan.y - size / 2}px`,
      "--grid-opacity": Math.max(
        0,
        Math.min(
          1,
          (zoom - GRID_FADE_END) / (GRID_FADE_START - GRID_FADE_END),
        ),
      ),
    } as React.CSSProperties;
  }, [pan.x, pan.y, zoom]);

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem("plstudio-settings") ||
        window.localStorage.getItem("drawsql-settings");
      if (saved)
        setRelationSettings((current) => ({
          ...current,
          ...JSON.parse(saved),
        }));
    } catch {
      /* Ignore malformed local settings. */
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "plstudio-settings",
      JSON.stringify(relationSettings),
    );
  }, [relationSettings]);
  dragPositionRef.current = dragPosition;

  useEffect(
    () => broadcastSelection(selection.tables),
    [selection.tables, broadcastSelection],
  );

  /**
   * A commit — this client's or a collaborator's — can remove something that is
   * selected here. Prune in one place rather than at every delete site;
   * `pruneSelection` returns the same object when nothing went, so this cannot
   * loop.
   */
  useEffect(
    () => setSelection((current) => pruneSelection(schema, current)),
    [schema],
  );

  /** Which collaborator, if any, has a given table selected — drives its ring colour. */
  const peerSelection = useMemo(
    () =>
      new Map(
        peers.flatMap((peer) =>
          peer.selectedIds.map((id) => [id, peer] as const),
        ),
      ),
    [peers],
  );

  /**
   * Everything travelling under the current multi-selection drag. Sets, so a
   * card that is both selected outright and a member of a selected group is
   * offset once; empty while no such drag is in flight, which is the common case.
   */
  const movingSet = useMemo(
    () =>
      dragSelection
        ? movingEntities(schema, selection)
        : {
            tables: new Set<string>(),
            memos: new Set<string>(),
            groups: new Set<string>(),
          },
    [dragSelection, schema, selection],
  );

  /**
   * The box drawn around a multi-selection. Only for two or more: one card
   * already says what it is with its own accent border, and a frame around it
   * would just be a second outline.
   */
  const multiFrame = useMemo(() => {
    if (selectionCount(selection) < 2) return null;
    const bounds = selectionBounds(schema, selection);
    if (!bounds) return null;
    return dragSelection
      ? {
          ...bounds,
          x: bounds.x + dragSelection.dx,
          y: bounds.y + dragSelection.dy,
        }
      : bounds;
  }, [dragSelection, schema, selection]);

  /**
   * A table's on-screen position: the in-flight one while it moves, else its
   * committed one shifted by the drag of the group it belongs to or the
   * selection it is part of.
   */
  const livePosition = useCallback(
    (table: Table) => {
      if (dragPosition && dragPosition.id === table.id)
        return { x: dragPosition.x, y: dragPosition.y };
      if (dragGroupPosition && table.schemaId === dragGroupPosition.id)
        return {
          x: table.x + dragGroupPosition.dx,
          y: table.y + dragGroupPosition.dy,
        };
      if (dragSelection && movingSet.tables.has(table.id))
        return { x: table.x + dragSelection.dx, y: table.y + dragSelection.dy };
      return { x: table.x, y: table.y };
    },
    [dragGroupPosition, dragPosition, dragSelection, movingSet],
  );
  const livePositionRef = useRef(livePosition);
  livePositionRef.current = livePosition;
  /**
   * A table's on-screen width: the in-flight one while it is being resized,
   * else the stored override, else the name-derived default. Relationship
   * anchors read this so the right-hand edge stays attached during a resize.
   */
  const liveWidth = useCallback(
    (table: Table) =>
      resizeTable && resizeTable.id === table.id
        ? resizeTable.width
        : tableWidth(table),
    [resizeTable],
  );
  const liveWidthRef = useRef(liveWidth);
  liveWidthRef.current = liveWidth;
  const liveMemo = useCallback(
    (memo: Memo) => {
      const position =
        dragMemoPosition?.id === memo.id ? dragMemoPosition : memo;
      const size = resizeMemo?.id === memo.id ? resizeMemo : memo;
      const rides =
        dragMemoPosition?.id !== memo.id &&
        dragGroupPosition &&
        memo.schemaId === dragGroupPosition.id;
      const swept = dragSelection && movingSet.memos.has(memo.id);
      return {
        x:
          position.x +
          (rides ? dragGroupPosition.dx : 0) +
          (swept ? dragSelection.dx : 0),
        y:
          position.y +
          (rides ? dragGroupPosition.dy : 0) +
          (swept ? dragSelection.dy : 0),
        width: size.width,
        height: size.height,
      };
    },
    [dragGroupPosition, dragMemoPosition, dragSelection, movingSet, resizeMemo],
  );
  const liveGroup = useCallback(
    (group: SchemaGroup) => {
      const position =
        dragGroupPosition?.id === group.id ? dragGroupPosition : group;
      const size = resizeGroup?.id === group.id ? resizeGroup : group;
      const swept = dragSelection && movingSet.groups.has(group.id);
      return {
        x: position.x + (swept ? dragSelection.dx : 0),
        y: position.y + (swept ? dragSelection.dy : 0),
        width: size.width,
        height: size.height,
      };
    },
    [dragGroupPosition, dragSelection, movingSet, resizeGroup],
  );
  const liveGroupRef = useRef(liveGroup);
  liveGroupRef.current = liveGroup;

  /**
   * The canvas rect is read on every pointermove — to place the cursor, to
   * clamp a pan, to convert a drag to canvas space — and each read is a forced
   * layout, interleaved with the state writes of the same frame. It only
   * changes when the canvas is resized or the page scrolls, so cache it and
   * invalidate on those.
   */
  const canvasRectRef = useRef<DOMRect | null>(null);
  const canvasRect = useCallback(() => {
    if (!canvasRectRef.current)
      canvasRectRef.current =
        canvasRef.current?.getBoundingClientRect() ?? null;
    return canvasRectRef.current;
  }, []);
  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const invalidate = () => {
      canvasRectRef.current = null;
    };
    // A ResizeObserver covers what a window resize misses: collapsing the
    // sidebar resizes the canvas without resizing the window.
    const observer = new ResizeObserver(invalidate);
    observer.observe(element);
    window.addEventListener("resize", invalidate);
    window.addEventListener("scroll", invalidate, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("scroll", invalidate, true);
    };
  }, []);

  const canvasPoint = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = canvasRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (event.clientX - rect.left - pan.x) / zoom,
        y: (event.clientY - rect.top - pan.y) / zoom,
      };
    },
    [canvasRect, pan.x, pan.y, zoom],
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
  const rowPointRef = useRef(rowPoint);
  rowPointRef.current = rowPoint;
  /**
   * Takes ids rather than records, and resolves them through refs, so its
   * identity survives a schema change — the table cards memoize on their props,
   * and a handler rebuilt every render would defeat that.
   */
  const startLinking = useCallback(
    (
      event: ReactPointerEvent,
      tableId: string,
      columnId: string,
      columnIndex: number,
    ) => {
      event.stopPropagation();
      const table = schemaRef.current.tables.find(
        (item) => item.id === tableId,
      );
      if (!table) return;
      const point = rowPointRef.current(table, columnIndex);
      setLinking({
        pointerId: event.pointerId,
        sourceTableId: tableId,
        sourceColumnId: columnId,
        startX: point.x,
        startY: point.y,
        x: point.x,
        y: point.y,
      });
    },
    [],
  );
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
            fields: [
              { startFieldId: child.column.id, endFieldId: parent.column.id },
            ],
            name: `fk_${child.table.name}_${child.column.name}_${parent.table.name}`,
            cardinality: "many_to_one",
            manyLabel: "n",
            updateConstraint: "No action",
            deleteConstraint: "No action",
          };
          commit(
            normalizeRelationships({
              ...schema,
              relationships: [...(schema.relationships ?? []), relationship],
            }),
          );
          setPanelTab("relationships");
          toast.success(
            `Linked ${child.table.name}.${child.column.name} to ${parent.table.name}.${parent.column.name}.`,
          );
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
  /**
   * Id indexes over the schema. The card tree resolves a foreign key target and
   * a group for every column of every table on every render, and a linear find
   * inside those loops makes the render quadratic in table count. Build the
   * lookups once per schema instead.
   */
  const tablesById = useMemo(
    () => new Map(schema.tables.map((table) => [table.id, table])),
    [schema.tables],
  );
  const groupsById = useMemo(
    () => new Map((schema.groups ?? []).map((group) => [group.id, group])),
    [schema.groups],
  );
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
  const foreignKeyTarget = useCallback(
    (column: Column) => {
      if (!column.fk) return undefined;
      const target = tablesById.get(column.fk.tableId);
      const targetColumn = target?.columns.find(
        (item) => item.id === column.fk!.columnId,
      );
      return target && targetColumn
        ? { table: target, column: targetColumn }
        : undefined;
    },
    [tablesById],
  );

  /** Relationships to tables outside this subset are dropped by normalization. */
  const tableDDL = (table: Table) =>
    generateDDL({ ...schema, tables: [table] });

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
  const issues = useMemo(() => validateSchema(schema), [schema]);
  const errors = issues.filter((issue) => issue.severity === "error");
  /**
   * Generating SQL is the most expensive thing a schema change can trigger, and
   * almost every schema change discards the result: the code panel and the
   * export dialog are the only readers. Gate each generator on a visible reader
   * so typing doesn't rebuild DDL nobody is looking at, and build `combined`
   * from the two strings rather than calling `exportSchema`, which regenerates
   * both.
   */
  const ddl = useMemo(
    () => (panelMode === "code" ? generateDDL(schema) : ""),
    [panelMode, schema],
  );

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
    [commitShared, readOnly],
  );

  /** Functional form of `commit`, for gesture handlers that only hold a ref to current state. */
  const commitWith = useCallback(
    (mutate: (current: Schema) => Schema) => commit(mutate(schemaRef.current)),
    [commit],
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
  /**
   * A new table joins the schema group in context — the selected group, or the
   * group of the selected table — and is born carrying that group's keyword.
   * This is the only automatic prefixing there is: once the table exists its
   * name is the user's, prefix or not, in the group or out of it.
   */
  const addTable = (groupId?: string) => {
    const target = (schema.groups ?? []).find(
      (group) =>
        group.id ===
        (groupId ??
          selectedGroupId ??
          schema.tables.find((table) => table.id === selectedId)?.schemaId),
    );
    const index = schema.tables.length;
    const base = makeTable(
      prefixTableName(`TABLE_${index + 1}`, groupPrefix(target)),
      90 + (index % 4) * 70,
      100 + (index % 3) * 75,
      index,
    );
    const table = target
      ? {
          ...base,
          schemaId: target.id,
          ...insideGroup(
            target,
            base,
            schema.tables.filter((item) => item.schemaId === target.id).length,
          ),
        }
      : base;
    commit({ ...schema, tables: [...schema.tables, table] });
    selectTable(table.id);
  };
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
  const deleteColumn = (tableId: string, columnId: string) =>
    commit(
      normalizeRelationships({
        ...schema,
        tables: schema.tables.map((table) =>
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

  /** Undo walks only this client's own edits — never a collaborator's. */
  const undo = () => {
    if (readOnly) return;
    undoShared();
    setDirty(true);
  };
  const redo = () => {
    if (readOnly) return;
    redoShared();
    setDirty(true);
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
    if (
      !canvasRef.current ||
      (!schema.tables.length && !(schema.groups ?? []).length)
    )
      return;
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
      ...schema.tables.map((table) => table.x + tableWidth(table)),
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

  /**
   * Centre the viewport on a subset of tables — what an import lands with, so
   * the tables it just added are the thing on screen. Zoom only ever comes
   * down, and only far enough to fit them: an import of two tables into a
   * forty-table diagram should not reframe the diagram.
   */
  const revealTables = (tables: Table[]) => {
    if (!canvasRef.current || !tables.length) return;
    stopAnimationRef.current?.();
    stopAnimationRef.current = null;
    const rect = canvasRef.current.getBoundingClientRect();
    const padding = 64;
    const minX = Math.min(...tables.map((table) => table.x));
    const minY = Math.min(...tables.map((table) => table.y));
    const maxX = Math.max(
      ...tables.map((table) => table.x + tableWidth(table)),
    );
    const maxY = Math.max(
      ...tables.map((table) => table.y + tableHeight(table)),
    );
    const next = Math.max(
      MIN_ZOOM,
      Math.min(
        zoom,
        (rect.width - padding * 2) / Math.max(1, maxX - minX),
        (rect.height - padding * 2) / Math.max(1, maxY - minY),
      ),
    );
    setZoom(next);
    setPan({
      x: (rect.width - (maxX - minX) * next) / 2 - minX * next,
      y: (rect.height - (maxY - minY) * next) / 2 - minY * next,
    });
  };

  const resolveTablePosition = useCallback(
    (id: string, x: number, y: number) => {
      const tables = schemaRef.current.tables;
      const table = tables.find((candidate) => candidate.id === id);
      if (!table) return { x, y };
      const settle = (value: Vec) => ({
        x: Math.round(value.x),
        y: Math.round(value.y),
      });
      const hits = (position: Vec, other: Table) =>
        position.x < other.x + tableWidth(other) + TABLE_GAP &&
        position.x + tableWidth(table) + TABLE_GAP > other.x &&
        position.y < other.y + tableHeight(other) + TABLE_GAP &&
        position.y + tableHeight(table) + TABLE_GAP > other.y;
      const overlapping = (position: Vec) =>
        tables.find((other) => other.id !== id && hits(position, other));
      /**
       * Slide out of `other` along whichever axis it is least buried in, so the
       * table rests against its neighbour instead of being flung to the first
       * free slot in some arbitrary search order.
       */
      const pushOut = (position: Vec, other: Table) => {
        const moves = [
          { x: other.x - tableWidth(table) - TABLE_GAP, y: position.y },
          { x: other.x + tableWidth(other) + TABLE_GAP, y: position.y },
          { x: position.x, y: other.y - tableHeight(table) - TABLE_GAP },
          { x: position.x, y: other.y + tableHeight(other) + TABLE_GAP },
        ];
        return moves.reduce((best, move) =>
          Math.hypot(move.x - position.x, move.y - position.y) <
          Math.hypot(best.x - position.x, best.y - position.y)
            ? move
            : best,
        );
      };
      let position = settle({ x, y });
      // Each push can land on a different neighbour; a handful of passes settles
      // any realistic cluster, and the cap is what guarantees termination now
      // that no edge can stop the walk early.
      for (let pass = 0; pass < 8; pass += 1) {
        const other = overlapping(position);
        if (!other) return position;
        position = settle(pushOut(position, other));
      }
      return position;
    },
    [],
  );

  /**
   * Writes an already-resolved position. Deliberately leaves `dragPosition`
   * alone: the release path commits *before* the settle animation runs, and
   * clearing it here would snap the card to its target and then yank it back to
   * the drop point on the animation's first frame.
   */
  const writeTablePosition = useCallback(
    (id: string, x: number, y: number, schemaId?: string | null) => {
      if (readOnly) return;
      commitWith((current) => ({
        ...current,
        tables: current.tables.map((table) =>
          table.id === id
            ? {
                ...table,
                x,
                y,
                schemaId:
                  schemaId === undefined
                    ? table.schemaId
                    : schemaId || undefined,
              }
            : table,
        ),
      }));
    },
    [commitWith, readOnly],
  );

  const commitTableWidth = useCallback(
    (id: string, width: number) => {
      if (readOnly) {
        setResizeTable(null);
        return;
      }
      commitWith((current) => ({
        ...current,
        tables: current.tables.map((table) =>
          table.id === id ? { ...table, width: clampTableWidth(width) } : table,
        ),
      }));
      setResizeTable(null);
    },
    [commitWith, readOnly],
  );

  /** Drops the manual override so the card goes back to its name-derived width. */
  const resetTableWidth = useCallback(
    (id: string) => {
      if (readOnly) return;
      if (
        schemaRef.current.tables.find((table) => table.id === id)?.width ===
        undefined
      )
        return;
      commitWith((current) => ({
        ...current,
        tables: current.tables.map((table) =>
          table.id === id ? { ...table, width: undefined } : table,
        ),
      }));
      setResizeTable(null);
    },
    [commitWith, readOnly],
  );

  const commitPosition = useCallback(
    (id: string, x: number, y: number, schemaId?: string | null) => {
      if (readOnly) return;
      const resolved = resolveTablePosition(id, x, y);
      writeTablePosition(id, resolved.x, resolved.y, schemaId);
      setDragPosition(null);
    },
    [readOnly, resolveTablePosition, writeTablePosition],
  );

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

  const commitGroupPosition = useCallback(
    (id: string, x: number, y: number) => {
      if (readOnly) return;
      /*
       * Resolve inside the updater, against the schema being committed: a
       * remote edit can land between pointerup and here, and the delta the
       * members move by has to be measured from the same origin the group
       * lands on.
       */
      commitWith((next) => {
        const group = (next.groups ?? []).find((item) => item.id === id);
        if (!group) return next;
        const nextX = Math.round(x);
        const nextY = Math.round(y);
        const dx = nextX - group.x;
        const dy = nextY - group.y;
        return {
          ...next,
          groups: (next.groups ?? []).map((item) =>
            item.id === id ? { ...item, x: nextX, y: nextY } : item,
          ),
          /*
           * No `resolveTablePosition` pass over the members: its overlap
           * push-out would rearrange the layout the user built inside the
           * schema, which is the one thing relocating it must preserve.
           */
          tables: next.tables.map((table) =>
            table.schemaId === id
              ? { ...table, x: table.x + dx, y: table.y + dy }
              : table,
          ),
          memos: next.memos?.map((memo) =>
            memo.schemaId === id
              ? { ...memo, x: memo.x + dx, y: memo.y + dy }
              : memo,
          ),
        };
      });
      setDragGroupPosition(null);
    },
    [commitWith, readOnly],
  );

  const commitGroupSize = useCallback(
    (id: string, width: number, height: number) => {
      if (readOnly) return;
      const current = schemaRef.current;
      if (!current.groups?.some((item) => item.id === id)) return;
      const group = current.groups.find((item) => item.id === id);
      if (!group) return;
      // Only a floor. A group may grow as far to the right and down as the
      // person dragging it wants to take it.
      const nextWidth = Math.max(GROUP_MIN_WIDTH, Math.round(width));
      const nextHeight = Math.max(GROUP_MIN_HEIGHT, Math.round(height));
      commitWith((next) => ({
        ...next,
        groups: (next.groups ?? []).map((item) =>
          item.id === id
            ? {
                ...item,
                width: nextWidth,
                height: nextHeight,
              }
            : item,
        ),
        tables: next.tables.map((table) => {
          if (table.schemaId !== undefined && table.schemaId !== id)
            return table;
          const inside = enclosedBy(
            { x: group.x, y: group.y, width: nextWidth, height: nextHeight },
            table.x + tableWidth(table) / 2,
            table.y + tableHeight(table) / 2,
          );
          return { ...table, schemaId: inside ? id : undefined };
        }),
        memos: next.memos?.map((memo) => {
          if (memo.schemaId !== undefined && memo.schemaId !== id) return memo;
          const inside = enclosedBy(
            { x: group.x, y: group.y, width: nextWidth, height: nextHeight },
            memo.x + memo.width / 2,
            memo.y + memo.height / 2,
          );
          return { ...memo, schemaId: inside ? id : undefined };
        }),
      }));
      setResizeGroup(null);
    },
    [commitWith, readOnly],
  );

  const commitMemoPosition = useCallback(
    (id: string, x: number, y: number, schemaId?: string | null) => {
      if (readOnly) return;
      const current = schemaRef.current;
      const memo = current.memos?.find((item) => item.id === id);
      if (!memo) return;
      commitWith((next) => ({
        ...next,
        memos: (next.memos ?? []).map((item) =>
          item.id === id
            ? {
                ...item,
                x: Math.round(x),
                y: Math.round(y),
                schemaId:
                  schemaId === undefined
                    ? item.schemaId
                    : schemaId || undefined,
              }
            : item,
        ),
      }));
      setDragMemoPosition(null);
    },
    [commitWith, readOnly],
  );

  const commitMemoSize = useCallback(
    (id: string, width: number, height: number) => {
      if (readOnly) return;
      const current = schemaRef.current;
      if (!current.memos?.some((item) => item.id === id)) return;
      commitWith((next) => ({
        ...next,
        memos: (next.memos ?? []).map((item) =>
          item.id === id
            ? {
                ...item,
                width: Math.max(
                  MEMO_MIN_WIDTH,
                  Math.min(MEMO_MAX_WIDTH, Math.round(width)),
                ),
                height: Math.max(
                  MEMO_MIN_HEIGHT,
                  Math.min(MEMO_MAX_HEIGHT, Math.round(height)),
                ),
              }
            : item,
        ),
      }));
      setResizeMemo(null);
    },
    [commitWith, readOnly],
  );

  useEffect(() => {
    let moveFrame: number | null = null;
    let pendingMoveAction: (() => void) | null = null;

    const flushMove = () => {
      if (moveFrame !== null) {
        cancelAnimationFrame(moveFrame);
        moveFrame = null;
      }
      if (pendingMoveAction) {
        const action = pendingMoveAction;
        pendingMoveAction = null;
        action();
      }
    };

    const scheduleMove = (action: () => void) => {
      pendingMoveAction = action;
      if (moveFrame === null) {
        moveFrame = requestAnimationFrame(() => {
          moveFrame = null;
          if (pendingMoveAction) {
            const act = pendingMoveAction;
            pendingMoveAction = null;
            act();
          }
        });
      }
    };

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
        // Straight 1:1 with the pointer. There is no edge to resist against,
        // so there is nothing for a rubber band to mean.
        const next = {
          x: gesture.originX + event.clientX - gesture.startX,
          y: gesture.originY + event.clientY - gesture.startY,
        };
        gesture.tracker.add(next.x, next.y, now);
        scheduleMove(() => setPan(next));
        return;
      }

      const rect = canvasRect();
      if (gesture.mode === "marquee" || gesture.mode === "selection") {
        if (!rect) return;
        const point = {
          x: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
          y: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
        };
        if (gesture.mode === "marquee") {
          const swept = rectFromPoints(
            gesture.originX,
            gesture.originY,
            point.x,
            point.y,
          );
          // Recompute the hit set every frame rather than on release: cards
          // that light up as the rectangle crosses them are how the user knows
          // what they are about to get.
          const next = marqueeSelection(
            schemaRef.current,
            swept,
            gesture.base ?? EMPTY_SELECTION,
          );
          scheduleMove(() => {
            setMarquee(swept);
            setSelection(next);
          });
          return;
        }
        const next = {
          dx: point.x - gesture.grabX,
          dy: point.y - gesture.grabY,
        };
        gesture.tracker.add(next.dx, next.dy, now);
        scheduleMove(() => setDragSelection(next));
        return;
      }
      const group = schemaRef.current.groups?.find(
        (item) => item.id === gesture.groupId,
      );
      if (gesture.mode === "group" || gesture.mode === "group-resize") {
        if (!rect || !group) return;
        const point = {
          x: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
          y: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
        };
        if (gesture.mode === "group") {
          const x = point.x - gesture.grabX;
          const y = point.y - gesture.grabY;
          const nextGroup = {
            id: group.id,
            x,
            y,
            dx: x - group.x,
            dy: y - group.y,
          };
          scheduleMove(() => setDragGroupPosition(nextGroup));
        } else {
          const nextResize = {
            id: group.id,
            width: Math.max(
              GROUP_MIN_WIDTH,
              gesture.originWidth! + point.x - gesture.grabX,
            ),
            height: Math.max(
              GROUP_MIN_HEIGHT,
              gesture.originHeight! + point.y - gesture.grabY,
            ),
          };
          scheduleMove(() => setResizeGroup(nextResize));
        }
        return;
      }
      const memo = schemaRef.current.memos?.find(
        (item) => item.id === gesture.memoId,
      );
      if (gesture.mode === "memo" || gesture.mode === "memo-resize") {
        if (!rect || !memo) return;
        const point = {
          x: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
          y: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
        };
        if (gesture.mode === "memo") {
          const nextMemo = {
            id: memo.id,
            x: point.x - gesture.grabX,
            y: point.y - gesture.grabY,
          };
          scheduleMove(() => setDragMemoPosition(nextMemo));
        } else {
          const nextMemoResize = {
            id: memo.id,
            width: Math.max(
              MEMO_MIN_WIDTH,
              Math.min(
                MEMO_MAX_WIDTH,
                gesture.originWidth! + point.x - gesture.grabX,
              ),
            ),
            height: Math.max(
              MEMO_MIN_HEIGHT,
              Math.min(
                MEMO_MAX_HEIGHT,
                gesture.originHeight! + point.y - gesture.grabY,
              ),
            ),
          };
          scheduleMove(() => setResizeMemo(nextMemoResize));
        }
        return;
      }

      const table = schemaRef.current.tables.find(
        (item) => item.id === gesture.tableId,
      );
      if (!rect || !table) return;

      if (gesture.mode === "table-resize") {
        const pointX =
          (event.clientX - rect.left - panRef.current.x) / zoomRef.current;
        const width = clampTableWidth(
          gesture.originWidth! + pointX - gesture.grabX,
        );
        scheduleMove(() => setResizeTable({ id: table.id, width }));
        return;
      }

      const next = {
        x:
          (event.clientX - rect.left - panRef.current.x) / zoomRef.current -
          gesture.grabX,
        y:
          (event.clientY - rect.top - panRef.current.y) / zoomRef.current -
          gesture.grabY,
      };
      gesture.tracker.add(next.x, next.y, now);
      scheduleMove(() => setDragPosition({ id: table.id, ...next }));
    };

    const up = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      flushMove();
      gestureRef.current = null;
      setGrabbing(false);
      const now = event.timeStamp || performance.now();
      const velocity = gesture.tracker.velocity(now);

      if (gesture.mode === "pan") {
        if (!gesture.moved) return;
        const current = panRef.current;
        // Where the flick is going, not where a wall would have stopped it.
        const target = {
          x: current.x + project(velocity.x),
          y: current.y + project(velocity.y),
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

      if (gesture.mode === "marquee") {
        setMarquee(null);
        // A sweep that never passed the threshold is a click on empty canvas,
        // which is how the selection is cleared.
        if (!gesture.moved) setSelection(gesture.base ?? EMPTY_SELECTION);
        return;
      }

      if (gesture.mode === "selection") {
        const live = dragSelectionRef.current;
        if (!gesture.moved || !live) {
          setDragSelection(null);
          return;
        }
        const selected = selectionRef.current;
        const target = {
          x: live.dx + project(velocity.x),
          y: live.dy + project(velocity.y),
        };
        const flicked = Math.hypot(velocity.x, velocity.y) > 60;
        // Commit on release, spring afterwards — the same invariant the single
        // table drag documents below.
        commitWith((current) =>
          moveSelection(current, selected, target.x, target.y),
        );
        animateTo(
          { x: live.dx, y: live.dy },
          target,
          velocity,
          flicked ? FLICK_SPRING : SETTLE_SPRING,
          // The schema already holds the move, so the spring animates the
          // *residual* — how far the cards still are from where they landed.
          (value) =>
            setDragSelection({
              dx: value.x - target.x,
              dy: value.y - target.y,
            }),
          () => setDragSelection(null),
        );
        /*
         * A residual left frozen by an interrupted settle would offset the whole
         * set until the next selection drag, so hang the cleanup off the stop
         * handle: grabbing, panning or zooming mid-flight now drops it and the
         * cards sit where the schema already says they are. Wrapping *after*
         * `animateTo` matters — it calls `stopAnimation` itself on the way in,
         * and clearing there would snap the set home for a frame.
         */
        const stop = stopAnimationRef.current;
        if (stop)
          stopAnimationRef.current = () => {
            stop();
            setDragSelection(null);
          };
        return;
      }

      const memo = schemaRef.current.memos?.find(
        (item) => item.id === gesture.memoId,
      );
      const group = schemaRef.current.groups?.find(
        (item) => item.id === gesture.groupId,
      );
      if (gesture.mode === "group" && group) {
        const live = dragGroupPositionRef.current;
        if (gesture.moved && live?.id === group.id)
          commitGroupPosition(group.id, live.x, live.y);
        else setDragGroupPosition(null);
        return;
      }
      if (gesture.mode === "group-resize" && group) {
        const live = resizeGroupRef.current;
        if (gesture.moved && live?.id === group.id)
          commitGroupSize(group.id, live.width, live.height);
        else setResizeGroup(null);
        return;
      }
      if (gesture.mode === "memo" && memo) {
        const live = dragMemoPositionRef.current;
        if (gesture.moved && live?.id === memo.id) {
          const landing = { x: live.x, y: live.y };
          const targetGroup = (schemaRef.current.groups ?? []).find((group) =>
            enclosedBy(
              liveGroupRef.current(group),
              landing.x + memo.width / 2,
              landing.y + memo.height / 2,
            ),
          );
          commitMemoPosition(
            memo.id,
            landing.x,
            landing.y,
            targetGroup?.id ?? null,
          );
        } else {
          setDragMemoPosition(null);
        }
        return;
      }
      if (gesture.mode === "memo-resize" && memo) {
        const live = resizeMemoRef.current;
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

      if (gesture.mode === "table-resize") {
        const live = resizeTableRef.current;
        if (gesture.moved && live?.id === table.id) {
          commitTableWidth(table.id, live.width);
        } else {
          setResizeTable(null);
        }
        return;
      }

      if (!gesture.moved) {
        setDragPosition(null);
        return; // a tap, not a drag — selection already happened on pointerdown
      }
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
      const target = resolveTablePosition(
        table.id,
        projected.x,
        projected.y,
      );
      const tableCenter = {
        x: target.x + tableWidth(table) / 2,
        y: target.y + tableHeight(table) / 2,
      };
      const targetGroup = (schemaRef.current.groups ?? []).find((group) =>
        enclosedBy(liveGroupRef.current(group), tableCenter.x, tableCenter.y),
      );
      const flicked = Math.hypot(velocity.x, velocity.y) > 60;
      /**
       * Commit on release, not on settle. Every gesture entry point calls
       * `stopAnimation()`, which cancels the frame loop without running its
       * `onSettle` — so anything that grabbed, panned or zoomed inside the
       * settle window used to discard the move silently. The card kept looking
       * right only because the stale `dragPosition` masked it, until the next
       * drag claimed that slot and the table snapped back to its old position.
       * The spring is now purely cosmetic: the schema already holds `target`,
       * so an interrupted animation lands there instead of reverting.
       */
      writeTablePosition(table.id, target.x, target.y, targetGroup?.id ?? null);
      animateTo(
        from,
        target,
        velocity,
        flicked ? FLICK_SPRING : SETTLE_SPRING,
        (value) => setDragPosition({ id: table.id, ...value }),
        () => setDragPosition(null),
      );
    };

    const cancel = (event: PointerEvent) => up(event);

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      flushMove();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    // Every dependency here is stable, so the listeners attach once instead of
    // once per pointermove. Live gesture values are read through refs above.
  }, [
    animateTo,
    canvasRect,
    commitGroupPosition,
    commitGroupSize,
    commitMemoPosition,
    commitMemoSize,
    commitTableWidth,
    commitWith,
    writeTablePosition,
    resolveTablePosition,
  ]);

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
    let wheelFrame: number | null = null;
    /**
     * Deltas accumulate rather than overwrite: a frame usually swallows several
     * wheel events, and keeping only the last one both loses distance and makes
     * the gesture stutter. One flush per frame applies their sum.
     */
    let zoomDelta = 0;
    let panDelta = { x: 0, y: 0 };
    let pointer = { x: 0, y: 0 };

    const applyWheel = () => {
      let nextZoom = zoomRef.current;
      let nextPan = panRef.current;
      if (zoomDelta !== 0) {
        const scaled = Math.min(
          MAX_ZOOM,
          Math.max(
            MIN_ZOOM,
            nextZoom * Math.exp(-zoomDelta * ZOOM_SENSITIVITY),
          ),
        );
        zoomDelta = 0;
        if (scaled !== nextZoom) {
          // Keep the point under the cursor pinned while the scale changes.
          const world = {
            x: (pointer.x - nextPan.x) / nextZoom,
            y: (pointer.y - nextPan.y) / nextZoom,
          };
          nextPan = {
            x: pointer.x - world.x * scaled,
            y: pointer.y - world.y * scaled,
          };
          nextZoom = scaled;
        }
      }
      if (panDelta.x !== 0 || panDelta.y !== 0) {
        nextPan = {
          x: nextPan.x - panDelta.x,
          y: nextPan.y - panDelta.y,
        };
        panDelta = { x: 0, y: 0 };
      }
      if (nextZoom !== zoomRef.current) setZoom(nextZoom);
      if (nextPan !== panRef.current) setPan(nextPan);
    };

    const flushWheel = () => {
      if (wheelFrame !== null) {
        cancelAnimationFrame(wheelFrame);
        wheelFrame = null;
        applyWheel();
      }
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      stopAnimation();
      const rect = canvasRect();
      if (!rect) return;
      const scale = wheelScale(event);

      if (event.ctrlKey || event.metaKey) {
        // Capping the per-event step is what separates a trackpad pinch (a few
        // pixels at a time) from a mouse notch (100 at once) without needing to
        // tell the two devices apart.
        const step = event.deltaY * scale;
        zoomDelta += Math.max(
          -ZOOM_STEP_LIMIT,
          Math.min(ZOOM_STEP_LIMIT, step),
        );
        pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      } else {
        panDelta = {
          x: panDelta.x + event.deltaX * scale,
          y: panDelta.y + event.deltaY * scale,
        };
      }

      if (wheelFrame === null) {
        wheelFrame = requestAnimationFrame(() => {
          wheelFrame = null;
          applyWheel();
        });
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      flushWheel();
      element.removeEventListener("wheel", onWheel);
    };
  }, [canvasRect, stopAnimation]);

  /** Zoom around the viewport centre, for the HUD buttons and keyboard. */
  const zoomBy = useCallback(
    (delta: number) => {
      stopAnimation();
      const rect = canvasRect();
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
    [canvasRect, stopAnimation],
  );

  /**
   * Seeds a pan gesture. Deliberately leaves selection alone: hitting empty
   * canvas clears it (below), but the hand tool must not — dragging the view
   * around is not a way of deselecting what you were working on.
   */
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    stopAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
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

  /** Seeds the rectangle sweep. Additive when Shift or ⌘/Ctrl is held. */
  const startMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    stopAnimation();
    const rect = canvasRect();
    if (!rect) return startPan(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
    const base =
      event.shiftKey || event.metaKey || event.ctrlKey
        ? selectionRef.current
        : EMPTY_SELECTION;
    gestureRef.current = {
      mode: "marquee",
      pointerId: event.pointerId,
      base,
      grabX: point.x,
      grabY: point.y,
      originX: point.x,
      originY: point.y,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      tracker: new VelocityTracker(),
    };
  };

  /**
   * Pressing empty canvas sweeps a selection, the way it does on both desktops.
   * Panning keeps every route it already had — hold Space, the hand tool, a
   * middle-drag, and the wheel — so nothing is lost by giving the left button
   * over to selection.
   */
  const onCanvasDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setEditingMemoId(null);
    if (event.button === 0 && !panMode) return startMarquee(event);
    startPan(event);
  };

  /**
   * What a press on a card does to the selection, before any drag begins.
   * Shift or ⌘/Ctrl toggles that one card in or out and starts nothing;
   * pressing something already inside a multi-selection leaves the set intact
   * so the whole thing can be dragged; anything else collapses to it.
   */
  const pressSelection = useCallback(
    (event: React.PointerEvent<Element>, kind: SelectionKind, id: string) => {
      const current = selectionRef.current;
      if (event.shiftKey || event.metaKey || event.ctrlKey) {
        setSelection(toggleSelected(current, kind, id));
        return "toggled" as const;
      }
      if (selectionCount(current) > 1 && isSelected(current, kind, id))
        return "set" as const;
      setSelection(selectOnly(kind, id));
      return "single" as const;
    },
    [],
  );

  /** Seeds a drag of everything selected. The pointer's canvas position is the origin. */
  const startSelectionDrag = useCallback(
    (event: React.PointerEvent<Element>) => {
      const rect = canvasRect();
      if (!rect) return;
      setGrabbing(true);
      gestureRef.current = {
        mode: "selection",
        pointerId: event.pointerId,
        grabX: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
        grabY: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
        originX: 0,
        originY: 0,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        tracker: new VelocityTracker(),
      };
    },
    [canvasRect],
  );

  /**
   * Hand mode pans from anywhere, so it has to win before the cards do — they
   * all `stopPropagation()` in the bubble phase, and the pan handler below only
   * fires on a bare-canvas hit. Stopping the capture-phase event halts React's
   * whole dispatch, which leaves table drag, group/memo resize and relationship
   * linking inert for as long as the tool is held.
   */
  const onCanvasDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panMode || event.button !== 0) return;
    // Only the canvas itself is pannable surface. The dock and the selection
    // toolbar are chrome floating over it, and swallowing their presses here
    // left the hand tool unable to switch itself off — its own button never saw
    // the click that would have toggled it.
    const target = event.target as Element;
    if (target !== event.currentTarget && !target.closest(".canvas")) return;
    event.preventDefault();
    event.stopPropagation();
    startPan(event);
  };

  const onHeaderDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, tableId: string) => {
      if (event.button !== 0) return;
      const table = schemaRef.current.tables.find(
        (item) => item.id === tableId,
      );
      if (!table) return;
      event.preventDefault();
      event.stopPropagation();
      stopAnimation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rect = canvasRect();
      if (!rect) return;
      setEditingMemoId(null);
      const intent = pressSelection(event, "table", tableId);
      if (intent === "toggled") return;
      if (intent === "set") return startSelectionDrag(event);
      setGrabbing(true);
      const origin = livePositionRef.current(table);
      const tracker = new VelocityTracker();
      tracker.add(origin.x, origin.y, event.timeStamp || performance.now());
      gestureRef.current = {
        mode: "table",
        pointerId: event.pointerId,
        tableId,
        // Respect where the card was grabbed — snapping to its centre would
        // break the illusion that the card is stuck to the pointer.
        grabX:
          (event.clientX - rect.left - panRef.current.x) / zoomRef.current -
          origin.x,
        grabY:
          (event.clientY - rect.top - panRef.current.y) / zoomRef.current -
          origin.y,
        originX: origin.x,
        originY: origin.y,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        tracker,
      };
    },
    [canvasRect, pressSelection, startSelectionDrag, stopAnimation],
  );

  /**
   * Width-only resize from the card's right edge — a card's height is derived
   * from its column count, so there is nothing vertical to drag.
   */
  /** A table resizes on one axis, so only the horizontal arrows do anything. */
  const onTableResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, tableId: string) => {
      const delta = resizeDelta(event);
      if (!delta || !delta[0]) return;
      const table = schemaRef.current.tables.find(
        (item) => item.id === tableId,
      );
      if (!table) return;
      event.preventDefault();
      event.stopPropagation();
      commitTableWidth(tableId, liveWidthRef.current(table) + delta[0]);
    },
    [commitTableWidth],
  );

  const onTableResizeDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, tableId: string) => {
      if (event.button !== 0 || readOnly) return;
      const table = schemaRef.current.tables.find(
        (item) => item.id === tableId,
      );
      if (!table) return;
      event.preventDefault();
      event.stopPropagation();
      stopAnimation();
      const rect = canvasRect();
      if (!rect) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelection(selectOnly("table", tableId));
      setEditingMemoId(null);
      setGrabbing(true);
      gestureRef.current = {
        mode: "table-resize",
        pointerId: event.pointerId,
        tableId,
        grabX: (event.clientX - rect.left - panRef.current.x) / zoomRef.current,
        grabY: (event.clientY - rect.top - panRef.current.y) / zoomRef.current,
        originX: table.x,
        originY: table.y,
        originWidth: liveWidthRef.current(table),
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        tracker: new VelocityTracker(),
      };
    },
    [canvasRect, readOnly, stopAnimation],
  );

  const onMemoDown = (event: React.PointerEvent<HTMLElement>, memo: Memo) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvasRect();
    if (!rect) return;
    const position = liveMemo(memo);
    const intent = pressSelection(event, "memo", memo.id);
    if (intent === "toggled") return;
    if (intent === "set") return startSelectionDrag(event);
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

  const onMemoResizeDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    memo: Memo,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRect();
    if (!rect) return;
    const position = liveMemo(memo);
    const pointer = {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
    setSelection(selectOnly("memo", memo.id));
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

  const onGroupDown = (
    event: React.PointerEvent<HTMLElement>,
    group: SchemaGroup,
  ) => {
    if (event.button !== 0 || readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    stopAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvasRect();
    if (!rect) return;
    const position = liveGroup(group);
    const intent = pressSelection(event, "group", group.id);
    if (intent === "toggled") return;
    if (intent === "set") return startSelectionDrag(event);
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

  const onGroupResizeDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    group: SchemaGroup,
  ) => {
    if (event.button !== 0 || readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvasRect();
    if (!rect) return;
    const position = liveGroup(group);
    const pointer = {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    };
    setSelection(selectOnly("group", group.id));
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

  const addMemo = () => {
    const index = schema.memos?.length ?? 0;
    const memo = makeMemo(
      "",
      120 + (index % 4) * 70,
      100 + (index % 3) * 70,
      "yellow",
    );
    commit({ ...schema, memos: [...(schema.memos ?? []), memo] });
    setSelection(selectOnly("memo", memo.id));
    setEditingMemoId(memo.id);
  };

  const addGroup = () => {
    const index = schema.groups?.length ?? 0;
    const group = makeSchemaGroup(
      `Schema ${index + 1}`,
      90 + (index % 3) * 120,
      80 + (index % 2) * 120,
      index,
    );
    commit({ ...schema, groups: [...(schema.groups ?? []), group] });
    setSelection(selectOnly("group", group.id));
  };

  const patchGroup = (id: string, patch: Partial<SchemaGroup>) => {
    if (readOnly) return;
    commit({
      ...schema,
      groups: (schema.groups ?? []).map((group) =>
        group.id === id ? { ...group, ...patch } : group,
      ),
    });
  };

  const deleteGroup = (id: string) => {
    if (readOnly) return;
    commit({
      ...schema,
      groups: (schema.groups ?? []).filter((group) => group.id !== id),
      tables: schema.tables.map((table) =>
        table.schemaId === id ? { ...table, schemaId: undefined } : table,
      ),
    });
  };

  /** Tables in `id` whose name does not already open with the group's keyword. */
  const unprefixedTables = (id: string) => {
    const prefix = groupPrefix(
      (schema.groups ?? []).find((group) => group.id === id),
    );
    return prefix
      ? schema.tables.filter(
          (table) =>
            table.schemaId === id &&
            prefixTableName(table.name, prefix) !== table.name,
        )
      : [];
  };

  /**
   * The one bulk rename, and it is always asked for — a keyword never rewrites
   * a name the user already typed as a side effect of being edited. One commit,
   * so a single undo puts every name back.
   */
  const applyGroupKeyword = (id: string) => {
    if (readOnly) return;
    const prefix = groupPrefix(
      (schema.groups ?? []).find((group) => group.id === id),
    );
    const renamed = unprefixedTables(id).length;
    if (!renamed) return;
    commit({
      ...schema,
      tables: schema.tables.map((table) =>
        table.schemaId === id
          ? { ...table, name: prefixTableName(table.name, prefix) }
          : table,
      ),
    });
    toast.success(
      `Prefixed ${renamed} ${renamed === 1 ? "table" : "tables"} with ${prefix}`,
    );
  };

  const assignTableToGroup = (tableId: string, schemaId: string) => {
    if (readOnly) return;
    commit({
      ...schema,
      tables: schema.tables.map((table) =>
        table.id === tableId
          ? { ...table, schemaId: schemaId || undefined }
          : table,
      ),
    });
  };

  const patchMemo = (id: string, patch: Partial<Memo>) =>
    commitWith((current) => ({
      ...current,
      memos: (current.memos ?? []).map((memo) =>
        memo.id === id ? { ...memo, ...patch } : memo,
      ),
    }));

  const deleteMemo = (id: string) => {
    commit({
      ...schema,
      memos: (schema.memos ?? []).filter((memo) => memo.id !== id),
    });
    if (editingMemoId === id) setEditingMemoId(null);
  };

  /** Keyboard parity for positioning a card that has focus. */
  const onCardKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, tableId: string) => {
      const deltas: Record<string, Vec> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      const delta = deltas[event.key];
      if (!delta) return;
      const table = schemaRef.current.tables.find(
        (item) => item.id === tableId,
      );
      if (!table) return;
      event.preventDefault();
      const step = NUDGE * (event.shiftKey ? 3 : 1);
      commitPosition(
        tableId,
        table.x + delta.x * step,
        table.y + delta.y * step,
      );
    },
    [commitPosition],
  );

  /** `tableId` comes from a card's context menu; the menubar and shortcut use the selection. */
  const makeJunction = useCallback(
    (tableId?: string) => {
      const schema = schemaRef.current;
      const left = schema.tables.find(
        (table) => table.id === (tableId ?? selectedIdRef.current),
      );
      if (!left || schema.tables.length < 2) return;
      const right = schema.tables.find((table) => table.id !== left.id);
      if (!right) return;
      const leftPk = primaryKeyColumns(left)[0];
      const rightPk = primaryKeyColumns(right)[0];
      if (!leftPk || !rightPk) return;
      /*
       * The junction belongs to whichever schema the table it was raised from
       * belongs to, and takes that schema's keyword once — built from the
       * stripped halves, so two prefixed parents give `MLL_LANGUAGES_CODES`
       * rather than `MLL_LANGUAGES_MLL_CODES`.
       */
      const prefix = groupPrefix(
        (schema.groups ?? []).find((group) => group.id === left.schemaId),
      );
      const junction = makeTable(
        prefixTableName(
          `${stripTablePrefix(left.name, prefix)}_${stripTablePrefix(right.name, prefix)}`,
          prefix,
        ),
        left.x + 330,
        left.y + 150,
        schema.tables.length,
      );
      junction.schemaId = left.schemaId;
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
      commitWith((current) =>
        normalizeRelationships({
          ...current,
          tables: [...current.tables, junction],
        }),
      );
      selectTable(junction.id);
    },
    [commitWith],
  );

  const copyText = useCallback(
    async (value: string, message = "Link copied.") => {
      try {
        await navigator.clipboard.writeText(value);
        toast.success(message);
      } catch {
        setShareError(
          "Clipboard access failed. Select and copy the link manually.",
        );
        toast.error("Clipboard access failed.");
      }
    },
    [],
  );

  /** Card context-menu actions. Stable, so a card can memoize on its props. */
  const editTableInPanel = useCallback((tableId: string) => {
    selectTable(tableId);
    setPanelTab("tables");
    setSidebarOpen(true);
  }, []);

  const copyTableDDL = useCallback(
    (tableId: string) => {
      const table = schemaRef.current.tables.find(
        (item) => item.id === tableId,
      );
      // Relationships to tables outside this subset are dropped by normalization.
      if (table)
        void copyText(generateDDL({ ...schemaRef.current, tables: [table] }));
    },
    [copyText],
  );

  const generateShareLink = async () => {
    setShareBusy(true);
    setShareError("");
    try {
      const query = workspaceSlug
        ? `?workspace=${encodeURIComponent(workspaceSlug)}`
        : "";
      const response = await fetch(`/api/projects/${projectId}/share${query}`, {
        method: "POST",
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url)
        throw new Error(body.error || "Could not create project link.");
      setShareLink(body.url);
      await copyText(body.url);
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Could not create project link.",
      );
    } finally {
      setShareBusy(false);
    }
  };

  const inviteToWorkspace = async () => {
    if (!workspaceSlug || !workspaceEmail.trim()) return;
    setWorkspaceInviteBusy(true);
    setShareError("");
    try {
      await (authClient.organization as any).setActive({
        organizationSlug: workspaceSlug,
      });
      const result = await (authClient.organization as any).inviteMember({
        organizationId: workspaceId,
        email: workspaceEmail.trim(),
        role: "member",
      });
      if (result.error || !result.data?.id)
        throw new Error(
          result.error?.message || "Could not create workspace invitation.",
        );
      const url = `${window.location.origin}/invite/${result.data.id}`;
      setWorkspaceInviteLink(url);
      await copyText(url);
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Could not create workspace invitation.",
      );
    } finally {
      setWorkspaceInviteBusy(false);
    }
  };
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
  const deleteSelection = () => {
    if (readOnly || !selectionCount(selection)) return;
    commit(removeSelection(schema, selection));
    setSelection(EMPTY_SELECTION);
  };

  /**
   * Copying is the same narrowing either way; only the format differs. DDL is
   * what you paste into a SQL client, JSON is what you paste into another
   * project — the envelope `mergeSchemaJson` reads on the way back in.
   */
  const copySelection = (format: "sql" | "json") => {
    if (!selectionCount(selection)) {
      toast.error("Nothing selected.");
      return;
    }
    const subset = selectionSchema(schema, selection);
    if (format === "sql" && !subset.tables.length) {
      toast.error("Select a table — memos and empty schemas carry no SQL.");
      return;
    }
    void copyText(
      format === "sql" ? generateDDL(subset) : exportSchemaJson(subset),
      format === "sql" ? "SQL copied." : "Copied as JSON.",
    );
  };

  /**
   * Paste rides the browser's own `paste` event rather than a ⌘V chord: it
   * hands us the clipboard text outright, where reading it ourselves needs a
   * permission prompt in Chrome and is refused in Firefox.
   *
   * `mergeSchemaJson` does the rest — it re-mints every id, rewires the foreign
   * keys, brings the groups and memos, and lands the arrivals below whatever is
   * already on the canvas. A table whose name the project already carries is
   * skipped, which is also why pasting back into the project you copied from
   * adds nothing; that is the import path's rule and the toast says so.
   */
  const pasteSelection = (text: string) => {
    const result = mergeSchemaJson(schemaRef.current, text);
    if (!result.schema) {
      toast.error(result.errors.join(" "));
      return;
    }
    commit(result.schema);
    setSelection({
      tables: result.added.map((table) => table.id),
      memos: [],
      groups: [],
    });
    revealTables(result.added);
    toast.success(
      `${result.added.length} table(s) pasted.${result.skipped.length ? ` Already here: ${result.skipped.join(", ")}.` : ""}`,
    );
  };

  /**
   * The listener below is bound once, so it reaches the current closures
   * through refs rather than through its dependency array.
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
      if (
        isEditingTarget(event.target) ||
        modal ||
        openMenu ||
        userMenuOpen ||
        confirmRevoke
      )
        return;
      event.preventDefault();
      if (!event.repeat) setSpaceHeld(true);
      return;
    }
    if (event.key === "Escape") {
      // Overlays dismiss themselves; Escape only clears canvas selection.
      if (modal || openMenu || userMenuOpen || confirmRevoke) return;
      setSelection(EMPTY_SELECTION);
      return;
    }
    const id = matchShortcut(event, isMac);
    const shortcut = id && shortcutById(id);
    if (!id || !shortcut) return;
    // An open layer owns the keyboard, apart from the help sheet itself.
    if (
      (modal || openMenu || userMenuOpen || confirmRevoke) &&
      id !== "shortcutsHelp"
    )
      return;
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
  const edgeSideRef = useRef(new Map<string, 1 | -1>());

  const relationshipPoint = (
    table: Table,
    index: number,
    other: Table,
    anchorKey: string,
  ) => {
    // Anchors follow the live position so edges stay attached mid-drag.
    const origin = livePosition(table);
    const otherOrigin = livePosition(other);

    const width = liveWidth(table);
    const right = origin.x + width;
    const otherRight = otherOrigin.x + liveWidth(other);

    // Comparing card extents ensures that when cards are clear of each other,
    // they leave facing each other (right edge to left edge, or vice versa).
    // Cards that overlap horizontally have no clear facing side, so both
    // ends route out the same flank (C-shaped curve) around whichever side
    // (left or right) has closer aligning edges.
    const raw: 1 | -1 =
      otherOrigin.x >= right
        ? 1
        : otherRight <= origin.x
          ? -1
          : Math.abs(right - otherRight) <= Math.abs(origin.x - otherOrigin.x)
            ? 1
            : -1;

    // Hysteresis: keep the previous direction unless the card position has moved
    // past the boundary margin to avoid edge flipping flicker.
    const HYSTERESIS = 30; // px
    const previous = edgeSideRef.current.get(anchorKey);
    let direction = raw;
    if (previous !== undefined && previous !== raw) {
      const keepsPrevious =
        previous === 1
          ? otherOrigin.x >= origin.x &&
            right - otherRight <=
              Math.abs(origin.x - otherOrigin.x) + HYSTERESIS
          : otherRight <= right &&
            origin.x - otherOrigin.x <=
              Math.abs(right - otherRight) + HYSTERESIS;
      if (keepsPrevious) direction = previous;
    }
    edgeSideRef.current.set(anchorKey, direction);

    return {
      x: origin.x + (direction === 1 ? width : 0),
      y: origin.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2,
      direction,
    };
  };

  const relationshipCardinalities = (relationship: Relationship) => {
    if (relationship.cardinality === "one_to_one") return ["1", "1"];
    if (relationship.cardinality === "one_to_many")
      return ["1", relationship.manyLabel || "n"];
    return [relationship.manyLabel || "n", "1"];
  };

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

          <ButtonGroup>
            <Button variant="outline" onClick={() => addColumn(table.id)}>
              <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
              Add column
            </Button>
            <Button variant="outline" onClick={() => makeJunction(table.id)}>
              <HugeiconsIcon icon={Link01Icon} data-icon="inline-start" />
              Junction
            </Button>
            <Button variant="outline" onClick={() => deleteTable(table.id)}>
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              Delete
            </Button>
          </ButtonGroup>
        </div>
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

  return (
    <div className={`app ${readOnly ? "share-read-only" : ""}`}>
      <header className="appbar items-center">
        <a className="appbar-brand" aria-label="PLStudio home" href="/">
          <BrandMark compact />
        </a>
        <div className="flex flex-col">
          <div className="appbar-title">
            <a
              className="appbar-crumb"
              href={workspaceSlug ? `/${workspaceSlug}` : "/"}
            >
              {workspaceSlug ? "Diagrams" : "My diagrams"}
            </a>
            <span className="appbar-slash">/</span>
            <Input
              className="appbar-name"
              aria-label="Diagram name"
              value={schema.name}
              onChange={(event) => {
                if (readOnly) return;
                commitWith((current) => ({
                  ...current,
                  name: event.target.value,
                }));
              }}
            />
          </div>
          <Menubar
            label="Diagram menus"
            count={menus.length}
            isOpen={openMenu !== null}
            onStepOpen={(direction) => {
              const current = menus.findIndex((menu) => menu.name === openMenu);
              setOpenMenu(
                menus[(current + direction + menus.length) % menus.length].name,
              );
            }}
          >
            {menus.map((menu, index) => (
              <Menu
                key={menu.name}
                name={menu.name}
                index={index}
                items={menu.items}
                open={openMenu === menu.name}
                anyOpen={openMenu !== null}
                onOpenChange={setOpenMenu}
              />
            ))}
          </Menubar>
        </div>
        <div className="appbar-actions">
          {/*
           * Feedback for save state: displays whether changes are saved,
           * unsaved, saving, or encountered a conflict/error. Clicking when
           * dirty saves the project.
           */}
          <Badge
            variant={
              saveState === "conflict" || saveState === "failed"
                ? "destructive"
                : dirty
                  ? "secondary"
                  : "ghost"
            }
            className={dirty && !readOnly ? "cursor-pointer select-none" : ""}
            onClick={dirty && !readOnly ? () => void save() : undefined}
            title={
              dirty && !readOnly ? "Click to save changes (⌘S)" : undefined
            }
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "conflict"
                ? "Conflict"
                : saveState === "failed"
                  ? "Not saved"
                  : dirty
                    ? "Unsaved changes"
                    : "Saved"}
          </Badge>
          <PeerAvatars peers={peers} status={collabStatus} />
          <Button className="share-btn" onClick={() => setModal("share")}>
            <HugeiconsIcon icon={Share08Icon} size={15} /> Share
          </Button>
          <NavUser
            user={user}
            isOpen={userMenuOpen}
            onOpenChange={setUserMenuOpen}
          />
        </div>
      </header>

      <SidebarProvider
        className={`body min-h-0 flex-1 ${isResizingSidebar ? "is-resizing" : ""}`}
        style={
          { "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties
        }
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      >
        {/* The sidebar sits below the app bar, not against the viewport top. */}
        <Sidebar
          className="top-(--appbar-height) h-[calc(100svh-var(--appbar-height))]"
          aria-label="Diagram structure"
        >
          <div
            className={`sidebar-resizer ${isResizingSidebar ? "resizing" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar width"
            title="Drag to resize sidebar · Double-click to reset width"
            onPointerDown={onSidebarResizeStart}
            onDoubleClick={() => updateSidebarWidth(417)}
          >
            <div className="sidebar-resizer-line" aria-hidden="true" />
          </div>
          <SidebarHeader className="panel-tabs">
            <SidebarTrigger aria-label="Hide side panel">
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </SidebarTrigger>
            <Tabs
              selectedKey={panelTab}
              onSelectionChange={(key) => setPanelTab(key as PanelTab)}
            >
              <TabsList variant="line">
                <TabsTrigger id="tables">
                  Tables ({schema.tables.length})
                </TabsTrigger>
                <TabsTrigger id="relationships">
                  Relationships ({relationshipRows.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </SidebarHeader>

          <SidebarContent>
            {panelMode === "code" ? (
              <ScrollArea className="panel-code">
                <pre>
                  <code>{highlightSql(ddl)}</code>
                </pre>
              </ScrollArea>
            ) : panelTab === "tables" ? (
              <>
                <div className="panel-toolbar">
                  <InputGroup>
                    <InputGroupAddon>
                      <HugeiconsIcon icon={Search01Icon} />
                    </InputGroupAddon>
                    <InputGroupInput
                      aria-label="Search tables"
                      placeholder="Search tables"
                      value={tableQuery}
                      onChange={(event) => setTableQuery(event.target.value)}
                    />
                  </InputGroup>
                  {/* The panel's primary action, so it carries more weight
                      than the search field it sits beside. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addTable()}
                  >
                    <HugeiconsIcon
                      icon={PlusSignIcon}
                      data-icon="inline-start"
                    />
                    Add table
                  </Button>
                </div>
                <ScrollArea className="panel-body">
                  {!schema.tables.length ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <HugeiconsIcon icon={DatabaseIcon} />
                        </EmptyMedia>
                        <EmptyTitle>No tables</EmptyTitle>
                        <EmptyDescription>
                          Start building your diagram!
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <Button onClick={() => addTable()}>
                          <HugeiconsIcon
                            icon={PlusSignIcon}
                            data-icon="inline-start"
                          />
                          Add table
                        </Button>
                      </EmptyContent>
                    </Empty>
                  ) : !filteredTables.length ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>No matches</EmptyTitle>
                        <EmptyDescription>
                          No table names contain “{tableQuery}”.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : !(schema.groups ?? []).length ? (
                    filteredTables.map((table) => tableEntity(table))
                  ) : (
                    tableSections.map((section) => {
                      const expanded =
                        Boolean(tableQuery.trim()) ||
                        !collapsedGroupIds.has(section.id);
                      return (
                        <Collapsible
                          className={`entity-group ${expanded ? "open" : ""}`}
                          key={section.id}
                          isExpanded={expanded}
                          onExpandedChange={(next) =>
                            setCollapsedGroupIds((current) => {
                              const ids = new Set(current);
                              if (next) ids.delete(section.id);
                              else ids.add(section.id);
                              return ids;
                            })
                          }
                        >
                          <CollapsibleTrigger className="entity-group-head">
                            <span
                              className="entity-group-dot"
                              style={{ background: section.accent }}
                              aria-hidden="true"
                            />
                            <span className="entity-group-name">
                              {section.name}
                            </span>
                            {section.prefix && (
                              <span className="entity-group-keyword">
                                {section.prefix}
                              </span>
                            )}
                            {/* The bare number is unambiguous beside the list it
                                counts; screen readers get the unit. */}
                            <span
                              className="entity-group-count"
                              title={`${section.tables.length} ${section.tables.length === 1 ? "table" : "tables"}`}
                              aria-label={`${section.tables.length} ${section.tables.length === 1 ? "table" : "tables"}`}
                            >
                              {section.tables.length}
                            </span>
                            <HugeiconsIcon
                              icon={ArrowDown01Icon}
                              className="entity-group-chevron"
                              aria-hidden="true"
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="entity-group-body">
                              {section.tables.length ? (
                                section.tables.map((table) =>
                                  tableEntity(table),
                                )
                              ) : (
                                <p className="entity-group-empty">
                                  No tables yet — assign one under Schema group.
                                </p>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })
                  )}
                </ScrollArea>
              </>
            ) : (
              <ScrollArea className="panel-body relationship-panel-body">
                <InputGroup className="relationship-search">
                  <InputGroupAddon>
                    <HugeiconsIcon icon={Search01Icon} />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label="Search relationships"
                    placeholder="Search relationships..."
                    value={relationshipQuery}
                    onChange={(event) =>
                      setRelationshipQuery(event.target.value)
                    }
                  />
                </InputGroup>
                {!relationshipRows.length ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon icon={Link01Icon} />
                      </EmptyMedia>
                      <EmptyTitle>No relationships</EmptyTitle>
                      <EmptyDescription>
                        Give a column a foreign key to link two tables.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  relationshipRows
                    .filter((row) =>
                      row.name
                        .toUpperCase()
                        .includes(relationshipQuery.trim().toUpperCase()),
                    )
                    .map((row) => {
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
                            setOpenRelationshipId(
                              expanded ? relationship.id : null,
                            )
                          }
                        >
                          <CollapsibleTrigger className="relationship-row relationship-editor-head">
                            <HugeiconsIcon
                              icon={Link01Icon}
                              aria-hidden="true"
                            />
                            <span className="relationship-copy">
                              <strong>{relationship.name}</strong>
                              <small>
                                {row.from} → {row.to} · {row.cardinality}
                              </small>
                            </span>
                            <HugeiconsIcon
                              icon={ArrowDown01Icon}
                              className="entity-chevron"
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="relationship-editor-body">
                              <FieldGroup className="gap-4">
                                <Field>
                                  <FieldLabel
                                    htmlFor={`rel-name-${relationship.id}`}
                                  >
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
                                    onClick={() =>
                                      swapRelationship(relationship)
                                    }
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
                                        <SelectItem id="one_to_one">
                                          One to one
                                        </SelectItem>
                                        <SelectItem id="one_to_many">
                                          One to many
                                        </SelectItem>
                                        <SelectItem id="many_to_one">
                                          Many to one
                                        </SelectItem>
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                </Field>
                                {relationship.cardinality !== "one_to_one" && (
                                  <Field>
                                    <FieldLabel
                                      htmlFor={`rel-many-${relationship.id}`}
                                    >
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
                                        {RELATIONSHIP_CONSTRAINTS.map(
                                          (constraint) => (
                                            <SelectItem
                                              key={constraint}
                                              id={constraint}
                                            >
                                              {constraint}
                                            </SelectItem>
                                          ),
                                        )}
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
                                        {RELATIONSHIP_CONSTRAINTS.map(
                                          (constraint) => (
                                            <SelectItem
                                              key={constraint}
                                              id={constraint}
                                            >
                                              {constraint}
                                            </SelectItem>
                                          ),
                                        )}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                </Field>
                              </FieldGroup>
                              <FieldSet className="relationship-pairs">
                                <FieldLegend variant="label">
                                  Composite key
                                </FieldLegend>
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
                                          fields: pairs.map(
                                            (item, pairIndex) =>
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
                                            <SelectItem
                                              key={column.id}
                                              id={column.id}
                                            >
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
                                          fields: pairs.map(
                                            (item, pairIndex) =>
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
                                            <SelectItem
                                              key={column.id}
                                              id={column.id}
                                            >
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
                                              (_, pairIndex) =>
                                                pairIndex !== index,
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
                                        !pairs.some(
                                          (pair) =>
                                            pair.startFieldId === column.id,
                                        ),
                                    );
                                    const end = endTable?.columns.find(
                                      (column) =>
                                        !pairs.some(
                                          (pair) =>
                                            pair.endFieldId === column.id,
                                        ),
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
                                  <HugeiconsIcon
                                    icon={PlusSignIcon}
                                    data-icon="inline-start"
                                  />{" "}
                                  Add field
                                </Button>
                              </FieldSet>
                              <Button
                                variant="outline"
                                className="relationship-delete"
                                isDisabled={readOnly}
                                onClick={() =>
                                  deleteRelationship(relationship.id)
                                }
                              >
                                <HugeiconsIcon
                                  icon={Delete02Icon}
                                  data-icon="inline-start"
                                />{" "}
                                Delete relationship
                              </Button>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })
                )}
              </ScrollArea>
            )}
          </SidebarContent>

          <SidebarFooter className="p-0">
            <div className="panel-footer">
              <span className="counter">
                <HugeiconsIcon icon={DatabaseIcon} aria-hidden="true" />
                {schema.tables.length}
                <span className="sr-only">tables</span>
              </span>
              <span className="counter">
                <HugeiconsIcon icon={Link01Icon} aria-hidden="true" />
                {relationshipRows.length}
                <span className="sr-only">relationships</span>
              </span>
              <ToggleGroup
                aria-label="Panel view"
                size="sm"
                spacing={0}
                variant="outline"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[panelMode]}
                onSelectionChange={(keys) => {
                  const [key] = [...keys];
                  if (key) setPanelMode(key as PanelMode);
                }}
              >
                <ToggleGroupItem id="structure">
                  <HugeiconsIcon icon={GridViewIcon} data-icon="inline-start" />
                  Structure
                </ToggleGroupItem>
                <ToggleGroupItem id="code">
                  <HugeiconsIcon
                    icon={SourceCodeIcon}
                    data-icon="inline-start"
                  />
                  Code
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <Collapsible
              className="issues-bar"
              isExpanded={issuesOpen}
              onExpandedChange={setIssuesOpen}
            >
              <CollapsibleTrigger className="issues-head">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  className={errors.length ? "warn danger" : "warn"}
                />
                <span>Issues</span>
                <Badge variant={errors.length ? "destructive" : "secondary"}>
                  {issues.length}
                </Badge>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className="issues-chevron"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ScrollArea className="issues-list">
                  {!issues.length ? (
                    <p className="issues-empty">No problems found.</p>
                  ) : (
                    issues.slice(0, 40).map((issue) => (
                      <Button
                        variant="ghost"
                        className={`issue ${issue.severity}`}
                        key={`${issue.message}-${issue.columnId ?? issue.tableId ?? ""}`}
                        onClick={() =>
                          issue.tableId && selectTable(issue.tableId)
                        }
                      >
                        {issue.message}
                      </Button>
                    ))
                  )}
                </ScrollArea>
              </CollapsibleContent>
            </Collapsible>
          </SidebarFooter>
        </Sidebar>

        {!sidebarOpen && (
          <SidebarTrigger className="panel-reveal" aria-label="Show side panel">
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </SidebarTrigger>
        )}

        <div
          ref={canvasRef}
          className={`canvas-wrap ${grabbing ? "grabbing" : ""} ${grabbing || dragPosition || marquee || dragSelection ? "gesturing" : ""} ${panMode ? "pan-mode" : ""}`}
          onPointerDownCapture={onCanvasDownCapture}
          onPointerDown={onCanvasDown}
          onPointerMove={(event) => {
            // Canvas space, not screen space: peers at other zoom levels must
            // see the pointer over the same table, not the same pixel.
            setCursor(canvasPoint(event));
            if (linking)
              setLinking((current) =>
                current ? { ...current, ...canvasPoint(event) } : current,
              );
          }}
          onPointerLeave={() => setCursor(null)}
          onPointerUp={finishLinking}
          onPointerCancel={(event) => {
            if (linking?.pointerId === event.pointerId) setLinking(null);
          }}
          style={gridStyle}
        >
          <div
            className="canvas"
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              willChange: grabbing || dragPosition ? "transform" : undefined,
            }}
          >
            {(schema.groups ?? []).map((group) => {
              const position = liveGroup(group);
              const palette = GROUP_PALETTE[group.color];
              const selectedGroup = selectedGroupId === group.id;
              const inSet = !single && isSelected(selection, "group", group.id);
              const moving = dragGroupPosition?.id === group.id;
              const prefix = groupPrefix(group);
              const pendingPrefix = unprefixedTables(group.id).length;
              return (
                <section
                  className={`schema-group ${selectedGroup ? "selected" : ""} ${inSet ? "multi-selected" : ""} ${moving ? "moving" : ""}`}
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
                    pressSelection(event, "group", group.id);
                  }}
                >
                  <ContextMenuTrigger
                    onOpenChange={(open) =>
                      open && setSelection(selectOnly("group", group.id))
                    }
                  >
                    <div
                      className="schema-group-head"
                      style={{
                        background: palette.header,
                        color: palette.text,
                        borderColor: palette.border,
                      }}
                      onPointerDown={(event) => onGroupDown(event, group)}
                    >
                      <HugeiconsIcon
                        icon={DatabaseIcon}
                        size={15}
                        aria-hidden="true"
                      />
                      {/* Ahead of the name, in the order it reads on the cards below. */}
                      <input
                        className="schema-group-keyword"
                        aria-label={`Table name prefix for schema group ${group.name}`}
                        value={group.keyword ?? ""}
                        placeholder={keywordHint(group.name)}
                        maxLength={12}
                        size={1}
                        spellCheck={false}
                        disabled={readOnly}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          patchGroup(group.id, { keyword: event.target.value })
                        }
                      />
                      <input
                        className="schema-group-name"
                        aria-label={`Name of schema group ${group.name}`}
                        value={group.name}
                        disabled={readOnly}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          patchGroup(group.id, { name: event.target.value })
                        }
                      />
                      <div
                        className="schema-group-actions"
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <ToggleGroup
                          aria-label="Group color"
                          selectionMode="single"
                          disallowEmptySelection
                          isDisabled={readOnly}
                          selectedKeys={[group.color]}
                          onSelectionChange={(keys) => {
                            const [key] = [...keys];
                            if (key)
                              patchGroup(group.id, {
                                color: key as SchemaGroup["color"],
                              });
                          }}
                        >
                          {Object.entries(GROUP_PALETTE).map(
                            ([color, option]) => (
                              <ToggleGroupItem
                                key={color}
                                id={color}
                                className="schema-group-color"
                                aria-label={`Use ${color} group color`}
                                style={{ background: option.border }}
                              />
                            ),
                          )}
                        </ToggleGroup>
                        <TooltipTrigger>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete schema group ${group.name}`}
                            isDisabled={readOnly}
                            onClick={() => deleteGroup(group.id)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} />
                          </Button>
                          <Tooltip>Delete group</Tooltip>
                        </TooltipTrigger>
                      </div>
                    </div>
                    <ContextMenu className="w-auto">
                      <ContextMenuLabel>{group.name}</ContextMenuLabel>
                      <ContextMenuGroup>
                        <ContextMenuItem
                          isDisabled={readOnly}
                          onAction={() => addTable(group.id)}
                        >
                          <HugeiconsIcon icon={Table01Icon} />
                          Add table to this schema
                        </ContextMenuItem>
                        <ContextMenuItem
                          isDisabled={readOnly || !pendingPrefix}
                          onAction={() => applyGroupKeyword(group.id)}
                        >
                          <HugeiconsIcon icon={Tag01Icon} />
                          {prefix
                            ? `Prefix ${pendingPrefix || "no"} ${pendingPrefix === 1 ? "table" : "tables"} with ${prefix}`
                            : "Set a keyword to prefix tables"}
                        </ContextMenuItem>
                      </ContextMenuGroup>
                      <ContextMenuSeparator />
                      <ContextMenuGroup>
                        <ContextMenuItem
                          isDisabled={readOnly}
                          onAction={() => deleteGroup(group.id)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} />
                          Delete schema group
                        </ContextMenuItem>
                      </ContextMenuGroup>
                    </ContextMenu>
                  </ContextMenuTrigger>
                  <button
                    type="button"
                    className="schema-group-resize"
                    aria-label={`Resize schema group ${group.name}. Arrow keys resize, Shift for larger steps.`}
                    disabled={readOnly}
                    onPointerDown={(event) => onGroupResizeDown(event, group)}
                    onKeyDown={(event) => {
                      const delta = resizeDelta(event);
                      if (!delta) return;
                      event.preventDefault();
                      event.stopPropagation();
                      commitGroupSize(
                        group.id,
                        position.width + delta[0],
                        position.height + delta[1],
                      );
                    }}
                  />
                </section>
              );
            })}
            {(schema.memos ?? []).map((memo) => {
              const position = liveMemo(memo);
              const color =
                MEMO_COLORS.find((item) => item.id === memo.color) ??
                MEMO_COLORS[0];
              const selectedMemo = selectedMemoId === memo.id;
              const inSet = !single && isSelected(selection, "memo", memo.id);
              return (
                <article
                  className={`memo-card ${selectedMemo ? "selected" : ""} ${inSet ? "multi-selected" : ""}`}
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
                    // The pointerdown already decided this; re-running it here
                    // would undo a Shift-click toggle a moment after it landed.
                    if (event.shiftKey || event.metaKey || event.ctrlKey)
                      return;
                    if (isSelected(selectionRef.current, "memo", memo.id))
                      return;
                    setSelection(selectOnly("memo", memo.id));
                  }}
                  onKeyDown={(event) => {
                    if (
                      (event.key === "Delete" || event.key === "Backspace") &&
                      document.activeElement?.tagName !== "TEXTAREA"
                    ) {
                      event.preventDefault();
                      // The window handler would delete it a second time and split the undo step.
                      event.stopPropagation();
                      deleteMemo(memo.id);
                    }
                  }}
                >
                  <div
                    className="memo-toolbar"
                    onPointerDown={(event) => onMemoDown(event, memo)}
                  >
                    <HugeiconsIcon
                      icon={StickyNote01Icon}
                      size={14}
                      aria-hidden="true"
                    />
                    <div
                      className="memo-actions"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <ToggleGroup
                        aria-label="Memo color"
                        selectionMode="single"
                        disallowEmptySelection
                        selectedKeys={[memo.color]}
                        onSelectionChange={(keys) => {
                          const [key] = [...keys];
                          if (key)
                            patchMemo(memo.id, { color: key as MemoColor });
                        }}
                      >
                        {MEMO_COLORS.map((option) => (
                          <ToggleGroupItem
                            key={option.id}
                            id={option.id}
                            className={`memo-color memo-color-${option.id}`}
                            aria-label={`Use ${option.label} memo color`}
                          />
                        ))}
                      </ToggleGroup>
                      <TooltipTrigger>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete memo"
                          onClick={() => deleteMemo(memo.id)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} />
                        </Button>
                        <Tooltip>Delete memo</Tooltip>
                      </TooltipTrigger>
                    </div>
                  </div>
                  <textarea
                    className="memo-text"
                    value={memo.text}
                    aria-label="Memo text"
                    placeholder="Write a memo..."
                    onFocus={() => {
                      setSelection(selectOnly("memo", memo.id));
                      setEditingMemoId(memo.id);
                      if (memo.text.trim()) memoHadText.current.add(memo.id);
                    }}
                    onChange={(event) => {
                      if (event.target.value.trim())
                        memoHadText.current.add(memo.id);
                      patchMemo(memo.id, { text: event.target.value });
                    }}
                    onBlur={() => {
                      setEditingMemoId((current) =>
                        current === memo.id ? null : current,
                      );
                      if (
                        !memo.text.trim() &&
                        !memoHadText.current.has(memo.id)
                      )
                        deleteMemo(memo.id);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="memo-resize"
                    aria-label="Resize memo. Arrow keys resize, Shift for larger steps."
                    onPointerDown={(event) => onMemoResizeDown(event, memo)}
                    onKeyDown={(event) => {
                      const delta = resizeDelta(event);
                      if (!delta) return;
                      event.preventDefault();
                      event.stopPropagation();
                      commitMemoSize(
                        memo.id,
                        position.width + delta[0],
                        position.height + delta[1],
                      );
                    }}
                  />
                  {editingMemoId === memo.id && (
                    <span className="memo-edit-hint">Editing</span>
                  )}
                </article>
              );
            })}
            {/*
              No width or height: the overlay is pinned to the canvas origin
              and paints outside its own box (`overflow: visible`), so an edge
              between two cards a long way out still draws.
            */}
            <svg className="edges" aria-hidden="true">
              {relationships.map((relationship) => {
                const from = relationshipPoint(
                  relationship.from,
                  relationship.fromIndex,
                  relationship.to,
                  `${relationship.id}:from`,
                );
                const to = relationshipPoint(
                  relationship.to,
                  relationship.toIndex,
                  relationship.from,
                  `${relationship.id}:to`,
                );
                const [fromCardinality, toCardinality] =
                  relationshipCardinalities(relationship.relationship);
                return (
                  <RelationshipEdge
                    key={relationship.id}
                    fromX={from.x}
                    fromY={from.y}
                    fromDirection={from.direction}
                    toX={to.x}
                    toY={to.y}
                    toDirection={to.direction}
                    fromCardinality={fromCardinality}
                    toCardinality={toCardinality}
                    label={relationship.relationship.name}
                    active={
                      selectedId === relationship.from.id ||
                      selectedId === relationship.to.id
                    }
                    showCardinality={relationSettings.showCardinality}
                    showLabel={relationSettings.showRelationshipLabels}
                  />
                );
              })}
            </svg>
            {schema.tables.map((table) => {
              const position = livePosition(table);
              const moving = dragPosition?.id === table.id;
              const heldBy = peerSelection.get(table.id);
              return (
                <TableCard
                  key={table.id}
                  table={table}
                  x={position.x}
                  y={position.y}
                  width={liveWidth(table)}
                  moving={moving}
                  selected={selectedId === table.id}
                  multiSelected={
                    !single && isSelected(selection, "table", table.id)
                  }
                  resizing={resizeTable?.id === table.id}
                  hoverDisabled={moving || grabbing || linking !== null}
                  heldByName={heldBy?.user.name}
                  heldByColor={heldBy?.color}
                  group={
                    table.schemaId ? groupsById.get(table.schemaId) : undefined
                  }
                  relationshipCount={relationshipCounts.get(table.id) ?? 0}
                  foreignKeyTarget={foreignKeyTarget}
                  readOnly={readOnly}
                  isMac={isMac}
                  onSelect={selectTable}
                  onHeaderDown={onHeaderDown}
                  onResizeDown={onTableResizeDown}
                  onResizeKeyDown={onTableResizeKeyDown}
                  onResetWidth={resetTableWidth}
                  onKeyDown={onCardKeyDown}
                  onStartLink={startLinking}
                  onEditInPanel={editTableInPanel}
                  onCopyDDL={copyTableDDL}
                  onAddColumn={addColumn}
                  onMakeJunction={makeJunction}
                  onDeleteTable={deleteTable}
                  reorderColumns={reorderColumns}
                />
              );
            })}
            {multiFrame && (
              <div
                className="selection-frame"
                aria-hidden="true"
                style={{
                  transform: `translate3d(${multiFrame.x}px, ${multiFrame.y}px, 0)`,
                  width: multiFrame.width,
                  height: multiFrame.height,
                }}
              />
            )}
            {marquee && (
              <div
                className="marquee"
                aria-hidden="true"
                style={{
                  transform: `translate3d(${marquee.x}px, ${marquee.y}px, 0)`,
                  width: marquee.width,
                  height: marquee.height,
                }}
              />
            )}
            <PeerCursors peers={peers} zoom={zoom} />
          </div>

          {/*
            Anchored to the frame but drawn in screen space and never scaled:
            a toolbar that shrank with the zoom would be unreadable at the point
            you most need it. Hidden mid-gesture — chrome that follows a drag is
            noise, and the frame is doing the work of showing what is held.
          */}
          {multiFrame && !dragSelection && !marquee && (
            <div
              className="selection-toolbar"
              style={{
                transform: `translate3d(${pan.x + (multiFrame.x + multiFrame.width / 2) * zoom}px, ${pan.y + multiFrame.y * zoom}px, 0)`,
              }}
            >
              <span className="selection-toolbar-count">
                {selectionCount(selection)} selected
              </span>
              <button
                type="button"
                onClick={() => copySelection("sql")}
                title={`Copy as SQL (${hint("copySelectionSql")})`}
              >
                Copy SQL
              </button>
              <button
                type="button"
                onClick={() => copySelection("json")}
                title={`Copy as JSON (${hint("copySelectionJson")})`}
              >
                Copy JSON
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className="selection-toolbar-danger"
                  onClick={deleteSelection}
                  title={`Delete (${hint("deleteSelection")})`}
                >
                  Delete
                </button>
              )}
            </div>
          )}

          {linking && (
            <svg
              className="linking-overlay"
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

          {/*
            Grouped by what each control changes: the viewport, then history,
            then what the diagram contains, then the document as a whole.
            Proximity is a claim about relationship, so a command that moves the
            camera cannot sit among the ones that add tables.
          */}
          <ButtonGroup className="dock" aria-label="Canvas controls">
            <DockButton
              label="Hand tool"
              icon={HandGrabIcon}
              shortcut="toggleHand"
              isMac={isMac}
              isActive={panMode}
              onClick={() => setHandMode((on) => !on)}
            />
            <DockButton
              label="Zoom out"
              icon={ZoomOutAreaIcon}
              shortcut="zoomOut"
              isMac={isMac}
              onClick={() => zoomBy(-0.1)}
            />
            <span className="dock-zoom">{Math.round(zoom * 100)}%</span>
            <DockButton
              label="Zoom in"
              icon={ZoomInAreaIcon}
              shortcut="zoomIn"
              isMac={isMac}
              onClick={() => zoomBy(0.1)}
            />
            <DockButton
              label="Fit to screen"
              icon={Maximize01Icon}
              shortcut="fitView"
              isMac={isMac}
              onClick={fitView}
            />
            <Separator orientation="vertical" />
            <DockButton
              label="Undo"
              icon={ArrowTurnBackwardIcon}
              shortcut="undo"
              isMac={isMac}
              isDisabled={!canUndo}
              disabledReason="Nothing to undo yet"
              onClick={undo}
            />
            <DockButton
              label="Redo"
              icon={ArrowTurnForwardIcon}
              shortcut="redo"
              isMac={isMac}
              isDisabled={!canRedo}
              disabledReason="Nothing to redo"
              onClick={redo}
            />
            <Separator orientation="vertical" />
            <DockButton
              label="Add table"
              icon={Table01Icon}
              shortcut="addTable"
              isMac={isMac}
              onClick={() => addTable()}
            />
            <DockButton
              label="Add schema group"
              icon={Layers01Icon}
              shortcut="addGroup"
              isMac={isMac}
              onClick={addGroup}
            />
            <DockButton
              label="Add memo"
              icon={StickyNote01Icon}
              shortcut="addMemo"
              isMac={isMac}
              onClick={addMemo}
            />
            <DockButton
              label="Add junction table"
              icon={Link01Icon}
              shortcut="junction"
              isMac={isMac}
              isDisabled={!selected}
              disabledReason="Select a table first"
              onClick={makeJunction}
            />
            <Separator orientation="vertical" />
            <DockButton
              label="Tidy up layout"
              icon={GridViewIcon}
              shortcut="tidyLayout"
              isMac={isMac}
              onClick={autoLayout}
            />
            <DockButton
              label="Save to database"
              icon={FloppyDiskIcon}
              shortcut="save"
              isMac={isMac}
              onClick={() => void save()}
            />
            <DockButton
              label="Export"
              icon={Download04Icon}
              shortcut="export"
              isMac={isMac}
              onClick={() => setModal("export")}
            />
          </ButtonGroup>
          {/*
            The zoom readout is not itself a live region: it changes on every
            frame of a ctrl-scroll, which would announce a flood. This settles
            first and announces the number the gesture landed on.
          */}
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {settledZoom}% zoom
          </span>
        </div>
      </SidebarProvider>

      <Dialog
        isOpen={modal === "share"}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <DialogHeader>
          <DialogTitle>Share project</DialogTitle>
          <DialogDescription>
            Invite people to collaborate on this diagram.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel>Project invite link</FieldLabel>
            <FieldDescription>
              Anyone with the link can preview the project. Sign-in is required
              to edit.
            </FieldDescription>
            {shareLink ? (
              <div className="flex gap-2">
                <Input
                  aria-label="Project invite link"
                  value={shareLink}
                  readOnly
                />
                <Button
                  variant="outline"
                  onClick={() => void copyText(shareLink)}
                >
                  <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
                  Copy
                </Button>
              </div>
            ) : (
              <Button
                className="self-start"
                isDisabled={shareBusy}
                onClick={() => void generateShareLink()}
              >
                {shareBusy ? "Generating…" : "Generate invite link"}
              </Button>
            )}
            {shareLink && (
              <Button
                variant="outline"
                className="self-start"
                isDisabled={shareBusy}
                onClick={() => setConfirmRevoke(true)}
              >
                Revoke and generate new link
              </Button>
            )}
          </Field>
          {workspaceSlug && (
            <Field>
              <FieldLabel>Invite to workspace</FieldLabel>
              <FieldDescription>
                Send a single-use invitation to a workspace member.
              </FieldDescription>
              <div className="flex gap-2">
                <Input
                  aria-label="Invitee email"
                  type="email"
                  placeholder="person@example.com"
                  value={workspaceEmail}
                  onChange={(event) => setWorkspaceEmail(event.target.value)}
                />
                <Button
                  isDisabled={workspaceInviteBusy || !workspaceEmail.trim()}
                  onClick={() => void inviteToWorkspace()}
                >
                  {workspaceInviteBusy ? "Generating…" : "Generate link"}
                </Button>
              </div>
              {workspaceInviteLink && (
                <div className="flex gap-2">
                  <Input
                    aria-label="Workspace invitation link"
                    value={workspaceInviteLink}
                    readOnly
                  />
                  <Button
                    variant="outline"
                    onClick={() => void copyText(workspaceInviteLink)}
                  >
                    <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
                    Copy
                  </Button>
                </div>
              )}
            </Field>
          )}
          {shareError && (
            <Alert variant="destructive">
              <AlertTitle>{shareError}</AlertTitle>
            </Alert>
          )}
        </FieldGroup>
      </Dialog>

      <AlertDialog isOpen={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke this link?</AlertDialogTitle>
          <AlertDialogDescription>
            The current link stops working immediately and a new one is
            generated in its place.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setConfirmRevoke(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setConfirmRevoke(false);
              void generateShareLink();
            }}
          >
            Revoke and generate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>

      <ExportModal
        isOpen={modal === "export"}
        onOpenChange={(open) => !open && setModal(null)}
        schema={schema}
        errors={errors}
        onClearInvalidForeignKeys={clearInvalidForeignKeys}
      />

      <ImportModal
        isOpen={modal === "import"}
        onOpenChange={(open) => !open && setModal(null)}
        schema={schema}
        readOnly={readOnly}
        message={importMessage}
        onMessage={setImportMessage}
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
      />

      <Dialog
        isOpen={modal === "shortcuts"}
        onOpenChange={(open) => !open && setModal(null)}
        className="sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Editing shortcuts are unavailable on a read-only link."
              : "Bare-letter shortcuts pause while you are typing in a field."}
          </DialogDescription>
        </DialogHeader>
        <div className="shortcut-sheet">
          {SHORTCUT_GROUPS.map((group) => (
            <section className="shortcut-group" key={group}>
              <h3 className="shortcut-group-title">{group}</h3>
              <dl className="shortcut-list">
                {SHORTCUTS.filter((shortcut) => shortcut.group === group).map(
                  (shortcut) => (
                    <div
                      className="shortcut-row"
                      key={shortcut.id}
                      aria-disabled={shortcut.mutating && readOnly}
                    >
                      <dt>{shortcut.label}</dt>
                      <dd>
                        <ShortcutKeys id={shortcut.id} isMac={isMac} />
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            </section>
          ))}
          <section className="shortcut-group">
            <h3 className="shortcut-group-title">Selection</h3>
            <dl className="shortcut-list">
              <div className="shortcut-row">
                <dt>Clear selection</dt>
                <dd>
                  <KbdGroup>
                    <Kbd>{isMac ? "esc" : "Esc"}</Kbd>
                  </KbdGroup>
                </dd>
              </div>
              <div className="shortcut-row">
                <dt>Nudge the focused table</dt>
                <dd>
                  <KbdGroup>
                    <Kbd>←</Kbd>
                    <Kbd>↑</Kbd>
                    <Kbd>↓</Kbd>
                    <Kbd>→</Kbd>
                  </KbdGroup>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </Dialog>
    </div>
  );
}
