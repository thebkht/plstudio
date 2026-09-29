"use client";

/**
 * The saved queries, and what they say about the diagram: the heatmap toggle,
 * the index each hot filter is missing, and the joins no foreign key backs.
 *
 * Pasting splits a script or a slow-query log into one saved query per
 * statement, weighted by a `-- executions: N` line or a leading `N<TAB>`.
 */

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  FireIcon,
  Link01Icon,
  PlusSignIcon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { useCanvasCommands, useOverlay, useSchema, useSelect } from "@/app/hooks";
import { splitQueries, type IndexSuggestion } from "@/app/lib/query-analysis";
import { EMPTY_SELECTION } from "@/app/lib/selection";
import { makeSavedQuery, type SavedQuery, type Table } from "@/app/lib/schema";
import { highlightSql } from "../../highlight";

const REASONS: Record<IndexSuggestion["reason"], string> = {
  fk: "Foreign key joined without an index. Oracle does not index foreign keys, and an unindexed one locks the child table while a parent row is deleted.",
  composite: "Filtered on together.",
  filter: "Filtered on.",
};

const times = (weight: number) => `${weight.toLocaleString()}×`;

export function QueriesTab({ readOnly }: { readOnly: boolean }) {
  const { schema, commitWith, addIndex, tablesById } = useSchema();
  const { heatmap, setHeatmap, analysis } = useOverlay();
  const { setSelection } = useSelect();
  const { revealTables } = useCanvasCommands();
  const [draft, setDraft] = useState("");
  const queries = schema.queries ?? [];
  const chunks = splitQueries(draft);

  const withQueries = (mutate: (queries: SavedQuery[]) => SavedQuery[]) =>
    commitWith((current) => ({ ...current, queries: mutate(current.queries ?? []) }));
  const addDraft = () => {
    withQueries((current) => [...current, ...chunks.map((chunk) => makeSavedQuery(chunk.sql, "", chunk.executions > 1 ? chunk.executions : undefined))]);
    setDraft("");
  };
  /** Select and bring into view: the same answer the table list gives a click. */
  const show = (ids: string[]) => {
    const tables = ids.map((id) => tablesById.get(id)).filter((table): table is Table => Boolean(table));
    setSelection({ ...EMPTY_SELECTION, tables: tables.map((table) => table.id) });
    revealTables(tables);
  };
  const columnName = (tableId: string, columnId: string) => {
    const table = tablesById.get(tableId);
    return `${table?.name.toUpperCase()}.${table?.columns.find((column) => column.id === columnId)?.name.toUpperCase()}`;
  };
  const columnList = (suggestion: IndexSuggestion) => {
    const table = tablesById.get(suggestion.tableId);
    return suggestion.columnIds.map((id) => table?.columns.find((column) => column.id === id)?.name.toUpperCase()).join(", ");
  };

  return (
    <ScrollArea className="panel-body queries-panel-body">
      <div className="queries-toolbar">
        <Toggle
          variant="outline"
          size="sm"
          isSelected={heatmap}
          onChange={setHeatmap}
          isDisabled={!queries.length}
        >
          <HugeiconsIcon icon={FireIcon} data-icon="inline-start" />
          Heatmap
        </Toggle>
        <span className="hint">{queries.length ? `${queries.length} saved ${queries.length === 1 ? "query" : "queries"}` : "No saved queries yet"}</span>
      </div>

      {!readOnly && (
        <FieldSet className="queries-add">
          <FieldLegend variant="label">Add queries</FieldLegend>
          <Textarea
            aria-label="SQL queries or a slow-query log"
            className="sql-draft"
            placeholder={"-- executions: 500\nselect * from orders o join customers c on c.id = o.customer_id;"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <p className="hint">One query per statement. Weight one with a <code>-- executions: N</code> line, or paste rows as <code>N⇥sql</code>.</p>
          <Button variant="outline" size="sm" isDisabled={!chunks.length} onClick={addDraft}>
            <HugeiconsIcon icon={PlusSignIcon} data-icon="inline-start" />
            {chunks.length > 1 ? `Add ${chunks.length} queries` : "Add query"}
          </Button>
        </FieldSet>
      )}

      {Boolean(analysis.suggestions.length) && (
        <FieldSet>
          <FieldLegend variant="label">Suggested indexes</FieldLegend>
          {analysis.suggestions.map((suggestion) => (
            <div className="query-finding" key={`${suggestion.tableId}|${suggestion.columnIds.join(",")}`}>
              <button type="button" className="query-finding-body" onClick={() => show([suggestion.tableId])}>
                <code>{tablesById.get(suggestion.tableId)?.name.toUpperCase()} ({columnList(suggestion)})</code>
                <span className="hint">{times(suggestion.weight)} · {REASONS[suggestion.reason]}</span>
              </button>
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => addIndex(suggestion.tableId, suggestion.columnIds)}>
                  Add index
                </Button>
              )}
            </div>
          ))}
        </FieldSet>
      )}

      {Boolean(analysis.implicitJoins.length) && (
        <FieldSet>
          <FieldLegend variant="label">Joins without a foreign key</FieldLegend>
          {analysis.implicitJoins.map((join) => (
            <button
              type="button"
              className="query-finding query-finding-body"
              key={`${join.from.tableId}:${join.from.columnId}|${join.to.tableId}:${join.to.columnId}`}
              onClick={() => show([join.from.tableId, join.to.tableId])}
            >
              <code>{columnName(join.from.tableId, join.from.columnId)} = {columnName(join.to.tableId, join.to.columnId)}</code>
              <span className="hint">{times(join.weight)} · possibly a missing foreign key</span>
            </button>
          ))}
        </FieldSet>
      )}

      {queries.length ? (
        <FieldSet>
          <FieldLegend variant="label">Saved queries</FieldLegend>
          {queries.map((query, index) => {
            const label = query.name.trim() || `Query ${index + 1}`;
            const unresolved = analysis.perQuery.get(query.id)?.unresolved ?? [];
            return (
              <div className="unique-card" key={query.id}>
                <InputGroup>
                  <InputGroupAddon>
                    <HugeiconsIcon icon={SourceCodeIcon} />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label={`Name of ${label}`}
                    placeholder={label}
                    value={query.name}
                    disabled={readOnly}
                    onChange={(event) => withQueries((current) => current.map((item) => (item.id === query.id ? { ...item, name: event.target.value } : item)))}
                  />
                  <InputGroupAddon align="inline-end">
                    <span className="hint">{times(query.executions ?? 1)}</span>
                    {!readOnly && (
                      <InputGroupButton
                        aria-label={`Delete ${label}`}
                        onClick={() => withQueries((current) => current.filter((item) => item.id !== query.id))}
                      >
                        <HugeiconsIcon icon={Delete02Icon} />
                      </InputGroupButton>
                    )}
                  </InputGroupAddon>
                </InputGroup>
                <pre className="code query-sql">{highlightSql(query.sql)}</pre>
                {Boolean(unresolved.length) && (
                  <p className="hint">Not in this diagram: {unresolved.join(", ")}</p>
                )}
              </div>
            );
          })}
        </FieldSet>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Link01Icon} />
            </EmptyMedia>
            <EmptyTitle>No saved queries</EmptyTitle>
            <EmptyDescription>
              Paste the queries your application runs to see which tables and foreign keys they lean on.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </ScrollArea>
  );
}
