"use client";

/**
 * A list of named column sets on one table -- the shape unique constraints and
 * indexes share.
 *
 * A set is made of the table's own columns, so it is edited as chips plus an
 * "add a column" select rather than as free text: a name that does not match a
 * column is not a thing the user can express here, and the schema never holds
 * an id nothing answers to.
 */

import { memo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon, Delete02Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Table, TableIndex, UniqueConstraint } from "@/app/lib/schema";

const ADD_COLUMN = "__add_column__";

type ColumnSet = UniqueConstraint | TableIndex;

export type ColumnSetsProps = {
  table: Table;
  readOnly: boolean;
  sets: ColumnSet[];
  /** "Unique constraint", "Index" -- numbered for a set with no name. */
  noun: string;
  legend: string;
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  /** The name the generator mints for the set at `index`. */
  placeholder: (index: number) => string;
  /** A note under a set, or `null`. */
  hint?: (set: ColumnSet) => string | null;
  onAdd: (tableId: string) => void;
  onPatch: (tableId: string, setId: string, patch: Partial<ColumnSet>) => void;
  onDelete: (tableId: string, setId: string) => void;
};

export const ColumnSets = memo(function ColumnSets({
  table,
  readOnly,
  sets,
  noun,
  legend,
  icon,
  placeholder,
  hint,
  onAdd,
  onPatch,
  onDelete,
}: ColumnSetsProps) {
  const columnName = (columnId: string) => table.columns.find((column) => column.id === columnId)?.name.toUpperCase() ?? columnId;
  if (readOnly && !sets.length) return null;
  return (
    <section className="inset-section" aria-label={legend}>
      <h3 className="inset-group-header">
        {legend}
        {Boolean(sets.length) && <span className="inset-group-count">{sets.length}</span>}
        {!readOnly && (
          <button type="button" className="row-icon-button tint" aria-label={`Add ${noun.toLowerCase()} to ${table.name}`} onClick={() => onAdd(table.id)}>
            <HugeiconsIcon icon={PlusSignIcon} size={16} />
          </button>
        )}
      </h3>
      {sets.map((set, index) => {
        const label = set.name?.trim() || `${noun} ${index + 1}`;
        const available = table.columns.filter((column) => !set.columnIds.includes(column.id));
        const note = hint?.(set);
        return (
          <div className="inset-section" key={set.id}>
            <div className="inset-group">
              <div className="inset-row">
                <HugeiconsIcon icon={icon} size={15} className="inset-row-icon" aria-hidden="true" />
                <Input
                  className="inset-field mono leading"
                  aria-label={`Name of ${label} on ${table.name}`}
                  placeholder={placeholder(index)}
                  value={set.name ?? ""}
                  disabled={readOnly}
                  onChange={(event) => onPatch(table.id, set.id, { name: event.target.value })}
                />
                {!readOnly && (
                  <button type="button" className="row-icon-button destructive" aria-label={`Delete ${label} on ${table.name}`} onClick={() => onDelete(table.id, set.id)}>
                    <HugeiconsIcon icon={Delete02Icon} size={15} />
                  </button>
                )}
              </div>
              <div className="inset-row unique-columns">
                {set.columnIds.map((columnId) => (
                  <span className="unique-chip" key={columnId}>
                    {columnName(columnId)}
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`Remove ${columnName(columnId)} from ${label}`}
                        onClick={() => onPatch(table.id, set.id, { columnIds: set.columnIds.filter((id) => id !== columnId) })}
                      >
                        <HugeiconsIcon icon={CancelCircleIcon} size={13} aria-hidden="true" />
                      </button>
                    )}
                  </span>
                ))}
                {/* Empty until a column is picked: the select adds, it never selects. */}
                {!readOnly && Boolean(available.length) && (
                  <Select
                    aria-label={`Add a column to ${label}`}
                    selectedKey={ADD_COLUMN}
                    onSelectionChange={(key) => {
                      if (key === ADD_COLUMN) return;
                      onPatch(table.id, set.id, { columnIds: [...set.columnIds, String(key)] });
                    }}
                  >
                    <SelectTrigger className="unique-add"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>
                      <SelectItem id={ADD_COLUMN}>Add column</SelectItem>
                      {available.map((column) => (
                        <SelectItem key={column.id} id={column.id}>{column.name.toUpperCase()}</SelectItem>
                      ))}
                    </SelectGroup></SelectContent>
                  </Select>
                )}
              </div>
            </div>
            {note && <p className="inset-group-footer">{note}</p>}
          </div>
        );
      })}
    </section>
  );
});
