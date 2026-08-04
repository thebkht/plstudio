"use client";

/**
 * Small presentation pieces lifted out of `Designer`. They are memoized because
 * the designer owns every piece of canvas state and re-renders on each frame of
 * a gesture; without a memo boundary these re-render with it, and there is one
 * ColumnFlag / ColumnCard per column of every table.
 *
 * Nothing here holds state or reads the schema — props in, markup out.
 */

import { Fragment, memo } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import {
  primaryKeyColumns,
  type Column,
  type KeyStrategy,
  type SchemaGroup,
  type Table,
} from "@/app/lib/schema";
import { typeColorVar } from "@/app/lib/datatype-color";
import { chordParts, shortcutById, type ShortcutId } from "@/app/lib/shortcuts";

export type MenuItem =
  | { label: string; onSelect: () => void; disabled?: boolean; hint?: string }
  | { separator: true };

type MenuAction = Exclude<MenuItem, { separator: true }>;

export const KEY_STRATEGY_LABEL: Record<KeyStrategy, string> = {
  "sequence-trigger": "Sequence + trigger",
  identity: "Generated identity",
  none: "Manual / none",
};

export const Detail = memo(function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
});

/** Summary for the table header, so the whole card need not be read column by column. */
export const TableSummaryCard = memo(function TableSummaryCard({
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
});

/** The hover card mirrors what the side panel shows, without a round trip. */
export const ColumnCard = memo(function ColumnCard({
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
});

/** Dock controls are icon-only, so each one carries its label as a tooltip. */
export const DockButton = memo(function DockButton({
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
});

/** A chord as keycaps, one per token. Shared by the menus and the shortcuts sheet. */
export const ShortcutKeys = memo(function ShortcutKeys({
  id,
  isMac,
}: {
  id: ShortcutId;
  isMac: boolean;
}) {
  const chord = shortcutById(id)?.chords[0];
  if (!chord) return null;
  return (
    <KbdGroup>
      {chordParts(chord, isMac).map((part) => (
        <Kbd key={part}>{part}</Kbd>
      ))}
    </KbdGroup>
  );
});

/**
 * A column constraint as a square icon toggle rather than a checkbox — the row is
 * scanned far more often than it is edited, so the lit state has to read at a glance.
 */
export const ColumnFlag = memo(function ColumnFlag({
  label,
  icon,
  glyph,
  isSelected,
  onChange,
}: {
  label: string;
  icon?: IconSvgElement;
  glyph?: string;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}) {
  return (
    <TooltipTrigger>
      <Toggle
        className="column-flag"
        aria-label={label}
        isSelected={isSelected}
        onChange={onChange}
      >
        {icon ? (
          <HugeiconsIcon icon={icon} size={16} />
        ) : (
          <span aria-hidden="true">{glyph}</span>
        )}
      </Toggle>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
});

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
export const Menu = memo(function Menu({
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
});
