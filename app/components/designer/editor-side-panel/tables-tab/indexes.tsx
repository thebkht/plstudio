"use client";

/**
 * The plain (non-unique) indexes of one table. A unique index is a unique
 * constraint, and is edited there.
 */

import { memo } from "react";
import { ZapIcon } from "lucide-react";
import type { Table, TableIndex } from "@/app/lib/schema";
import { ColumnSets } from "./column-sets";

export const Indexes = memo(function Indexes({
  table,
  readOnly,
  addIndex,
  patchIndex,
  deleteIndex,
}: {
  table: Table;
  readOnly: boolean;
  addIndex: (tableId: string) => void;
  patchIndex: (tableId: string, indexId: string, patch: Partial<TableIndex>) => void;
  deleteIndex: (tableId: string, indexId: string) => void;
}) {
  return (
    <ColumnSets
      table={table}
      readOnly={readOnly}
      sets={table.indexes ?? []}
      noun="Index"
      legend="Indexes"
      icon={ZapIcon}
      placeholder={(index) => `${table.name.toUpperCase()}_I${index + 1}`}
      hint={(set) => (set.columnIds.length ? null : "Add a column to index.")}
      onAdd={addIndex}
      onPatch={patchIndex}
      onDelete={deleteIndex}
    />
  );
});
