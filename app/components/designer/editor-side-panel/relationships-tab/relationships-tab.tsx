"use client";

import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Relationship, Table } from "@/app/lib/schema";
import { useLayout } from "@/app/hooks";

/**
 * Both tables are resolved once, when the row list is built. The row body used
 * to look them up again on every render of the sidebar — which is every drag
 * frame.
 */
export type RelationshipRow = {
  id: string;
  from: string;
  to: string;
  cardinality: string;
  fromId: string;
  name: string;
  relationship: Relationship;
  startTable: Table;
  endTable: Table;
};

export type RelationshipsTabProps = {
  rows: RelationshipRow[];
  /** The per-relationship editor, rendered by `Workspace`. */
  renderRow: (row: RelationshipRow) => ReactNode;
};

export function RelationshipsTab({ rows, renderRow }: RelationshipsTabProps) {
  const { relationshipQuery, setRelationshipQuery } = useLayout();
  return (
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
      {!rows.length ? (
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
        rows
          .filter((row) =>
            row.name
              .toUpperCase()
              .includes(relationshipQuery.trim().toUpperCase()),
          )
          .map((row) => renderRow(row))
      )}
    </ScrollArea>
  );
}
