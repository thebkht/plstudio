"use client";

/**
 * The multi-column unique constraints of one table.
 *
 * Single-column uniques live on the column's own Unique flag and deliberately
 * do not appear here -- see `Column.unique`.
 */

import { memo } from "react";
import { FingerPrintIcon } from "@hugeicons/core-free-icons";
import type { Table, UniqueConstraint } from "@/app/lib/schema";
import { ColumnSets } from "./column-sets";

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
  return (
    <ColumnSets
      table={table}
      readOnly={readOnly}
      sets={table.uniques ?? []}
      noun="Unique constraint"
      legend="Unique constraints"
      icon={FingerPrintIcon}
      placeholder={(index) => `${table.name.toUpperCase()}_U${index + 1}`}
      hint={(set) => (set.columnIds.length < 2 ? "Add a second column — a single column is the column’s own Unique flag." : null)}
      onAdd={addUnique}
      onPatch={patchUnique}
      onDelete={deleteUnique}
    />
  );
});
