"use client";

import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  DatabaseIcon,
  PlusSignIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyContent,
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
import type { Table } from "@/app/lib/schema";
import { useLayout } from "@/app/hooks";

export type TableSection = {
  id: string;
  name: string;
  accent: string;
  prefix?: string;
  tables: Table[];
};

export type TablesTabProps = {
  tables: Table[];
  filteredTables: Table[];
  sections: TableSection[];
  hasGroups: boolean;
  onAddTable: () => void;
  /**
   * The per-table editor is rendered by `Workspace`: it closes over the column
   * commands and the foreign-key candidate lists, which are not this list's
   * business.
   */
  renderTable: (table: Table) => ReactNode;
};

export function TablesTab({
  tables,
  filteredTables,
  sections,
  hasGroups,
  onAddTable,
  renderTable,
}: TablesTabProps) {
  const { tableQuery, setTableQuery, collapsedGroupIds, setCollapsedGroupIds } =
    useLayout();

  return (
    <>
      <div className="panel-toolbar">
        <InputGroup>
          <InputGroupAddon>
            <HugeiconsIcon icon={Search01Icon} />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search tables"
            placeholder="Search tables"
            value={tableQuery}
            onChange={(event) => setTableQuery(event.target.value)}
          />
        </InputGroup>
        {/* The panel's primary action, so it carries more weight
            than the search field it sits beside. */}
        <Button variant="outline" size="sm" onClick={onAddTable}>
          <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
          Add table
        </Button>
      </div>
      <ScrollArea className="panel-body">
        {!tables.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={DatabaseIcon} />
              </EmptyMedia>
              <EmptyTitle>No tables</EmptyTitle>
              <EmptyDescription>Start building your diagram!</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={onAddTable}>
                <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
                Add table
              </Button>
            </EmptyContent>
          </Empty>
        ) : !filteredTables.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Search01Icon} />
              </EmptyMedia>
              <EmptyTitle>No matches</EmptyTitle>
              <EmptyDescription>
                No table names contain “{tableQuery}”.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : !hasGroups ? (
          filteredTables.map((table) => renderTable(table))
        ) : (
          sections.map((section) => {
            const expanded =
              Boolean(tableQuery.trim()) || !collapsedGroupIds.has(section.id);
            return (
              <Collapsible
                className={`entity-group ${expanded ? "open" : ""}`}
                key={section.id}
                isExpanded={expanded}
                onExpandedChange={(next) =>
                  setCollapsedGroupIds((current) => {
                    const ids = new Set(current);
                    if (next) ids.delete(section.id);
                    else ids.add(section.id);
                    return ids;
                  })
                }
              >
                <CollapsibleTrigger className="entity-group-head">
                  <span
                    className="entity-group-dot"
                    style={{ background: section.accent }}
                    aria-hidden="true"
                  />
                  <span className="entity-group-name">{section.name}</span>
                  {section.prefix && (
                    <span className="entity-group-keyword">
                      {section.prefix}
                    </span>
                  )}
                  {/* The bare number is unambiguous beside the list it
                      counts; screen readers get the unit. */}
                  <span
                    className="entity-group-count"
                    title={`${section.tables.length} ${section.tables.length === 1 ? "table" : "tables"}`}
                    aria-label={`${section.tables.length} ${section.tables.length === 1 ? "table" : "tables"}`}
                  >
                    {section.tables.length}
                  </span>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className="entity-group-chevron"
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="entity-group-body">
                    {section.tables.length ? (
                      section.tables.map((table) => renderTable(table))
                    ) : (
                      <p className="entity-group-empty">
                        No tables yet — assign one under Schema group.
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </ScrollArea>
    </>
  );
}
