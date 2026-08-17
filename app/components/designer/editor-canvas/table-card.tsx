"use client";

/**
 * One table on the canvas. This is the component that decides whether dragging
 * feels smooth: the designer re-renders on every frame of a gesture, and each
 * card carries a context menu and one HoverCard per column, so a diagram of
 * twenty ten-column tables was reconciling a couple of hundred popover
 * instances sixty times a second.
 *
 * Every prop is therefore either a primitive or an identity that only changes
 * when the schema does. In particular the live position arrives as two numbers,
 * not an object, and the collaborator holding the card as a name and a colour
 * rather than the peer record — a peer's cursor moves every frame, and passing
 * the record would defeat the memo it is here to enable.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ColumnInsertIcon,
  Copy01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  FingerPrintIcon,
  GitMergeIcon,
  HorizontalResizeIcon,
  Key01Icon,
  Link01Icon,
  PanelLeftOpenIcon,
} from "@hugeicons/core-free-icons";
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
import { TABLE_FIELD_HEIGHT, tableHeight, typeString, uniqueGroupColumnIds, type Column, type SchemaGroup, type Table } from "@/app/lib/schema";
import { typeColorVar } from "@/app/lib/datatype-color";
import { ColumnCard, ShortcutKeys, TableSummaryCard } from "../primitives";

type ForeignKeyTarget = (column: Column) => { table: Table; column: Column } | undefined;

/**
 * A single column line. Split out so that editing one column does not re-render
 * its siblings, and so the hover card's contents are built by a component that
 * can skip the work rather than eagerly on every parent render.
 */
const ColumnRow = memo(function ColumnRow({
  table,
  column,
  columnIndex,
  totalColumns,
  inUniqueGroup,
  hoverDisabled,
  readOnly,
  foreignKeyTarget,
  onStartLink,
  onGrabRow,
  onRowKeyDown,
}: {
  table: Table;
  column: Column;
  columnIndex: number;
  totalColumns: number;
  /** Whether one of the table's multi-column unique constraints names it. */
  inUniqueGroup: boolean;
  hoverDisabled: boolean;
  readOnly: boolean;
  foreignKeyTarget: ForeignKeyTarget;
  onStartLink: (event: ReactPointerEvent, tableId: string, columnId: string, columnIndex: number) => void;
  onGrabRow?: (event: ReactPointerEvent<HTMLButtonElement>, columnId: string, columnIndex: number) => void;
  onRowKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, columnId: string, columnIndex: number) => void;
}) {
  return (
    <HoverCard
      className="table-row"
      data-table-id={table.id}
      data-column-id={column.id}
      isDisabled={hoverDisabled}
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
        onPointerDown={(event) => onStartLink(event, table.id, column.id, columnIndex)}
        aria-hidden="false"
      />
      <span className="row-name">{column.name.toUpperCase()}</span>
      <span className="row-meta">
        {column.pk && <HugeiconsIcon icon={Key01Icon} size={13} aria-hidden="true" />}
        {column.fk && (
          <HugeiconsIcon icon={Link01Icon} size={13} className="fk-dot" aria-hidden="true" />
        )}
        {/* The same glyph the side panel's Unique flag uses; the tint is what
            separates a column's own unique from one inside a group. */}
        {(column.unique || inUniqueGroup) && !column.pk && (
          <HugeiconsIcon
            icon={FingerPrintIcon}
            size={13}
            className={inUniqueGroup ? "uk-group" : "uk-dot"}
            aria-hidden="true"
          />
        )}
        {!column.notNull && !column.pk && (
          <span className="row-nullable">
            <span className="sr-only">Nullable</span>?
          </span>
        )}
        <span className="row-type" style={{ color: typeColorVar(column.type) }}>
          {typeString(column)}
        </span>
        {!readOnly && totalColumns > 1 && onGrabRow && (
          <button
            type="button"
            className="row-reorder-grip"
            aria-label={`Reorder column ${column.name}, position ${columnIndex + 1} of ${totalColumns}. Press Up or Down arrow keys to move.`}
            onPointerDown={(event) => onGrabRow(event, column.id, columnIndex)}
            onKeyDown={(event) => onRowKeyDown?.(event, column.id, columnIndex)}
          >
            <HugeiconsIcon icon={DragDropVerticalIcon} size={13} aria-hidden="true" />
          </button>
        )}
      </span>
    </HoverCard>
  );
});

export const TableCard = memo(function TableCard({
  table,
  x,
  y,
  width,
  moving,
  selected,
  multiSelected,
  resizing,
  hoverDisabled,
  heldByName,
  heldByColor,
  group,
  relationshipCount,
  foreignKeyTarget,
  readOnly,
  isMac,
  onSelect,
  onHeaderDown,
  onResizeDown,
  onResizeKeyDown,
  onResetWidth,
  onKeyDown,
  onStartLink,
  onEditInPanel,
  onCopyDDL,
  onAddColumn,
  onMakeJunction,
  onDeleteTable,
  reorderColumns,
}: {
  table: Table;
  x: number;
  y: number;
  /** Live during a resize, so it arrives as a number rather than off `table`. */
  width: number;
  moving: boolean;
  selected: boolean;
  /**
   * One of several things selected together. Kept apart from `selected` so the
   * shared ring reads as "part of this set" rather than as the single-selection
   * accent — the whole point of the ring is that it looks the same on a table,
   * a memo and a group.
   */
  multiSelected: boolean;
  /**
   * True for the card whose width grip is in flight. Pointer capture takes the
   * pointer off the card, so hover cannot be what keeps the grip lit.
   */
  resizing: boolean;
  /** Hover cards stay shut during gestures — a popover mid-drag is noise. */
  hoverDisabled: boolean;
  heldByName?: string;
  heldByColor?: string;
  group?: SchemaGroup;
  relationshipCount: number;
  foreignKeyTarget: ForeignKeyTarget;
  readOnly: boolean;
  isMac: boolean;
  onSelect: (tableId: string) => void;
  onHeaderDown: (event: ReactPointerEvent<HTMLDivElement>, tableId: string) => void;
  onResizeDown: (event: ReactPointerEvent<HTMLButtonElement>, tableId: string) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLButtonElement>, tableId: string) => void;
  onResetWidth: (tableId: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, tableId: string) => void;
  onStartLink: (event: ReactPointerEvent, tableId: string, columnId: string, columnIndex: number) => void;
  onEditInPanel: (tableId: string) => void;
  onCopyDDL: (tableId: string) => void;
  onAddColumn: (tableId: string) => void;
  onMakeJunction: (tableId: string) => void;
  onDeleteTable: (tableId: string) => void;
  reorderColumns?: (tableId: string, from: number, to: number) => void;
}) {
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Built once per card rather than scanned per row: a card is redrawn on every
  // drag frame and the constraints change about once a session.
  const uniqueGroups = useMemo(() => uniqueGroupColumnIds(table), [table]);
  const rowSlotsRef = useRef(new Map<string, HTMLDivElement>());
  const gestureRef = useRef<{
    pointerId: number;
    columnId: string;
    from: number;
    to: number;
    startY: number;
    offset: number;
  } | null>(null);

  const setRowSlot = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) rowSlotsRef.current.set(id, node);
    else rowSlotsRef.current.delete(id);
  }, []);

  const paintRows = useCallback((from: number, to: number, offset: number, columns: Column[]) => {
    const rowHeight = TABLE_FIELD_HEIGHT;
    columns.forEach((col, index) => {
      const node = rowSlotsRef.current.get(col.id);
      if (!node) return;
      if (index === from) {
        node.style.transform = `translate3d(0, ${offset}px, 0)`;
      } else {
        let shift = 0;
        if (to > from && index > from && index <= to) shift = -rowHeight;
        else if (to < from && index >= to && index < from) shift = rowHeight;
        node.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : "";
      }
    });
  }, []);

  const clearRowTransforms = useCallback(() => {
    rowSlotsRef.current.forEach((node) => {
      node.style.transform = "";
    });
  }, []);

  const finishRowDrag = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    clearRowTransforms();
    setDraggingColumnId(null);
    if (gesture.to !== gesture.from && reorderColumns) {
      reorderColumns(table.id, gesture.from, gesture.to);
    }
  }, [clearRowTransforms, reorderColumns, table.id]);

  const onGrabRow = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, columnId: string, columnIndex: number) => {
      if (readOnly || event.button !== 0 || table.columns.length < 2) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      gestureRef.current = {
        pointerId: event.pointerId,
        columnId,
        from: columnIndex,
        to: columnIndex,
        startY: event.clientY,
        offset: 0,
      };
      setDraggingColumnId(columnId);
    },
    [readOnly, table.columns.length],
  );

  const onRowKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, columnId: string, columnIndex: number) => {
      if (readOnly || !reorderColumns) return;
      const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!delta) return;
      const to = columnIndex + delta;
      if (to < 0 || to >= table.columns.length) return;
      event.preventDefault();
      event.stopPropagation();
      reorderColumns(table.id, columnIndex, to);
      setAnnouncement(
        `${table.columns[columnIndex].name.toUpperCase()} moved to position ${to + 1} of ${table.columns.length}.`,
      );
    },
    [readOnly, reorderColumns, table.columns, table.id],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const offset = event.clientY - gesture.startY;
      const rowHeight = TABLE_FIELD_HEIGHT;
      const slotShift = Math.round(offset / rowHeight);
      const to = Math.max(0, Math.min(table.columns.length - 1, gesture.from + slotShift));
      gesture.offset = offset;
      gesture.to = to;
      paintRows(gesture.from, gesture.to, gesture.offset, table.columns);
    };
    const release = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      finishRowDrag();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [finishRowDrag, paintRows, table.columns]);

  return (
    <ContextMenuTrigger onOpenChange={(open) => open && onSelect(table.id)}>
      <div
        className={`table-card ${selected ? "selected" : ""} ${multiSelected ? "multi-selected" : ""} ${moving ? "moving" : ""} ${heldByName ? "peer-held" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Table ${table.name}, ${table.columns.length} columns.${heldByName ? ` Selected by ${heldByName}.` : ""} Arrow keys move it.`}
        style={{
          transform: `translate3d(${x}px, ${y}px, 0)`,
          width,
          /*
           * Paired with `content-visibility: auto` in globals.css. Width is
           * already explicit above, so only the height is a guess -- and it is
           * not really a guess: `tableHeight` is the same function the
           * relationship anchors are derived from, so a skipped card reserves
           * exactly the box it will occupy when it scrolls back into view.
           */
          containIntrinsicHeight: `${tableHeight(table)}px`,
          willChange: moving ? "transform" : undefined,
          ...(heldByColor ? ({ "--peer-color": heldByColor } as React.CSSProperties) : {}),
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect(table.id);
        }}
        onKeyDown={(event) => onKeyDown(event, table.id)}
      >
        <div className="table-strip" style={{ background: table.color.a }} aria-hidden="true" />
        <HoverCard
          className="table-head"
          isDisabled={hoverDisabled || draggingColumnId !== null}
          onPointerDown={(event) => onHeaderDown(event, table.id)}
          content={
            <TableSummaryCard
              table={table}
              group={group}
              relationshipCount={relationshipCount}
            />
          }
        >
          <span className="table-name">{table.name.toUpperCase()}</span>
          <span className="table-strategy">
            {table.keyStrategy === "sequence-trigger"
              ? "SEQ+TRG"
              : table.keyStrategy === "identity"
                ? "IDENTITY"
                : ""}
          </span>
        </HoverCard>
        {table.columns.map((column, columnIndex) => (
          <div
            key={column.id}
            ref={(node) => setRowSlot(column.id, node)}
            className={`table-row-slot ${draggingColumnId === column.id ? "lifted" : ""}`}
          >
            <ColumnRow
              table={table}
              column={column}
              columnIndex={columnIndex}
              totalColumns={table.columns.length}
              inUniqueGroup={uniqueGroups.has(column.id)}
              hoverDisabled={hoverDisabled || draggingColumnId !== null}
              readOnly={readOnly}
              foreignKeyTarget={foreignKeyTarget}
              onStartLink={onStartLink}
              onGrabRow={onGrabRow}
              onRowKeyDown={onRowKeyDown}
            />
          </div>
        ))}
        {announcement && (
          <p className="sr-only" role="status" aria-live="polite">
            {announcement}
          </p>
        )}
        {!readOnly && (
          <button
            type="button"
            className={`table-resize ${resizing ? "resizing" : ""}`}
            aria-label={`Resize ${table.name}. Left and Right arrows resize, Shift for larger steps. Double-click to fit the name.`}
            title="Drag to resize · double-click to reset"
            onPointerDown={(event) => onResizeDown(event, table.id)}
            onKeyDown={(event) => onResizeKeyDown(event, table.id)}
            onDoubleClick={() => onResetWidth(table.id)}
          >
            <span className="table-resize-grip" aria-hidden="true" />
          </button>
        )}
      </div>
      <ContextMenu className="w-auto">
        <ContextMenuLabel>{table.name.toUpperCase()}</ContextMenuLabel>
        <ContextMenuGroup>
          <ContextMenuItem onAction={() => onEditInPanel(table.id)}>
            <HugeiconsIcon icon={PanelLeftOpenIcon} />
            Edit in side panel
          </ContextMenuItem>
          <ContextMenuItem onAction={() => onCopyDDL(table.id)}>
            <HugeiconsIcon icon={Copy01Icon} />
            Copy CREATE TABLE
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem isDisabled={readOnly} onAction={() => onAddColumn(table.id)}>
            <HugeiconsIcon icon={ColumnInsertIcon} />
            Add column
            <ContextMenuShortcut>
              <ShortcutKeys id="addColumn" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            isDisabled={readOnly || table.width === undefined}
            onAction={() => onResetWidth(table.id)}
          >
            <HugeiconsIcon icon={HorizontalResizeIcon} />
            Reset width
          </ContextMenuItem>
          <ContextMenuItem isDisabled={readOnly} onAction={() => onMakeJunction(table.id)}>
            <HugeiconsIcon icon={GitMergeIcon} />
            Add junction table
            <ContextMenuShortcut>
              <ShortcutKeys id="junction" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem
            variant="destructive"
            isDisabled={readOnly}
            onAction={() => onDeleteTable(table.id)}
          >
            <HugeiconsIcon icon={Delete02Icon} />
            Delete table
            <ContextMenuShortcut>
              <ShortcutKeys id="deleteSelection" isMac={isMac} />
            </ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenu>
    </ContextMenuTrigger>
  );
});
