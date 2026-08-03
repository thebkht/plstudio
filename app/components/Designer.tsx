"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
  Cancel01Icon,
  Copy01Icon,
  DatabaseIcon,
  Delete02Icon,
  Download04Icon,
  FileUploadIcon,
  FloppyDiskIcon,
  GridViewIcon,
  Key01Icon,
  Link01Icon,
  Maximize01Icon,
  PlusSignIcon,
  Search01Icon,
  Share08Icon,
  SourceCodeIcon,
  StickyNote01Icon,
  Table01Icon,
  Tick02Icon,
  UserCircleIcon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DialogFooter,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  tableWidth,
  typeSizePlaceholder,
  typeUsesSize,
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
    const width = tableWidth(table);
    const otherWidth = tableWidth(other);
    return x < other.x + otherWidth + gap && x + width + gap > other.x && y < other.y + tableHeight(other) + gap && y + tableHeight(table) + gap > other.y;
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
      const free = candidates.find((candidate) => candidate.x >= 0 && candidate.y >= 0 && candidate.x <= CANVAS_WIDTH - tableWidth(table) && candidate.y <= CANVAS_HEIGHT - tableHeight(table) && !overlaps(table, candidate.x, candidate.y));
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

/**
 * SVG text cannot ellipsize in CSS, and generated FK names run long enough to
 * cross the tables they connect. The full name stays in the Relationships panel.
 */
const ellipsize = (text: string, max = 30) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

type ExportTab = "ddl" | "plsql" | "combined";
type PanelTab = "tables" | "relationships";
type PanelMode = "structure" | "code";

/** Select needs a real key for "no selection", since null renders the placeholder. */
const NO_GROUP = "__ungrouped__";
const NO_REFERENCE = "__no_reference__";

const exportTabs = [
  ["ddl", "DDL"],
  ["plsql", "PL/SQL Packages"],
  ["combined", "Combined"],
] as const satisfies ReadonlyArray<readonly [ExportTab, string]>;

type MenuItem =
  | { label: string; onSelect: () => void; disabled?: boolean; hint?: string }
  | { separator: true };

const KEY_STRATEGY_LABEL: Record<KeyStrategy, string> = {
  "sequence-trigger": "Sequence + trigger",
  identity: "Generated identity",
  none: "Manual / none",
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}

/** Summary for the table header, so the whole card need not be read column by column. */
function TableSummaryCard({
  table,
  group,
  relationshipCount,
}: {
  table: Table;
  group?: SchemaGroup;
  relationshipCount: number;
}) {
  const pk = primaryKeyColumns(table);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <strong className="min-w-0 truncate">{table.name.toUpperCase()}</strong>
        <span className="shrink-0 text-xs text-muted-foreground">
          {table.columns.length} columns
        </span>
      </div>
      <Separator />
      <div className="flex flex-col gap-1 text-xs">
        <Detail
          label="Primary key"
          value={
            pk.length
              ? pk.map((column) => column.name.toUpperCase()).join(", ")
              : "None"
          }
        />
        <Detail label="Keys" value={KEY_STRATEGY_LABEL[table.keyStrategy]} />
        <Detail label="Schema group" value={group?.name ?? "Ungrouped"} />
        <Detail label="Relationships" value={String(relationshipCount)} />
        {table.comment?.trim() && (
          <Detail label="Comment" value={table.comment} />
        )}
      </div>
    </div>
  );
}

/** The hover card mirrors what the side panel shows, without a round trip. */
function ColumnCard({
  table,
  column,
  reference,
}: {
  table: Table;
  column: Column;
  reference?: { table: Table; column: Column };
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <strong className="min-w-0 truncate">{column.name.toUpperCase()}</strong>
        <span
          className="shrink-0 font-mono text-xs"
          style={{ color: typeColorVar(column.type) }}
        >
          {column.type}
          {column.size ? `(${column.size})` : ""}
        </span>
      </div>
      {(column.pk || column.unique || column.notNull || column.fk) && (
        <div className="flex flex-wrap gap-1">
          {column.pk && <Badge variant="secondary">Primary key</Badge>}
          {column.fk && <Badge variant="secondary">Foreign key</Badge>}
          {column.unique && <Badge variant="secondary">Unique</Badge>}
          {column.notNull && <Badge variant="secondary">Not null</Badge>}
        </div>
      )}
      <Separator />
      <div className="flex flex-col gap-1 text-xs">
        <Detail label="Table" value={table.name.toUpperCase()} />
        {reference && (
          <Detail
            label="References"
            value={`${reference.table.name.toUpperCase()}(${reference.column.name.toUpperCase()})`}
          />
        )}
        {column.defaultValue.trim() && (
          <Detail label="Default" value={column.defaultValue} />
        )}
        {column.check.trim() && <Detail label="Check" value={column.check} />}
        {column.comment?.trim() && (
          <Detail label="Comment" value={column.comment} />
        )}
      </div>
    </div>
  );
}

/** Dock controls are icon-only, so each one carries its label as a tooltip. */
function DockButton({
  label,
  icon,
  isDisabled,
  onClick,
}: {
  label: string;
  icon: IconSvgElement;
  isDisabled?: boolean;
  onClick: () => void;
}) {
  return (
    <TooltipTrigger>
      <Button
        variant="ghost"
        size="icon"
        aria-label={label}
        isDisabled={isDisabled}
        onClick={onClick}
      >
        <HugeiconsIcon icon={icon} />
      </Button>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}

type MenuAction = Exclude<MenuItem, { separator: true }>;

/** Separators delimit groups rather than being items, which is what MenuSection expects. */
const groupBySeparator = (items: MenuItem[]) =>
  items
    .reduce<MenuAction[][]>(
      (groups, item) => {
        if ("separator" in item) groups.push([]);
        else groups[groups.length - 1].push(item);
        return groups;
      },
      [[]],
    )
    .filter((group) => group.length > 0);

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
  return (
    <DropdownMenuTrigger
      isOpen={open}
      onOpenChange={(next) => onOpenChange(next ? name : null)}
    >
      <Button
        variant="ghost"
        size="sm"
        onPointerEnter={() => anyOpen && onOpenChange(name)}
      >
        {name}
      </Button>
      <DropdownMenu className="w-auto min-w-52">
        {groupBySeparator(items).map((group, index) => (
          <Fragment key={group[0].label}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {group.map((item) => (
                <DropdownMenuItem
                  key={item.label}
                  isDisabled={item.disabled}
                  onAction={() => void item.onSelect()}
                >
                  {item.label}
                  {item.hint && (
                    <DropdownMenuShortcut>{item.hint}</DropdownMenuShortcut>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenu>
    </DropdownMenuTrigger>
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
  const [modal, setModal] = useState<"export" | "import" | "share" | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [workspaceEmail, setWorkspaceEmail] = useState("");
  const [workspaceInviteLink, setWorkspaceInviteLink] = useState("");
  const [workspaceInviteBusy, setWorkspaceInviteBusy] = useState(false);
  const [exportTab, setExportTab] = useState<ExportTab>("ddl");
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>("tables");
  const [panelMode, setPanelMode] = useState<PanelMode>("structure");
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
      toast.success("Overlapping tables were separated.");
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
          toast.success(`Linked ${child.table.name}.${child.column.name} to ${parent.table.name}.${parent.column.name}.`);
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
  const foreignKeyTarget = (column: Column) => {
    if (!column.fk) return undefined;
    const target = schema.tables.find((item) => item.id === column.fk!.tableId);
    const targetColumn = target?.columns.find(
      (item) => item.id === column.fk!.columnId,
    );
    return target && targetColumn
      ? { table: target, column: targetColumn }
      : undefined;
  };

  /** Relationships to tables outside this subset are dropped by normalization. */
  const tableDDL = (table: Table) =>
    generateDDL({ ...schema, tables: [table] });

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

  /** Where a table may rest, in canvas coordinates. */
  const tableBounds = useCallback(
    (table: Table) => ({
      minX: 0,
      maxX: CANVAS_WIDTH - tableWidth(table),
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
      const width = tableWidth(table);
      const otherWidth = tableWidth(other);
      return position.x < other.x + otherWidth + 18 &&
        position.x + width + 18 > other.x &&
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
      const tableCenter = { x: target.x + tableWidth(table) / 2, y: target.y + tableHeight(table) / 2 };
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
    const group = current.groups.find((item) => item.id === id);
    if (!group) return;
    const nextWidth = Math.max(GROUP_MIN_WIDTH, Math.min(CANVAS_WIDTH - group.x, Math.round(width)));
    const nextHeight = Math.max(GROUP_MIN_HEIGHT, Math.min(CANVAS_HEIGHT - group.y, Math.round(height)));
    setHistory((items) => [...items.slice(-49), cloneSchema(current)]);
    setFuture([]);
    setSchema((next) => ({
      ...next,
      groups: (next.groups ?? []).map((item) => item.id === id ? {
        ...item,
        width: nextWidth,
        height: nextHeight,
      } : item),
      tables: next.tables.map((table) => {
        if (table.schemaId !== undefined && table.schemaId !== id) return table;
        const centerX = table.x + tableWidth(table) / 2;
        const centerY = table.y + tableHeight(table) / 2;
        const inside = centerX >= group.x && centerX <= group.x + nextWidth && centerY >= group.y + GROUP_HEADER_HEIGHT && centerY <= group.y + nextHeight;
        return { ...table, schemaId: inside ? id : undefined };
      }),
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
      toast.success("Link copied.");
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
        toast.error("This project changed elsewhere.", {
          description: "Saving now would overwrite the other changes.",
          duration: Infinity,
          action: { label: "Overwrite", onClick: () => void save(true) },
        });
        return;
      }
      if (response.ok) toast.success("Project saved.");
      else toast.error("Database save unavailable — configure DATABASE_URL.");
    } catch {
      toast.error("Could not reach the server.");
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
        toast.error("The name changed elsewhere.");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [projectId, readOnly, schema.name, schema.revision, shareToken, workspaceSlug]);

  /** Escape closes the topmost layer; ⌘S saves and ⌘E exports. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Overlays dismiss themselves; Escape only clears canvas selection.
        if (modal || openMenu || userMenuOpen || confirmRevoke) return;
        if (selectedId) setSelectedId(null);
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
      x: origin.x + tableWidth(table) / 2,
      y: origin.y + tableHeight(table) / 2,
    };
    const otherCenter = {
      x: otherOrigin.x + tableWidth(other) / 2,
      y: otherOrigin.y + tableHeight(other) / 2,
    };
    const dx = otherCenter.x - tableCenter.x;
    const dy = otherCenter.y - tableCenter.y;
    const rowY = origin.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2;

    if (Math.abs(dx) >= Math.abs(dy)) {
      return {
        x: origin.x + (dx >= 0 ? tableWidth(table) : 0),
        y: rowY,
        axis: "horizontal" as const,
      };
    }

    return {
      x: origin.x + tableWidth(table),
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
        } else toast.error("Could not create project.");
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
        toast.success("Generating DDL for Oracle 12.2 and later."),
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
            <HugeiconsIcon icon={DatabaseIcon} size={17} className="appbar-title-icon" />
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
            <Badge variant={dirty ? "secondary" : "ghost"}>
              {dirty ? "Unsaved changes" : "No changes"}
            </Badge>
          </div>
        </div>
        <div className="appbar-actions">
          <Button className="share-btn" onClick={() => setModal("share")}>
            <HugeiconsIcon icon={Share08Icon} size={15} /> Share
          </Button>
          <DropdownMenuTrigger
            isOpen={userMenuOpen}
            onOpenChange={setUserMenuOpen}
          >
            <Button variant="ghost" size="icon" aria-label="Account menu">
              <Avatar size="sm">
                <AvatarFallback>
                  <HugeiconsIcon icon={UserCircleIcon} />
                </AvatarFallback>
              </Avatar>
            </Button>
            <DropdownMenu placement="bottom end" className="w-auto min-w-40">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onAction={() =>
                    void authClient.signOut().then(() => router.push("/login"))
                  }
                >
                  <HugeiconsIcon icon={UserCircleIcon} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenu>
          </DropdownMenuTrigger>
        </div>
      </header>

      <SidebarProvider
        className="body min-h-0 flex-1"
        style={{ "--sidebar-width": "417px" } as React.CSSProperties}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      >
        {/* The sidebar sits below the app bar, not against the viewport top. */}
        <Sidebar
          className="top-(--appbar-height) h-[calc(100svh-var(--appbar-height))]"
          aria-label="Diagram structure"
        >
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
                    placeholder="Search..."
                    value={tableQuery}
                    onChange={(event) => setTableQuery(event.target.value)}
                  />
                </InputGroup>
                <Button variant="ghost" size="sm" onClick={addTable}>
                  <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
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
                      <Button onClick={addTable}>
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
                ) : (
                  filteredTables.map((table) => (
                    <Collapsible
                      className={`entity ${selectedId === table.id ? "open" : ""}`}
                      key={table.id}
                      isExpanded={selectedId === table.id}
                      onExpandedChange={(expanded) =>
                        setSelectedId(expanded ? table.id : null)
                      }
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
                              <FieldLabel htmlFor={`name-${table.id}`}>
                                Table name
                              </FieldLabel>
                              <Input
                                id={`name-${table.id}`}
                                value={table.name}
                                onChange={(event) =>
                                  patchTable(table.id, {
                                    name: event.target.value,
                                  })
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
                                  patchTable(table.id, {
                                    keyStrategy: key as KeyStrategy,
                                  })
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
                                    <SelectItem id="identity">
                                      Generated identity
                                    </SelectItem>
                                    <SelectItem id="none">
                                      Manual / none
                                    </SelectItem>
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
                                    <SelectItem id={NO_GROUP}>
                                      Ungrouped
                                    </SelectItem>
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
                                  patchTable(table.id, {
                                    comment: event.target.value,
                                  })
                                }
                              />
                            </Field>
                          </FieldGroup>
                          {primaryKeyColumns(table).length > 1 && (
                            <p className="hint">
                              Composite primary key — manual key generation
                              required.
                            </p>
                          )}

                          {table.columns.map((column) => (
                            <div className="column-card" key={column.id}>
                              <InputGroup>
                                <InputGroupInput
                                  aria-label={`Name of column ${column.name}`}
                                  value={column.name}
                                  onChange={(event) =>
                                    patchColumn(table.id, column.id, {
                                      name: event.target.value,
                                    })
                                  }
                                />
                                <InputGroupAddon align="inline-end">
                                  <InputGroupButton
                                    aria-label={`Delete column ${column.name}`}
                                    onClick={() =>
                                      deleteColumn(table.id, column.id)
                                    }
                                  >
                                    <HugeiconsIcon icon={Delete02Icon} />
                                  </InputGroupButton>
                                </InputGroupAddon>
                              </InputGroup>
                              <div className="column-card-row">
                                <Select
                                  className="w-full"
                                  aria-label={`Datatype for ${column.name}`}
                                  selectedKey={column.type}
                                  onSelectionChange={(key) =>
                                    patchColumn(table.id, column.id, {
                                      type: key as Column["type"],
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {ORACLE_TYPES.map((type) => (
                                        <SelectItem key={type} id={type}>
                                          {type}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                                {typeUsesSize(column.type) && (
                                  <Input
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
                              <FieldSet>
                                <FieldLegend variant="label" className="sr-only">
                                  Constraints for {column.name}
                                </FieldLegend>
                                <FieldGroup
                                  data-slot="checkbox-group"
                                  className="flex-row gap-4"
                                >
                                  <Field orientation="horizontal">
                                    <Checkbox
                                      id={`pk-${column.id}`}
                                      isSelected={column.pk}
                                      onChange={(isSelected) =>
                                        patchColumn(table.id, column.id, {
                                          pk: isSelected,
                                          fk: isSelected ? null : column.fk,
                                        })
                                      }
                                    />
                                    <FieldLabel htmlFor={`pk-${column.id}`}>
                                      PK
                                    </FieldLabel>
                                  </Field>
                                  <Field orientation="horizontal">
                                    <Checkbox
                                      id={`nn-${column.id}`}
                                      isSelected={column.notNull}
                                      onChange={(isSelected) =>
                                        patchColumn(table.id, column.id, {
                                          notNull: isSelected,
                                        })
                                      }
                                    />
                                    <FieldLabel htmlFor={`nn-${column.id}`}>
                                      NN
                                    </FieldLabel>
                                  </Field>
                                  <Field orientation="horizontal">
                                    <Checkbox
                                      id={`uq-${column.id}`}
                                      isSelected={column.unique}
                                      onChange={(isSelected) =>
                                        patchColumn(table.id, column.id, {
                                          unique: isSelected,
                                        })
                                      }
                                    />
                                    <FieldLabel htmlFor={`uq-${column.id}`}>
                                      UQ
                                    </FieldLabel>
                                  </Field>
                                </FieldGroup>
                              </FieldSet>
                              <Input
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
                                <Select
                                  className="w-full"
                                  aria-label={`Foreign key for ${column.name}`}
                                  selectedKey={
                                    column.fk
                                      ? `${column.fk.tableId}::${column.fk.columnId}`
                                      : NO_REFERENCE
                                  }
                                  onSelectionChange={(key) => {
                                    const [tableId, columnId] =
                                      String(key).split("::");
                                    patchColumn(table.id, column.id, {
                                      fk:
                                        tableId && columnId
                                          ? { tableId, columnId }
                                          : null,
                                    });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectItem id={NO_REFERENCE}>
                                        No reference
                                      </SelectItem>
                                      {compatibleForeignKeyTargets(column).map(
                                        ({ table: target, target: field }) => (
                                          <SelectItem
                                            key={`${target.id}::${field.id}`}
                                            id={`${target.id}::${field.id}`}
                                          >
                                            {target.name.toUpperCase()}.
                                            {field.name.toUpperCase()}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          ))}

                          <ButtonGroup>
                            <Button
                              variant="outline"
                              onClick={() => addColumn(table.id)}
                            >
                              <HugeiconsIcon
                                icon={PlusSignIcon}
                                data-icon="inline-start"
                              />
                              Add column
                            </Button>
                            <Button variant="outline" onClick={makeJunction}>
                              <HugeiconsIcon
                                icon={Link01Icon}
                                data-icon="inline-start"
                              />
                              Junction
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => deleteTable(table.id)}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                data-icon="inline-start"
                              />
                              Delete
                            </Button>
                          </ButtonGroup>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))
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
                  onChange={(event) => setRelationshipQuery(event.target.value)}
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
                  .filter((row) => row.name.toUpperCase().includes(relationshipQuery.trim().toUpperCase()))
                  .map((row) => {
                    const relationship = row.relationship;
                    const startTable = schema.tables.find((table) => table.id === relationship.startTableId);
                    const endTable = schema.tables.find((table) => table.id === relationship.endTableId);
                    const pairs = relationship.fields.length ? relationship.fields : [{ startFieldId: relationship.startFieldId, endFieldId: relationship.endFieldId }];
                    return (
                      <Collapsible className={`relationship-editor ${openRelationshipId === relationship.id ? "open" : ""}`} key={relationship.id} isExpanded={openRelationshipId === relationship.id} onExpandedChange={(expanded) => setOpenRelationshipId(expanded ? relationship.id : null)}>
                        <CollapsibleTrigger className="relationship-row relationship-editor-head">
                          <HugeiconsIcon icon={Link01Icon} aria-hidden="true" />
                          <span className="relationship-copy"><strong>{relationship.name}</strong><small>{row.from} → {row.to} · {row.cardinality}</small></span>
                          <HugeiconsIcon icon={ArrowDown01Icon} className="entity-chevron" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="relationship-editor-body">
                            <FieldGroup className="gap-4">
                              <Field>
                                <FieldLabel htmlFor={`rel-name-${relationship.id}`}>Name</FieldLabel>
                                <Input id={`rel-name-${relationship.id}`} value={relationship.name} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { name: event.target.value })} />
                              </Field>
                              <div className="relationship-endpoints"><span><b>Foreign</b>{startTable?.name}</span><Button variant="ghost" size="icon-sm" aria-label="Swap relationship endpoints" isDisabled={readOnly} onClick={() => swapRelationship(relationship)}><HugeiconsIcon icon={Link01Icon} /></Button><span><b>Primary</b>{endTable?.name}</span></div>
                              <Field>
                                <FieldLabel>Cardinality</FieldLabel>
                                <Select className="w-full" aria-label="Cardinality" isDisabled={readOnly} selectedKey={relationship.cardinality} onSelectionChange={(key) => patchRelationship(relationship.id, { cardinality: key as Cardinality })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                                  <FieldLabel htmlFor={`rel-many-${relationship.id}`}>Many-side label</FieldLabel>
                                  <Input id={`rel-many-${relationship.id}`} value={relationship.manyLabel} disabled={readOnly} onChange={(event) => patchRelationship(relationship.id, { manyLabel: event.target.value })} />
                                </Field>
                              )}
                              <Field>
                                <FieldLabel>On update</FieldLabel>
                                <Select className="w-full" aria-label="On update" isDisabled={readOnly} selectedKey={relationship.updateConstraint} onSelectionChange={(key) => patchRelationship(relationship.id, { updateConstraint: key as Relationship["updateConstraint"] })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {RELATIONSHIP_CONSTRAINTS.map((constraint) => <SelectItem key={constraint} id={constraint}>{constraint}</SelectItem>)}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </Field>
                              <Field>
                                <FieldLabel>On delete</FieldLabel>
                                <Select className="w-full" aria-label="On delete" isDisabled={readOnly} selectedKey={relationship.deleteConstraint} onSelectionChange={(key) => patchRelationship(relationship.id, { deleteConstraint: key as Relationship["deleteConstraint"] })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {RELATIONSHIP_CONSTRAINTS.map((constraint) => <SelectItem key={constraint} id={constraint}>{constraint}</SelectItem>)}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                              </Field>
                            </FieldGroup>
                            <FieldSet className="relationship-pairs">
                              <FieldLegend variant="label">Composite key</FieldLegend>
                              {pairs.map((pair, index) => (
                                <div className="relationship-pair" key={`${pair.startFieldId}-${pair.endFieldId}-${index}`}>
                                  <Select className="w-full" aria-label="Foreign-side column" isDisabled={readOnly} selectedKey={pair.startFieldId} onSelectionChange={(key) => patchRelationship(relationship.id, { fields: pairs.map((item, pairIndex) => pairIndex === index ? { ...item, startFieldId: String(key) } : item) })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        {startTable?.columns.map((column) => <SelectItem key={column.id} id={column.id}>{column.name}</SelectItem>)}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  <Select className="w-full" aria-label="Primary-side column" isDisabled={readOnly} selectedKey={pair.endFieldId} onSelectionChange={(key) => patchRelationship(relationship.id, { fields: pairs.map((item, pairIndex) => pairIndex === index ? { ...item, endFieldId: String(key) } : item) })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectGroup>
                                        {endTable?.columns.map((column) => <SelectItem key={column.id} id={column.id}>{column.name}</SelectItem>)}
                                      </SelectGroup>
                                    </SelectContent>
                                  </Select>
                                  {pairs.length > 1 && <Button variant="ghost" size="icon" aria-label="Remove relationship field pair" isDisabled={readOnly} onClick={() => patchRelationship(relationship.id, { fields: pairs.filter((_, pairIndex) => pairIndex !== index) })}><HugeiconsIcon icon={Delete02Icon} /></Button>}
                                </div>
                              ))}
                              <Button variant="outline" className="self-start" isDisabled={readOnly || pairs.length >= Math.min(startTable?.columns.length ?? 0, endTable?.columns.length ?? 0)} onClick={() => { const start = startTable?.columns.find((column) => !pairs.some((pair) => pair.startFieldId === column.id)); const end = endTable?.columns.find((column) => !pairs.some((pair) => pair.endFieldId === column.id)); if (start && end) patchRelationship(relationship.id, { fields: [...pairs, { startFieldId: start.id, endFieldId: end.id }] }); }}><HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" /> Add field</Button>
                            </FieldSet>
                            <Button variant="outline" className="relationship-delete" isDisabled={readOnly} onClick={() => deleteRelationship(relationship.id)}><HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" /> Delete relationship</Button>
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
                <HugeiconsIcon icon={SourceCodeIcon} data-icon="inline-start" />
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
                        issue.tableId && setSelectedId(issue.tableId)
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
          <SidebarTrigger
            className="panel-reveal"
            aria-label="Show side panel"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </SidebarTrigger>
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
                    <HugeiconsIcon icon={DatabaseIcon} size={15} aria-hidden="true" />
                    <input
                      className="schema-group-name"
                      aria-label={`Name of schema group ${group.name}`}
                      value={group.name}
                      disabled={readOnly}
                      onPointerDown={(event) => event.stopPropagation()}
                      onChange={(event) => patchGroup(group.id, { name: event.target.value })}
                    />
                    <div className="schema-group-actions" onPointerDown={(event) => event.stopPropagation()}>
                      <ToggleGroup
                        aria-label="Group color"
                        selectionMode="single"
                        disallowEmptySelection
                        isDisabled={readOnly}
                        selectedKeys={[group.color]}
                        onSelectionChange={(keys) => {
                          const [key] = [...keys];
                          if (key) patchGroup(group.id, { color: key as SchemaGroup["color"] });
                        }}
                      >
                        {Object.entries(GROUP_PALETTE).map(([color, option]) => (
                          <ToggleGroupItem
                            key={color}
                            id={color}
                            className="schema-group-color"
                            aria-label={`Use ${color} group color`}
                            style={{ background: option.border }}
                          />
                        ))}
                      </ToggleGroup>
                      <TooltipTrigger>
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete schema group ${group.name}`} isDisabled={readOnly} onClick={() => deleteGroup(group.id)}>
                          <HugeiconsIcon icon={Delete02Icon} />
                        </Button>
                        <Tooltip>Delete group</Tooltip>
                      </TooltipTrigger>
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
                    <HugeiconsIcon icon={StickyNote01Icon} size={14} aria-hidden="true" />
                    <span className="memo-drag-label">Memo</span>
                    <div className="memo-actions" onPointerDown={(event) => event.stopPropagation()}>
                      <ToggleGroup
                        aria-label="Memo color"
                        selectionMode="single"
                        disallowEmptySelection
                        selectedKeys={[memo.color]}
                        onSelectionChange={(keys) => {
                          const [key] = [...keys];
                          if (key) patchMemo(memo.id, { color: key as MemoColor });
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
                        <Button variant="ghost" size="icon-sm" aria-label="Delete memo" onClick={() => deleteMemo(memo.id)}>
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
                    {relationSettings.showRelationshipLabels && <text className="relationship-label" x={(from.x + to.x) / 2} y={(from.y + to.y) / 2} textAnchor="middle"><title>{relationship.relationship.name}</title>{ellipsize(relationship.relationship.name)}</text>}
                  </g>
                );
              })}
            </svg>
            {schema.tables.map((table) => {
              const position = livePosition(table);
              const moving = dragPosition?.id === table.id;
              return (
                <ContextMenuTrigger
                  key={table.id}
                  onOpenChange={(open) => open && setSelectedId(table.id)}
                >
                <div
                  className={`table-card ${selectedId === table.id ? "selected" : ""} ${moving ? "moving" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedId === table.id}
                  aria-label={`Table ${table.name}, ${table.columns.length} columns. Arrow keys move it.`}
                  style={{
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                    width: tableWidth(table),
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
                  <HoverCard
                    className="table-head"
                    isDisabled={moving || grabbing || linking !== null}
                    onPointerDown={(event) => onHeaderDown(event, table)}
                    content={
                      <TableSummaryCard
                        table={table}
                        group={
                          table.schemaId
                            ? (schema.groups ?? []).find(
                                (item) => item.id === table.schemaId,
                              )
                            : undefined
                        }
                        relationshipCount={
                          relationships.filter(
                            (item) =>
                              item.from.id === table.id ||
                              item.to.id === table.id,
                          ).length
                        }
                      />
                    }
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
                  </HoverCard>
                  {table.columns.map((column) => (
                    <HoverCard
                      className="table-row"
                      key={column.id}
                      data-table-id={table.id}
                      data-column-id={column.id}
                      isDisabled={moving || grabbing || linking !== null}
                      content={
                        <ColumnCard
                          table={table}
                          column={column}
                          reference={foreignKeyTarget(column)}
                        />
                      }
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
                        {column.pk && <HugeiconsIcon icon={Key01Icon} size={13} aria-hidden="true" />}
                        {column.fk && (
                          <HugeiconsIcon icon={Link01Icon}
                            size={13}
                            className="fk-dot"
                            aria-hidden="true"
                          />
                        )}
                        {!column.notNull && !column.pk && (
                          <span className="row-nullable">
                            <span className="sr-only">Nullable</span>?
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
                    </HoverCard>
                  ))}
                </div>
                <ContextMenu className="w-auto min-w-52">
                  <ContextMenuLabel>{table.name.toUpperCase()}</ContextMenuLabel>
                  <ContextMenuGroup>
                    <ContextMenuItem
                      isDisabled={readOnly}
                      onAction={() => addColumn(table.id)}
                    >
                      <HugeiconsIcon icon={PlusSignIcon} />
                      Add column
                    </ContextMenuItem>
                    <ContextMenuItem
                      onAction={() => {
                        setSelectedId(table.id);
                        setPanelTab("tables");
                        setSidebarOpen(true);
                      }}
                    >
                      <HugeiconsIcon icon={Table01Icon} />
                      Edit in side panel
                    </ContextMenuItem>
                  </ContextMenuGroup>
                  <ContextMenuSeparator />
                  <ContextMenuGroup>
                    <ContextMenuItem
                      isDisabled={readOnly}
                      onAction={() => makeJunction()}
                    >
                      <HugeiconsIcon icon={Link01Icon} />
                      Add junction table
                    </ContextMenuItem>
                    <ContextMenuItem
                      onAction={() => void copyShareText(tableDDL(table))}
                    >
                      <HugeiconsIcon icon={Copy01Icon} />
                      Copy CREATE TABLE
                    </ContextMenuItem>
                  </ContextMenuGroup>
                  <ContextMenuSeparator />
                  <ContextMenuGroup>
                    <ContextMenuItem
                      variant="destructive"
                      isDisabled={readOnly}
                      onAction={() => deleteTable(table.id)}
                    >
                      <HugeiconsIcon icon={Delete02Icon} />
                      Delete table
                    </ContextMenuItem>
                  </ContextMenuGroup>
                </ContextMenu>
                </ContextMenuTrigger>
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

          <ButtonGroup className="dock" aria-label="Canvas controls">
            <DockButton
              label="Tidy up layout"
              icon={GridViewIcon}
              onClick={autoLayout}
            />
            <Separator orientation="vertical" />
            <DockButton
              label="Zoom out"
              icon={ZoomOutAreaIcon}
              onClick={() => zoomBy(-0.1)}
            />
            <span className="dock-zoom" aria-live="polite" aria-atomic="true">
              {Math.round(zoom * 100)}%
            </span>
            <DockButton
              label="Zoom in"
              icon={ZoomInAreaIcon}
              onClick={() => zoomBy(0.1)}
            />
            <Separator orientation="vertical" />
            <DockButton
              label="Undo"
              icon={ArrowTurnBackwardIcon}
              isDisabled={!history.length}
              onClick={undo}
            />
            <DockButton
              label="Redo"
              icon={ArrowTurnForwardIcon}
              isDisabled={!future.length}
              onClick={redo}
            />
            <Separator orientation="vertical" />
            <DockButton
              label="Add table"
              icon={Table01Icon}
              onClick={addTable}
            />
            <DockButton
              label="Add schema group"
              icon={DatabaseIcon}
              onClick={addGroup}
            />
            <DockButton
              label="Add memo"
              icon={StickyNote01Icon}
              onClick={addMemo}
            />
            <DockButton
              label="Add junction table"
              icon={Link01Icon}
              isDisabled={!selected}
              onClick={makeJunction}
            />
            <DockButton
              label="Fit to screen"
              icon={Maximize01Icon}
              onClick={fitView}
            />
            <Separator orientation="vertical" />
            <DockButton
              label="Save to database"
              icon={FloppyDiskIcon}
              onClick={() => void save()}
            />
            <DockButton
              label="Export SQL"
              icon={Download04Icon}
              onClick={() => setModal("export")}
            />
          </ButtonGroup>
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
                  onClick={() => void copyShareText(shareLink)}
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
                    onClick={() => void copyShareText(workspaceInviteLink)}
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

      <Dialog
        isOpen={modal === "export"}
        onOpenChange={(open) => !open && setModal(null)}
        className="sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Export SQL</DialogTitle>
        </DialogHeader>
        <Tabs
          selectedKey={exportTab}
          onSelectionChange={(key) => setExportTab(key as ExportTab)}
        >
          <div className="flex items-center justify-between gap-2 pr-10">
            <TabsList>
              {exportTabs.map(([key, label]) => (
                <TabsTrigger key={key} id={key}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copy export"
                onClick={copyOutput}
              >
                <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Download export"
                onClick={download}
              >
                <HugeiconsIcon icon={Download04Icon} />
              </Button>
            </div>
          </div>
          {errors.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <HugeiconsIcon icon={Cancel01Icon} />
              <AlertTitle>
                Export blocked: {errors[0].message} ({errors.length} error(s))
              </AlertTitle>
              <AlertAction>
                <Button variant="outline" onClick={clearInvalidForeignKeys}>
                  Clear invalid references
                </Button>
              </AlertAction>
            </Alert>
          )}
          {exportTabs.map(([key]) => (
            <TabsContent key={key} id={key}>
              <pre className="code">
                <code>{highlightSql(output)}</code>
              </pre>
            </TabsContent>
          ))}
        </Tabs>
      </Dialog>

      <Dialog
        isOpen={modal === "import"}
        onOpenChange={(open) => !open && setModal(null)}
        className="sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>Import Oracle DDL</DialogTitle>
          <DialogDescription>
            Supported CREATE TABLE subset · all-or-nothing
          </DialogDescription>
        </DialogHeader>
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
            className="sql-input"
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
          <Alert variant={importMessage.ok ? "default" : "destructive"}>
            <AlertTitle>{importMessage.text}</AlertTitle>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setImportText(ddl)}>
            Use current export
          </Button>
          <Button onClick={importSchema}>
            <HugeiconsIcon icon={FileUploadIcon} data-icon="inline-start" />
            Parse and replace
          </Button>
        </DialogFooter>
      </Dialog>

    </div>
  );
}
