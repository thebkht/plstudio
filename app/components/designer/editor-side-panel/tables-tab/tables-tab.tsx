"use client";

import type { ReactNode } from "react";
import { ChevronDownIcon, DatabaseIcon, PlusIcon, SearchIcon } from "lucide-react";
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
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
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
        <InputGroup className="search-field">
          <InputGroupAddon>
            <SearchIcon/>
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search tables"
            placeholder="Search"
            value={tableQuery}
            onChange={(event) => setTableQuery(event.target.value)}
          />
        </InputGroup>
        <TooltipTrigger>
          <Button
            variant="ghost"
            size="icon-sm"
            className="toolbar-add"
            aria-label="Add table"
            onClick={onAddTable}
          >
            <PlusIcon/>
          </Button>
          <Tooltip>Add table</Tooltip>
        </TooltipTrigger>
      </div>
      <ScrollArea className="panel-body">
        {!tables.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <DatabaseIcon/>
              </EmptyMedia>
              <EmptyTitle>No tables</EmptyTitle>
              <EmptyDescription>Start building your diagram!</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={onAddTable}>
                <PlusIcon data-icon="inline-start" />
                Add table
              </Button>
            </EmptyContent>
          </Empty>
        ) : !filteredTables.length ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon/>
              </EmptyMedia>
              <EmptyTitle>No matches</EmptyTitle>
              <EmptyDescription>
                No table names contain “{tableQuery}”.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : !hasGroups ? (
          // One inset group, rows divided by hairlines -- not a card per table.
          <div className="entity-list">{filteredTables.map((table) => renderTable(table))}</div>
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
                  <ChevronDownIcon className="entity-group-chevron"
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="entity-group-body">
                    {section.tables.length ? (
                      <div className="entity-list">{section.tables.map((table) => renderTable(table))}</div>
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
