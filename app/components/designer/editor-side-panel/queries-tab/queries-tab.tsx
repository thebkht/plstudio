"use client";

/**
 * The saved queries, and what they say about the diagram: the heatmap toggle,
 * the index each hot filter is missing, and the joins no foreign key backs.
 *
 * Pasting splits a script or a slow-query log into one saved query per
 * statement, weighted by a `-- executions: N` line or a leading `N<TAB>`.
 */

import { useState } from "react";
import { CodeXmlIcon, FlameIcon, LinkIcon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
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
          <FlameIcon data-icon="inline-start" />
          Heatmap
        </Toggle>
        <span className="hint">{queries.length ? `${queries.length} saved ${queries.length === 1 ? "query" : "queries"}` : "No saved queries yet"}</span>
      </div>

      {!readOnly && (
        <section className="inset-section" aria-label="Add queries">
          <h3 className="inset-group-header">Add queries</h3>
          <div className="inset-group">
            <Textarea
              aria-label="SQL queries or a slow-query log"
              className="sql-draft"
              placeholder={"-- executions: 500\nselect * from orders o join customers c on c.id = o.customer_id;"}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {/* The commit sits on the draft's own surface, as a row action, not a second pill below it. */}
            <button type="button" className="inset-row inset-row-action query-add" disabled={!chunks.length} onClick={addDraft}>
              <PlusIcon size={14} aria-hidden="true" />
              {chunks.length > 1 ? `Add ${chunks.length} queries` : "Add query"}
            </button>
          </div>
          <p className="inset-group-footer">One query per statement. Weight one with a <code>-- executions: N</code> line, or paste rows as <code>N⇥sql</code>.</p>
        </section>
      )}

      {Boolean(analysis.suggestions.length) && (
        <section className="inset-section" aria-label="Suggested indexes">
          <h3 className="inset-group-header">Suggested indexes<span className="inset-group-count">{analysis.suggestions.length}</span></h3>
          <div className="inset-group">
            {analysis.suggestions.map((suggestion) => (
              <div className="inset-row query-finding" key={`${suggestion.tableId}|${suggestion.columnIds.join(",")}`}>
                <button type="button" className="query-finding-body" onClick={() => show([suggestion.tableId])}>
                  <code>{tablesById.get(suggestion.tableId)?.name.toUpperCase()} ({columnList(suggestion)})</code>
                  <span className="query-finding-note">{times(suggestion.weight)} · {REASONS[suggestion.reason]}</span>
                </button>
                {!readOnly && (
                  <button type="button" className="row-text-button" onClick={() => addIndex(suggestion.tableId, suggestion.columnIds)}>
                    Add index
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {Boolean(analysis.implicitJoins.length) && (
        <section className="inset-section" aria-label="Joins without a foreign key">
          <h3 className="inset-group-header">Joins without a foreign key<span className="inset-group-count">{analysis.implicitJoins.length}</span></h3>
          <div className="inset-group">
            {analysis.implicitJoins.map((join) => (
              <button
                type="button"
                className="inset-row inset-row-action query-finding query-finding-body"
                key={`${join.from.tableId}:${join.from.columnId}|${join.to.tableId}:${join.to.columnId}`}
                onClick={() => show([join.from.tableId, join.to.tableId])}
              >
                <code>{columnName(join.from.tableId, join.from.columnId)} = {columnName(join.to.tableId, join.to.columnId)}</code>
                <span className="query-finding-note">{times(join.weight)} · possibly a missing foreign key</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {queries.length ? (
        <section className="inset-section" aria-label="Saved queries">
          <h3 className="inset-group-header">Saved queries<span className="inset-group-count">{queries.length}</span></h3>
          <div className="inset-group">
            {queries.map((query, index) => {
              const label = query.name.trim() || `Query ${index + 1}`;
              const unresolved = analysis.perQuery.get(query.id)?.unresolved ?? [];
              return (
                <div className="query-item" key={query.id}>
                  <div className="inset-row query-head">
                    <CodeXmlIcon size={14} className="inset-row-icon" aria-hidden="true" />
                    <Input
                      className="inset-field leading"
                      aria-label={`Name of ${label}`}
                      placeholder={label}
                      value={query.name}
                      disabled={readOnly}
                      onChange={(event) => withQueries((current) => current.map((item) => (item.id === query.id ? { ...item, name: event.target.value } : item)))}
                    />
                    <span className="query-weight" title="Executions">{times(query.executions ?? 1)}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="row-icon-button destructive"
                        aria-label={`Delete ${label}`}
                        onClick={() => withQueries((current) => current.filter((item) => item.id !== query.id))}
                      >
                        <Trash2Icon size={14} />
                      </button>
                    )}
                  </div>
                  <pre className="code query-sql">{highlightSql(query.sql)}</pre>
                  {Boolean(unresolved.length) && (
                    <p className="query-unresolved">Not in this diagram: {unresolved.join(", ")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LinkIcon/>
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
