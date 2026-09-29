"use client";

import { Dialog } from "react-aria-components";
import { HugeiconsIcon } from "@hugeicons/react";
import { FlashIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { IndexSuggestion } from "@/app/lib/query-analysis";
import type { Table } from "@/app/lib/schema";

/**
 * One chip per table the heatmap would index, pinned to the card's top-right
 * corner in canvas space so it travels with the card. Opening it lists the
 * suggested column lists, each a click away from being a real index.
 */
export function IndexSuggestions({
  tables,
  suggestions,
  readOnly,
  livePosition,
  liveWidth,
  onAdd,
}: {
  tables: Table[];
  suggestions: IndexSuggestion[];
  readOnly: boolean;
  livePosition: (table: Table) => { x: number; y: number };
  liveWidth: (table: Table) => number;
  onAdd: (tableId: string, columnIds: string[]) => void;
}) {
  const byTable = new Map<string, IndexSuggestion[]>();
  suggestions.forEach((suggestion) => byTable.set(suggestion.tableId, [...(byTable.get(suggestion.tableId) ?? []), suggestion]));
  return tables
    .filter((table) => byTable.has(table.id))
    .map((table) => {
      const { x, y } = livePosition(table);
      const own = byTable.get(table.id)!;
      const name = (id: string) => table.columns.find((column) => column.id === id)?.name.toUpperCase();
      return (
        <div
          key={table.id}
          className="index-suggestion"
          style={{ transform: `translate3d(${x + liveWidth(table)}px, ${y}px, 0)` }}
          // The canvas would take this press as the start of a pan or a marquee.
          onPointerDown={(event) => event.stopPropagation()}
        >
          <PopoverTrigger>
            <Button size="sm" variant="outline" aria-label={`${own.length} suggested ${own.length === 1 ? "index" : "indexes"} for ${table.name}`}>
              <HugeiconsIcon icon={FlashIcon} data-icon="inline-start" />
              {own.length}
            </Button>
            <Popover placement="right top">
              <Dialog className="outline-none flex flex-col gap-3" aria-label={`Suggested indexes for ${table.name}`}>
                <PopoverHeader>
                  <PopoverTitle slot="title">Suggested indexes</PopoverTitle>
                  <PopoverDescription>From the saved queries that filter or join {table.name.toUpperCase()}.</PopoverDescription>
                </PopoverHeader>
                {own.map((suggestion) => (
                  <div className="index-suggestion-row" key={suggestion.columnIds.join(",")}>
                    <code>({suggestion.columnIds.map(name).join(", ")})</code>
                    <span className="hint">{suggestion.weight.toLocaleString()}×</span>
                    {!readOnly && (
                      <Button size="sm" variant="outline" onClick={() => onAdd(table.id, suggestion.columnIds)}>
                        Add
                      </Button>
                    )}
                  </div>
                ))}
              </Dialog>
            </Popover>
          </PopoverTrigger>
        </div>
      );
    });
}

/** The ramp's key, in screen space so it stays readable at any zoom. Each level is an order of magnitude of executions. */
export function HeatLegend() {
  return (
    <div className="heat-legend" aria-hidden="true">
      {["1×", "10×", "100×", "1k×"].map((label, index) => (
        <span key={label} className="heat-legend-step">
          <span className="heat-swatch" data-heat={index + 1} />
          {label}
        </span>
      ))}
    </div>
  );
}
