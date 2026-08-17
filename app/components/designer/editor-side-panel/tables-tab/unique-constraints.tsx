"use client";

/**
 * The multi-column unique constraints of one table.
 *
 * A constraint is a set of the table's own columns, so it is edited as chips
 * plus an "add a column" select rather than as free text: a name that does not
 * match a column is not a thing the user can express here, and the schema never
 * holds an id nothing answers to.
 *
 * Single-column uniques live on the column's own Unique flag and deliberately
 * do not appear here -- see `Column.unique`.
 */

import { memo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CancelCircleIcon, Delete02Icon, FingerPrintIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Table, UniqueConstraint } from "@/app/lib/schema";

const ADD_COLUMN = "__add_column__";

export const UniqueConstraints = memo(function UniqueConstraints({
  table,
  readOnly,
  addUnique,
  patchUnique,
  deleteUnique,
}: {
  table: Table;
  readOnly: boolean;
  addUnique: (tableId: string) => void;
  patchUnique: (tableId: string, uniqueId: string, patch: Partial<UniqueConstraint>) => void;
  deleteUnique: (tableId: string, uniqueId: string) => void;
}) {
  const constraints = table.uniques ?? [];
  const columnName = (columnId: string) => table.columns.find((column) => column.id === columnId)?.name.toUpperCase() ?? columnId;
  if (readOnly && !constraints.length) return null;
  return (
    <FieldSet className="unique-constraints">
      <FieldLegend variant="label">Unique constraints</FieldLegend>
      {constraints.map((constraint, index) => {
        const label = constraint.name?.trim() || `Unique constraint ${index + 1}`;
        const available = table.columns.filter((column) => !constraint.columnIds.includes(column.id));
        return (
          <div className="unique-card" key={constraint.id}>
            <InputGroup>
              <InputGroupAddon>
                <HugeiconsIcon icon={FingerPrintIcon} />
              </InputGroupAddon>
              <InputGroupInput
                aria-label={`Name of ${label} on ${table.name}`}
                placeholder={`${table.name.toUpperCase()}_U${index + 1}`}
                value={constraint.name ?? ""}
                disabled={readOnly}
                onChange={(event) => patchUnique(table.id, constraint.id, { name: event.target.value })}
              />
              {!readOnly && (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-label={`Delete ${label} on ${table.name}`}
                    onClick={() => deleteUnique(table.id, constraint.id)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} />
                  </InputGroupButton>
                </InputGroupAddon>
              )}
            </InputGroup>
            <div className="unique-columns">
              {constraint.columnIds.map((columnId) => (
                <span className="unique-chip" key={columnId}>
                  {columnName(columnId)}
                  {!readOnly && (
                    <button
                      type="button"
                      aria-label={`Remove ${columnName(columnId)} from ${label}`}
                      onClick={() =>
                        patchUnique(table.id, constraint.id, {
                          columnIds: constraint.columnIds.filter((id) => id !== columnId),
                        })
                      }
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
                    patchUnique(table.id, constraint.id, { columnIds: [...constraint.columnIds, String(key)] });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>
                    <SelectItem id={ADD_COLUMN}>Add column…</SelectItem>
                    {available.map((column) => (
                      <SelectItem key={column.id} id={column.id}>{column.name.toUpperCase()}</SelectItem>
                    ))}
                  </SelectGroup></SelectContent>
                </Select>
              )}
            </div>
            {constraint.columnIds.length < 2 && (
              <p className="hint">Add a second column — a single column is the column&rsquo;s own Unique flag.</p>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <Button variant="outline" size="sm" onClick={() => addUnique(table.id)}>
          <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
          Add unique constraint
        </Button>
      )}
    </FieldSet>
  );
});
