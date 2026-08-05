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

import { memo, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ColumnInsertIcon,
  Copy01Icon,
  Delete02Icon,
  GitMergeIcon,
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
import { tableHeight, tableWidth, type Column, type SchemaGroup, type Table } from "@/app/lib/schema";
import { typeColorVar } from "@/app/lib/datatype-color";
import { ColumnCard, ShortcutKeys, TableSummaryCard } from "./primitives";

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
  hoverDisabled,
  foreignKeyTarget,
  onStartLink,
}: {
  table: Table;
  column: Column;
  columnIndex: number;
  hoverDisabled: boolean;
  foreignKeyTarget: ForeignKeyTarget;
  onStartLink: (event: ReactPointerEvent, tableId: string, columnId: string, columnIndex: number) => void;
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
        {!column.notNull && !column.pk && (
          <span className="row-nullable">
            <span className="sr-only">Nullable</span>?
          </span>
        )}
        <span className="row-type" style={{ color: typeColorVar(column.type) }}>
          {column.type}
          {column.size ? `(${column.size})` : ""}
        </span>
      </span>
    </HoverCard>
  );
});

export const TableCard = memo(function TableCard({
  table,
  x,
  y,
  moving,
  selected,
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
  onKeyDown,
  onStartLink,
  onEditInPanel,
  onCopyDDL,
  onAddColumn,
  onMakeJunction,
  onDeleteTable,
}: {
  table: Table;
  x: number;
  y: number;
  moving: boolean;
  selected: boolean;
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
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, tableId: string) => void;
  onStartLink: (event: ReactPointerEvent, tableId: string, columnId: string, columnIndex: number) => void;
  onEditInPanel: (tableId: string) => void;
  onCopyDDL: (tableId: string) => void;
  onAddColumn: (tableId: string) => void;
  onMakeJunction: (tableId: string) => void;
  onDeleteTable: (tableId: string) => void;
}) {
  return (
    <ContextMenuTrigger onOpenChange={(open) => open && onSelect(table.id)}>
      <div
        className={`table-card ${selected ? "selected" : ""} ${moving ? "moving" : ""} ${heldByName ? "peer-held" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Table ${table.name}, ${table.columns.length} columns.${heldByName ? ` Selected by ${heldByName}.` : ""} Arrow keys move it.`}
        style={{
          transform: `translate3d(${x}px, ${y}px, 0)`,
          width: tableWidth(table),
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
          isDisabled={hoverDisabled}
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
          <ColumnRow
            key={column.id}
            table={table}
            column={column}
            columnIndex={columnIndex}
            hoverDisabled={hoverDisabled}
            foreignKeyTarget={foreignKeyTarget}
            onStartLink={onStartLink}
          />
        ))}
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
