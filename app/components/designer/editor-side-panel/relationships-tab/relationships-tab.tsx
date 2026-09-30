"use client";

import type { ReactNode } from "react";
import { LinkIcon, SearchIcon } from "lucide-react";
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
          <SearchIcon/>
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
              <LinkIcon/>
            </EmptyMedia>
            <EmptyTitle>No relationships</EmptyTitle>
            <EmptyDescription>
              Give a column a foreign key to link two tables.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="entity-list">
          {rows
            .filter((row) =>
              row.name
                .toUpperCase()
                .includes(relationshipQuery.trim().toUpperCase()),
            )
            .map((row) => renderRow(row))}
        </div>
      )}
    </ScrollArea>
  );
}
