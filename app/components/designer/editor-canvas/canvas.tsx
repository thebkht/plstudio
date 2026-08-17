"use client";

import { useRef, type ComponentProps, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ClipboardIcon,
  DatabaseIcon,
  FullScreenIcon,
  GridIcon,
  CursorRectangleSelectionIcon,
  StickyNote01Icon,
  Table01Icon,
} from "@hugeicons/core-free-icons";
import {
  ContextMenu,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { PeerCursors } from "@/app/components/collab-presence";
import type {
  Column,
  Memo,
  Relationship,
  SchemaGroup,
  Table,
} from "@/app/lib/schema";
import type { Rect } from "@/app/lib/selection";
import { isSelected, selectOnly } from "@/app/lib/selection";
import type { ShortcutId } from "@/app/lib/shortcuts";
import { relationshipCardinalities } from "../geometry";
import { ShortcutKeys } from "../primitives";
import {
  useDesignerSettings,
  useSchema,
  useSelect,
  useTransform,
} from "@/app/hooks";
import { Dock } from "./dock";
import { MemoCard } from "./memo-card";
import { RelationshipEdge } from "./relationship-edge";
import { SchemaGroupCard } from "./schema-group";
import { SelectionToolbar } from "./selection-toolbar";
import { TableCard } from "./table-card";

type TableCardProps = ComponentProps<typeof TableCard>;
type MemoCardProps = ComponentProps<typeof MemoCard>;
type SchemaGroupCardProps = ComponentProps<typeof SchemaGroupCard>;

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };
type EdgePoint = Point & { direction: 1 | -1 };

/** A link being dragged from a column towards a drop target. */
export type Linking = {
  pointerId: number;
  sourceTableId: string;
  sourceColumnId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

/** One resolved edge: both endpoints, already looked up. */
export type CanvasRelationship = {
  id: string;
  from: Table;
  fromIndex: number;
  to: Table;
  toIndex: number;
  relationship: Relationship;
};

/**
 * Everything the canvas needs that is *not* already in a context. It is one
 * object rather than forty props because it is one thing: the gesture surface.
 *
 * It cannot become a canvas-scoped context as it stands — the appbar's menus
 * and the global key handler fire these same commands, and they render outside
 * the canvas. Moving them under a provider mounted here would have to come with
 * them; until then the surface is owned by `Workspace` and handed down.
 */
export type CanvasGestures = {
  canvasRef: RefObject<HTMLDivElement | null>;
  gridStyle: CSSProperties;
  grabbing: boolean;
  panMode: boolean;
  dragPosition: { id: string; x: number; y: number } | null;
  dragGroupPosition: { id: string } | null;
  dragSelection: unknown | null;
  marquee: Rect | null;
  resizeTable: { id: string; width: number } | null;
  linking: Linking | null;
  multiFrame: Box | null;
  peerSelection: Map<string, { user: { name: string }; color: string }>;

  onCanvasDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasDownCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave: () => void;
  finishLinking: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;

  livePosition: (table: Table) => Point;
  liveWidth: (table: Table) => number;
  liveMemo: (memo: Memo) => Box;
  liveGroup: (group: SchemaGroup) => Box;

  editingMemoId: string | null;
  setEditingMemoId: React.Dispatch<React.SetStateAction<string | null>>;
  memoHadText: RefObject<Set<string>>;

  pressSelection: (
    event: ReactPointerEvent<HTMLElement>,
    kind: "table" | "memo" | "group",
    id: string,
  ) => void;
  startLinking: TableCardProps["onStartLink"];
  onHeaderDown: TableCardProps["onHeaderDown"];
  onTableResizeDown: TableCardProps["onResizeDown"];
  onTableResizeKeyDown: TableCardProps["onResizeKeyDown"];
  onCardKeyDown: TableCardProps["onKeyDown"];
  onMemoDown: MemoCardProps["onPointerDown"];
  onMemoResizeDown: MemoCardProps["onResizePointerDown"];
  onGroupDown: SchemaGroupCardProps["onHeadPointerDown"];
  onGroupResizeDown: SchemaGroupCardProps["onResizePointerDown"];

  resetTableWidth: (id: string) => void;
  commitGroupSize: (id: string, width: number, height: number) => void;
  commitMemoSize: (id: string, width: number, height: number) => void;
  patchGroup: (id: string, patch: Partial<SchemaGroup>) => void;
  deleteGroup: (id: string) => void;
  applyGroupKeyword: (id: string) => void;
  unprefixedTables: (id: string) => Table[];
  patchMemo: (id: string, patch: Partial<Memo>) => void;
  deleteMemo: (id: string) => void;

  relationships: CanvasRelationship[];
  relationshipPoint: (
    table: Table,
    columnIndex: number,
    other: Table,
    key: string,
  ) => EdgePoint;
  relationshipCounts: Map<string, number>;
  foreignKeyTarget: TableCardProps["foreignKeyTarget"];

  /** `at` is canvas space — where a context menu was opened. */
  addTable: (groupId?: string, at?: Point) => void;
  editTableInPanel: (tableId: string) => void;
  copyTableDDL: (tableId: string) => void;
  makeJunction: () => void;

  zoomBy: (delta: number) => void;
  fitView: () => void;
  addGroup: (at?: Point) => void;
  addMemo: (at?: Point, schemaId?: string) => void;
  autoLayout: () => void;
  onToggleHand: () => void;

  hint: (id: ShortcutId) => string;
  /** Fires the same closure the chord does, so a menu row cannot drift from it. */
  runShortcut: (id: ShortcutId) => void;
  copySelection: (format: "sql" | "json") => void;
  deleteSelection: () => void;
  selectGroupMembers: (groupId: string) => void;
  canvasPoint: (event: { clientX: number; clientY: number }) => Point;
  pasteSelection: (text: string) => void;
};

export type CanvasProps = {
  readOnly: boolean;
  save: () => Promise<void> | void;
  gestures: CanvasGestures;
};

export function Canvas({ readOnly, save, gestures: g }: CanvasProps) {
  const {
    schema,
    groupsById,
    peers,
    addColumn,
    deleteTable,
    reorderColumns,
  } = useSchema();
  const {
    selection,
    selectionRef,
    single,
    selectedId,
    selectedGroupId,
    selectedMemoId,
    setSelection,
    selectTable,
  } = useSelect();
  const { pan, zoom } = useTransform();
  const { settings, isMac } = useDesignerSettings();
  /** Where the background menu was opened, in canvas space. */
  const contextPointRef = useRef<Point>({ x: 0, y: 0 });

  /*
   * The ⌘V path rides the window's `paste` event, which carries the clipboard
   * with it. A menu item has no such event, so it has to ask -- and the ask can
   * be refused, which is the one case worth telling the user about.
   */
  const pasteFromClipboard = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) g.pasteSelection(text);
    } catch {
      toast.error("Clipboard access was blocked. Press ⌘V instead.");
    }
  };

  return (
    /*
     * Wrapping the frame, not sitting inside it: the trigger renders as a
     * `display: contents` wrapper, and `.canvas` is a zero-size absolute box,
     * so a right-click on the empty grid targets the frame itself and would
     * never reach a handler mounted below it.
     */
    <ContextMenuTrigger>
    <div
      ref={g.canvasRef}
      className={`canvas-wrap ${g.grabbing ? "grabbing" : ""} ${g.grabbing || g.dragPosition || g.marquee || g.dragSelection ? "gesturing" : ""} ${g.panMode ? "pan-mode" : ""}`}
      onPointerDownCapture={g.onCanvasDownCapture}
      onPointerDown={g.onCanvasDown}
      onPointerMove={g.onPointerMove}
      onPointerLeave={g.onPointerLeave}
      onPointerUp={g.finishLinking}
      onPointerCancel={g.onPointerCancel}
      /*
       * Captured, so the point is recorded before the trigger below opens the
       * menu — and in canvas space, since that is where a new card is placed.
       */
      onContextMenuCapture={(event) => {
        contextPointRef.current = g.canvasPoint(event);
      }}
      style={g.gridStyle}
    >
      <div
        className="canvas"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          willChange: g.grabbing || g.dragPosition ? "transform" : undefined,
        }}
      >
        {(schema.groups ?? []).map((group) => (
          <SchemaGroupCard
            key={group.id}
            group={group}
            position={g.liveGroup(group)}
            isSelected={selectedGroupId === group.id}
            inMultiSelection={
              !single && isSelected(selection, "group", group.id)
            }
            isMoving={g.dragGroupPosition?.id === group.id}
            pendingPrefix={g.unprefixedTables(group.id).length}
            readOnly={readOnly}
            onPointerDown={(event) => {
              event.stopPropagation();
              g.pressSelection(event, "group", group.id);
            }}
            onHeadPointerDown={g.onGroupDown}
            onResizePointerDown={g.onGroupResizeDown}
            onContextOpen={() => setSelection(selectOnly("group", group.id))}
            onPatch={g.patchGroup}
            onDelete={g.deleteGroup}
            onAddTable={g.addTable}
            onAddMemo={(groupId) => g.addMemo(contextPointRef.current, groupId)}
            onSelectMembers={g.selectGroupMembers}
            onApplyKeyword={g.applyGroupKeyword}
            onResizeCommit={g.commitGroupSize}
          />
        ))}
        {(schema.memos ?? []).map((memo) => (
          <MemoCard
            key={memo.id}
            memo={memo}
            position={g.liveMemo(memo)}
            isSelected={selectedMemoId === memo.id}
            inMultiSelection={!single && isSelected(selection, "memo", memo.id)}
            isEditing={g.editingMemoId === memo.id}
            onPointerDown={g.onMemoDown}
            onResizePointerDown={g.onMemoResizeDown}
            onSelect={() => setSelection(selectOnly("memo", memo.id))}
            onClick={(event) => {
              event.stopPropagation();
              // The pointerdown already decided this; re-running it here
              // would undo a Shift-click toggle a moment after it landed.
              if (event.shiftKey || event.metaKey || event.ctrlKey) return;
              if (isSelected(selectionRef.current, "memo", memo.id)) return;
              setSelection(selectOnly("memo", memo.id));
            }}
            onPatch={g.patchMemo}
            onDelete={g.deleteMemo}
            onResizeCommit={g.commitMemoSize}
            onFocusText={() => {
              setSelection(selectOnly("memo", memo.id));
              g.setEditingMemoId(memo.id);
              if (memo.text.trim()) g.memoHadText.current.add(memo.id);
            }}
            onChangeText={(value) => {
              if (value.trim()) g.memoHadText.current.add(memo.id);
              g.patchMemo(memo.id, { text: value });
            }}
            onBlurText={() => {
              g.setEditingMemoId((current) =>
                current === memo.id ? null : current,
              );
              if (!memo.text.trim() && !g.memoHadText.current.has(memo.id))
                g.deleteMemo(memo.id);
            }}
          />
        ))}
        {/*
          No width or height: the overlay is pinned to the canvas origin
          and paints outside its own box (`overflow: visible`), so an edge
          between two cards a long way out still draws.
        */}
        <svg className="edges" aria-hidden="true">
          {g.relationships.map((relationship) => {
            const from = g.relationshipPoint(
              relationship.from,
              relationship.fromIndex,
              relationship.to,
              `${relationship.id}:from`,
            );
            const to = g.relationshipPoint(
              relationship.to,
              relationship.toIndex,
              relationship.from,
              `${relationship.id}:to`,
            );
            const [fromCardinality, toCardinality] = relationshipCardinalities(
              relationship.relationship,
            );
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
                showCardinality={settings.showCardinality}
                showLabel={settings.showRelationshipLabels}
              />
            );
          })}
        </svg>
        {schema.tables.map((table) => {
          const position = g.livePosition(table);
          const moving = g.dragPosition?.id === table.id;
          const heldBy = g.peerSelection.get(table.id);
          return (
            <TableCard
              key={table.id}
              table={table}
              x={position.x}
              y={position.y}
              width={g.liveWidth(table)}
              moving={moving}
              selected={selectedId === table.id}
              multiSelected={
                !single && isSelected(selection, "table", table.id)
              }
              resizing={g.resizeTable?.id === table.id}
              hoverDisabled={moving || g.grabbing || g.linking !== null}
              heldByName={heldBy?.user.name}
              heldByColor={heldBy?.color}
              group={table.schemaId ? groupsById.get(table.schemaId) : undefined}
              relationshipCount={g.relationshipCounts.get(table.id) ?? 0}
              foreignKeyTarget={g.foreignKeyTarget}
              readOnly={readOnly}
              isMac={isMac}
              onSelect={selectTable}
              onHeaderDown={g.onHeaderDown}
              onResizeDown={g.onTableResizeDown}
              onResizeKeyDown={g.onTableResizeKeyDown}
              onResetWidth={g.resetTableWidth}
              onKeyDown={g.onCardKeyDown}
              onStartLink={g.startLinking}
              onEditInPanel={g.editTableInPanel}
              onCopyDDL={g.copyTableDDL}
              onAddColumn={addColumn}
              onMakeJunction={g.makeJunction}
              onDeleteTable={deleteTable}
              reorderColumns={reorderColumns}
            />
          );
        })}
        {g.multiFrame && (
          <div
            className="selection-frame"
            aria-hidden="true"
            style={{
              transform: `translate3d(${g.multiFrame.x}px, ${g.multiFrame.y}px, 0)`,
              width: g.multiFrame.width,
              height: g.multiFrame.height,
            }}
          />
        )}
        {g.marquee && (
          <div
            className="marquee"
            aria-hidden="true"
            style={{
              transform: `translate3d(${g.marquee.x}px, ${g.marquee.y}px, 0)`,
              width: g.marquee.width,
              height: g.marquee.height,
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
      {g.multiFrame && !g.dragSelection && !g.marquee && (
        <SelectionToolbar
          frame={g.multiFrame}
          readOnly={readOnly}
          hint={g.hint}
          onCopy={g.copySelection}
          onDelete={g.deleteSelection}
        />
      )}

      {g.linking && <LinkingOverlay linking={g.linking} pan={pan} zoom={zoom} />}

      {/*
        Grouped by what each control changes: the viewport, then history,
        then what the diagram contains, then the document as a whole.
        Proximity is a claim about relationship, so a command that moves the
        camera cannot sit among the ones that add tables.
      */}
      {/*
        The add commands are called, never passed: they take an optional canvas
        point, and a click handler would hand them the DOM event as one.
      */}
      <Dock
        panMode={g.panMode}
        onToggleHand={g.onToggleHand}
        zoomBy={g.zoomBy}
        fitView={g.fitView}
        addTable={() => g.addTable()}
        addGroup={() => g.addGroup()}
        addMemo={() => g.addMemo()}
        makeJunction={g.makeJunction}
        hasSelectedTable={Boolean(selectedId)}
        autoLayout={g.autoLayout}
        save={save}
      />
      <ContextMenu className="w-auto">
        <ContextMenuGroup>
          <ContextMenuItem
            isDisabled={readOnly}
            onAction={() => g.addTable(undefined, contextPointRef.current)}
          >
            <HugeiconsIcon icon={Table01Icon} />
            Add table here
            <ContextMenuShortcut>
              <ShortcutKeys id="addTable" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            isDisabled={readOnly}
            onAction={() => g.addGroup(contextPointRef.current)}
          >
            <HugeiconsIcon icon={DatabaseIcon} />
            Add schema group here
            <ContextMenuShortcut>
              <ShortcutKeys id="addGroup" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            isDisabled={readOnly}
            onAction={() => g.addMemo(contextPointRef.current)}
          >
            <HugeiconsIcon icon={StickyNote01Icon} />
            Add memo here
            <ContextMenuShortcut>
              <ShortcutKeys id="addMemo" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            isDisabled={readOnly}
            onAction={() => void pasteFromClipboard()}
          >
            <HugeiconsIcon icon={ClipboardIcon} />
            Paste
            <ContextMenuShortcut>
              <ShortcutKeys id="pasteSelection" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            isDisabled={!schema.tables.length && !(schema.groups ?? []).length && !(schema.memos ?? []).length}
            onAction={() => g.runShortcut("selectAll")}
          >
            <HugeiconsIcon icon={CursorRectangleSelectionIcon} />
            Select all
            <ContextMenuShortcut>
              <ShortcutKeys id="selectAll" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem onAction={g.fitView}>
            <HugeiconsIcon icon={FullScreenIcon} />
            Fit to screen
            <ContextMenuShortcut>
              <ShortcutKeys id="fitView" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            isDisabled={readOnly || !schema.tables.length}
            onAction={() => g.runShortcut("tidyLayout")}
          >
            <HugeiconsIcon icon={GridIcon} />
            Tidy up layout
            <ContextMenuShortcut>
              <ShortcutKeys id="tidyLayout" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenu>
    </div>
    </ContextMenuTrigger>
  );
}

/** The rubber band drawn from a column to the pointer while a link is dragged. */
function LinkingOverlay({
  linking,
  pan,
  zoom,
}: {
  linking: { startX: number; startY: number; x: number; y: number };
  pan: Point;
  zoom: number;
}) {
  return (
    <svg
      className="linking-overlay"
      style={{
        transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
      }}
      aria-hidden="true"
    >
      <path d={`M ${linking.startX} ${linking.startY} L ${linking.x} ${linking.y}`} />
    </svg>
  );
}
