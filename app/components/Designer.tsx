"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Database,
  Download,
  FileUp,
  KeyRound,
  LayoutGrid,
  Link2,
  Minus,
  Moon,
  Plus,
  Redo2,
  Search,
  Save,
  Sun,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { exportSchema, generateDDL, generatePLSQL } from "@/app/lib/generators";
import { parseCreateTable } from "@/app/lib/parser";
import {
  cloneSchema,
  makeColumn,
  makeDemoSchema,
  makeTable,
  ORACLE_TYPES,
  primaryKeyColumns,
  tableHeight,
  typeSizePlaceholder,
  typeUsesSize,
  type Schema,
  type Table,
  type Column,
  type KeyStrategy,
} from "@/app/lib/schema";
import { validateSchema } from "@/app/lib/validation";

const TABLE_WIDTH = 260;
const HEADER_HEIGHT = 48;
const ROW_HEIGHT = 30;

export default function Designer() {
  const [schema, setSchema] = useState<Schema>(() => makeDemoSchema());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<Schema[]>([]);
  const [future, setFuture] = useState<Schema[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{
    id: string;
    dx: number;
    dy: number;
  } | null>(null);
  const [panning, setPanning] = useState<{
    x: number;
    y: number;
    px: number;
    py: number;
  } | null>(null);
  const [modal, setModal] = useState<"export" | "import" | null>(null);
  const [exportTab, setExportTab] = useState<"ddl" | "plsql" | "combined">(
    "ddl",
  );
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [tableQuery, setTableQuery] = useState("");
  const canvasRef = useRef<HTMLDivElement>(null);
  const selected =
    schema.tables.find((table) => table.id === selectedId) ?? null;
  const filteredTables = useMemo(() => {
    const query = tableQuery.trim().toUpperCase();
    return query
      ? schema.tables.filter((table) => table.name.toUpperCase().includes(query))
      : schema.tables;
  }, [schema.tables, tableQuery]);
  const compatibleForeignKeyTargets = (column: Column) =>
    schema.tables
      .filter(
        (table) =>
          table.id !== selectedId && primaryKeyColumns(table).length <= 1,
      )
      .flatMap((table) =>
        table.columns
          .filter(
            (target) =>
              target.type === column.type || target.id === column.fk?.columnId,
          )
          .map((target) => ({ table, target })),
      );
  const issues = useMemo(() => validateSchema(schema), [schema]);
  const errors = issues.filter((issue) => issue.severity === "error");
  const ddl = useMemo(() => generateDDL(schema), [schema]);
  const plsql = useMemo(() => generatePLSQL(schema), [schema]);
  const combined = useMemo(() => exportSchema(schema), [schema]);
  const output =
    exportTab === "ddl" ? ddl : exportTab === "plsql" ? plsql : combined;

  const commit = useCallback(
    (next: Schema) => {
      setHistory((items) => [...items.slice(-49), cloneSchema(schema)]);
      setFuture([]);
      setSchema({ ...next, revision: schema.revision });
    },
    [schema],
  );

  const patchTable = useCallback(
    (id: string, patch: Partial<Table>) =>
      commit({
        ...schema,
        tables: schema.tables.map((table) =>
          table.id === id ? { ...table, ...patch } : table,
        ),
      }),
    [commit, schema],
  );
  const patchColumn = useCallback(
    (tableId: string, columnId: string, patch: Partial<Column>) =>
      commit({
        ...schema,
        tables: schema.tables.map((table) =>
          table.id === tableId
            ? {
                ...table,
                columns: table.columns.map((column) =>
                  column.id === columnId ? { ...column, ...patch } : column,
                ),
              }
            : table,
        ),
      }),
    [commit, schema],
  );

  const deleteTable = (id: string) => {
    const next = {
      ...schema,
      tables: schema.tables
        .filter((table) => table.id !== id)
        .map((table) => ({
          ...table,
          columns: table.columns.map((column) =>
            column.fk?.tableId === id ? { ...column, fk: null } : column,
          ),
        })),
    };
    commit(next);
    if (selectedId === id) setSelectedId(null);
  };
  const addTable = () => {
    const table = makeTable(
      `TABLE_${schema.tables.length + 1}`,
      90 + (schema.tables.length % 4) * 70,
      100 + (schema.tables.length % 3) * 75,
      schema.tables.length,
    );
    commit({ ...schema, tables: [...schema.tables, table] });
    setSelectedId(table.id);
  };
  const addColumn = (tableId: string) => {
    const table = schema.tables.find((item) => item.id === tableId);
    if (!table) return;
    commit({
      ...schema,
      tables: schema.tables.map((item) =>
        item.id === tableId
          ? {
              ...item,
              columns: [
                ...item.columns,
                makeColumn({ name: `COLUMN_${item.columns.length + 1}` }),
              ],
            }
          : item,
      ),
    });
  };
  const deleteColumn = (tableId: string, columnId: string) =>
    commit({
      ...schema,
      tables: schema.tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              columns: table.columns.filter((column) => column.id !== columnId),
            }
          : {
              ...table,
              columns: table.columns.map((column) =>
                column.fk?.columnId === columnId
                  ? { ...column, fk: null }
                  : column,
              ),
            },
      ),
    });

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((items) => [...items, cloneSchema(schema)]);
    setHistory((items) => items.slice(0, -1));
    setSchema(previous);
  };
  const redo = () => {
    const next = future.at(-1);
    if (!next) return;
    setHistory((items) => [...items, cloneSchema(schema)]);
    setFuture((items) => items.slice(0, -1));
    setSchema(next);
  };
  const autoLayout = () => {
    const next = {
      ...schema,
      tables: schema.tables.map((table, index) => ({
        ...table,
        x: 70 + (index % 4) * 360,
        y: 70 + Math.floor(index / 4) * 270,
      })),
    };
    commit(next);
  };
  const fitView = () => {
    if (!canvasRef.current || !schema.tables.length) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const maxX = Math.max(
      ...schema.tables.map((table) => table.x + TABLE_WIDTH),
    );
    const maxY = Math.max(
      ...schema.tables.map((table) => table.y + tableHeight(table)),
    );
    setZoom(
      Math.max(
        0.55,
        Math.min(
          1.15,
          Math.min((rect.width - 80) / maxX, (rect.height - 80) / maxY),
        ),
      ),
    );
    setPan({ x: 40, y: 40 });
  };

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (drag && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (event.clientX - rect.left - pan.x) / zoom - drag.dx;
        const y = (event.clientY - rect.top - pan.y) / zoom - drag.dy;
        setSchema((current) => ({
          ...current,
          tables: current.tables.map((table) =>
            table.id === drag.id
              ? { ...table, x: Math.max(0, x), y: Math.max(0, y) }
              : table,
          ),
        }));
      }
      if (panning)
        setPan({
          x: panning.x + event.clientX - panning.px,
          y: panning.y + event.clientY - panning.py,
        });
    };
    const up = () => {
      if (drag) {
        setHistory((items) => [...items.slice(-49), cloneSchema(schema)]);
        setFuture([]);
      }
      setDrag(null);
      setPanning(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, panning, pan, zoom, schema]);

  const onCanvasWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const next = Math.min(
      1.8,
      Math.max(0.45, zoom * (event.deltaY > 0 ? 0.92 : 1.08)),
    );
    setZoom(next);
  };
  const onCanvasDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(null);
    setPanning({ x: pan.x, y: pan.y, px: event.clientX, py: event.clientY });
  };
  const onHeaderDown = (
    event: React.PointerEvent<HTMLDivElement>,
    table: Table,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setSelectedId(table.id);
    setDrag({
      id: table.id,
      dx: (event.clientX - rect.left - pan.x) / zoom - table.x,
      dy: (event.clientY - rect.top - pan.y) / zoom - table.y,
    });
  };

  const makeJunction = () => {
    const picked = schema.tables.filter((table) => table.id === selectedId);
    if (picked.length !== 1 || schema.tables.length < 2) return;
    const left = picked[0];
    const right = schema.tables.find((table) => table.id !== left.id);
    if (!right) return;
    const leftPk = primaryKeyColumns(left)[0];
    const rightPk = primaryKeyColumns(right)[0];
    if (!leftPk || !rightPk) return;
    const junction = makeTable(
      `${left.name}_${right.name}`,
      left.x + 330,
      left.y + 150,
      schema.tables.length,
    );
    junction.keyStrategy = "none";
    junction.columns = [
      makeColumn({
        name: `${left.name}_ID`,
        type: leftPk.type,
        size: leftPk.size,
        pk: true,
        notNull: true,
        fk: { tableId: left.id, columnId: leftPk.id },
      }),
      makeColumn({
        name: `${right.name}_ID`,
        type: rightPk.type,
        size: rightPk.size,
        pk: true,
        notNull: true,
        fk: { tableId: right.id, columnId: rightPk.id },
      }),
    ];
    commit({ ...schema, tables: [...schema.tables, junction] });
    setSelectedId(junction.id);
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  const download = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportTab === "plsql" ? "packages.sql" : "schema.sql";
    link.click();
    URL.revokeObjectURL(url);
  };
  const importSchema = () => {
    const result = parseCreateTable(importText);
    if (!result.schema) {
      setImportMessage({ ok: false, text: result.errors.join(" ") });
      return;
    }
    setImportMessage({
      ok: true,
      text: `${result.schema.tables.length} table(s) imported.${result.warnings.length ? ` ${result.warnings.length} warning(s).` : ""}`,
    });
    commit(result.schema);
    setSelectedId(result.schema.tables[0]?.id ?? null);
  };
  const clearInvalidForeignKeys = () => {
    const next = {
      ...schema,
      tables: schema.tables.map((table) => ({
        ...table,
        columns: table.columns.map((column) => {
          if (!column.fk) return column;
          const targetTable = schema.tables.find(
            (candidate) => candidate.id === column.fk?.tableId,
          );
          const targetColumn = targetTable?.columns.find(
            (candidate) => candidate.id === column.fk?.columnId,
          );
          const isValid =
            targetTable &&
            targetColumn &&
            primaryKeyColumns(targetTable).length <= 1 &&
            targetColumn.type === column.type;
          return isValid ? column : { ...column, fk: null };
        }),
      })),
    };
    commit(next);
  };

  const save = async () => {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schema }),
    });
    if (!response.ok)
      window.alert(
        "Database save is unavailable. Configure DATABASE_URL first.",
      );
    else window.alert("Project saved.");
  };

  const relationships = useMemo(
    () =>
      schema.tables.flatMap((table) =>
        table.columns.flatMap((column, index) => {
          if (!column.fk) return [];
          const target = schema.tables.find(
            (item) => item.id === column.fk?.tableId,
          );
          const targetIndex =
            target?.columns.findIndex(
              (item) => item.id === column.fk?.columnId,
            ) ?? -1;
          return target && targetIndex >= 0
            ? [
                {
                  from: table,
                  fromIndex: index,
                  to: target,
                  toIndex: targetIndex,
                  id: column.id,
                },
              ]
            : [];
        }),
      ),
    [schema],
  );
  const point = (table: Table, index: number) => ({
    x:
      table.x +
      (table.x <
      (schema.tables.find((item) => item.id === selectedId)?.x ?? table.x)
        ? TABLE_WIDTH
        : 0),
    y: table.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2,
  });

  return (
    <div className={`designer light`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Database size={18} />
          </div>
          <div>
            <div className="brand-title">Schema Designer</div>
            <div className="brand-sub">Oracle PL/SQL · 12.2+</div>
          </div>
        </div>
        <div className="toolbar">
          <div className="toolbar-group">
            <Button
              className="btn ghost"
              aria-label="Undo last change"
              onClick={undo}
              isDisabled={!history.length}
            >
              <Undo2 size={16} />
            </Button>
            <Button
              className="btn ghost"
              aria-label="Redo last change"
              onClick={redo}
              isDisabled={!future.length}
            >
              <Redo2 size={16} />
            </Button>
          </div>
          <div className="toolbar-group">
            <Button className="btn" onClick={addTable}>
              <Plus size={15} /> Table
            </Button>
            <Button className="btn" onClick={() => setModal("import")}>
              <FileUp size={15} /> Import
            </Button>
            <Button className="btn" onClick={save}>
              <Save size={15} /> Save
            </Button>
            <Button className="btn primary" onClick={() => setModal("export")}>
              <Download size={15} /> Export
            </Button>
          </div>
        </div>
      </header>
      <section className="workspace">
        <aside className="tables-sidebar" aria-label="Tables">
          <div className="sidebar-head">
            <div className="sidebar-title">
              <Database size={16} />
              <strong>Tables</strong>
              <Badge variant="secondary">{schema.tables.length}</Badge>
            </div>
            <Button
              className="btn ghost sidebar-collapse"
              aria-label="Collapse tables sidebar"
              onClick={() => setTableQuery("")}
            >
              <ChevronDown size={15} />
            </Button>
          </div>
          <label className="sidebar-search">
            <Search size={14} />
            <Input
              aria-label="Search tables"
              placeholder="Search tables"
              value={tableQuery}
              onChange={(event) => setTableQuery(event.target.value)}
            />
          </label>
          <div className="table-list" role="list">
            {filteredTables.map((table) => (
              <button
                className={`table-list-item ${selectedId === table.id ? "active" : ""}`}
                key={table.id}
                type="button"
                onClick={() => setSelectedId(table.id)}
              >
                <span
                  className="table-list-swatch"
                  style={{ background: table.color.a }}
                />
                <span className="table-list-copy">
                  <strong>{table.name.toUpperCase()}</strong>
                  <small>{table.columns.length} columns</small>
                </span>
                <span className="table-list-more">···</span>
              </button>
            ))}
            {!filteredTables.length && (
              <div className="sidebar-empty">No tables found</div>
            )}
          </div>
          <Button className="sidebar-add" onClick={addTable}>
            <Plus size={15} /> Add table
          </Button>
        </aside>
        <div
          ref={canvasRef}
          className="canvas-wrap"
          onWheel={onCanvasWheel}
          onPointerDown={onCanvasDown}
        >
          <div
            className="canvas"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              width: 2400,
              height: 1800,
            }}
          >
            <svg className="edges" width="2400" height="1800">
              {relationships.map((relationship) => {
                const from = point(relationship.from, relationship.fromIndex);
                const to = point(relationship.to, relationship.toIndex);
                const right = relationship.to.x >= relationship.from.x;
                const x1 = right ? from.x : relationship.from.x;
                const x2 = right ? relationship.to.x : to.x;
                const dx = Math.max(50, Math.abs(x2 - x1) / 2);
                return (
                  <g key={relationship.id}>
                    <path
                      d={`M ${x1} ${from.y} C ${x1 + (right ? dx : -dx)} ${from.y}, ${x2 - (right ? dx : -dx)} ${to.y}, ${x2} ${to.y}`}
                      fill="none"
                      stroke={
                        selectedId === relationship.from.id ||
                        selectedId === relationship.to.id
                          ? "var(--primary)"
                          : "var(--border)"
                      }
                      strokeWidth="1.8"
                    />
                    <circle cx={x1} cy={from.y} r="3" fill="var(--accent)" />
                    <circle cx={x2} cy={to.y} r="3" fill="var(--primary)" />
                  </g>
                );
              })}
            </svg>
            {schema.tables.map((table) => (
              <div
                className={`table-card ${selectedId === table.id ? "selected" : ""}`}
                key={table.id}
                style={{ left: table.x, top: table.y }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedId(table.id);
                }}
              >
                <div
                  className="table-head"
                  style={{
                    background: `linear-gradient(135deg,${table.color.a},${table.color.b})`,
                  }}
                  onPointerDown={(event) => onHeaderDown(event, table)}
                >
                  <span className="table-name">{table.name.toUpperCase()}</span>
                  <Badge variant="outline" className="table-strategy">
                    {table.keyStrategy === "sequence-trigger"
                      ? "SEQ + TRG"
                      : table.keyStrategy}
                  </Badge>
                </div>
                {table.columns.map((column) => (
                  <div className="table-row" key={column.id}>
                    <span className="row-icon">
                      {column.pk ? (
                        <KeyRound size={13} />
                      ) : column.fk ? (
                        <Link2 size={13} className="fk-dot" />
                      ) : (
                        <span />
                      )}
                    </span>
                    <span className="row-name">
                      {column.name.toUpperCase()}
                    </span>
                    <span className="row-type">
                      {column.type}
                      {column.size ? `(${column.size})` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="canvas-hud">
          <Button
            className="btn"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.45, value - 0.1))}
          >
            <ZoomOut size={14} />
          </Button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <Button
            className="btn"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}
          >
            <ZoomIn size={14} />
          </Button>
          <Button className="btn" onClick={fitView}>
            Fit
          </Button>
          <Button className="btn" onClick={autoLayout}>
            <LayoutGrid size={14} /> Tidy up
          </Button>
        </div>
        {selected && (
          <div className="drawer">
            <div className="drawer-head">
              <div className="drawer-title">
                <Database size={16} color="var(--primary)" />
                <input
                  aria-label="Table name"
                  value={selected.name}
                  onChange={(event) =>
                    patchTable(selected.id, { name: event.target.value })
                  }
                />
                <span className="muted">{selected.columns.length} columns</span>
              </div>
              <div className="drawer-actions">
                <Button
                  className="btn ghost danger"
                  aria-label={`Delete table ${selected.name}`}
                  onClick={() => deleteTable(selected.id)}
                >
                  <Trash2 size={16} />
                </Button>
                <Button
                  className="btn ghost"
                  aria-label="Close table editor"
                  onClick={() => setSelectedId(null)}
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
            <Separator className="drawer-separator" />
            <div className="drawer-content">
              <div className="drawer-toolbar">
                <span className="field-label">Key generation</span>
                <div className="strategy">
                  <select
                    aria-label="Key generation strategy"
                    className="select"
                    value={selected.keyStrategy}
                    onChange={(event) =>
                      patchTable(selected.id, {
                        keyStrategy: event.target.value as KeyStrategy,
                      })
                    }
                  >
                    <option value="sequence-trigger">Sequence + trigger</option>
                    <option value="identity">Generated identity</option>
                    <option value="none">Manual / none</option>
                  </select>
                  {primaryKeyColumns(selected).length > 1 && (
                    <span className="muted">
                      Composite PK: manual generation required
                    </span>
                  )}
                </div>
                <Button className="btn" onClick={makeJunction}>
                  <Link2 size={14} /> Junction
                </Button>
                <Button className="btn" onClick={() => addColumn(selected.id)}>
                  <Plus size={14} /> Add column
                </Button>
              </div>
              <div className="column-grid header">
                <span>Column</span>
                <span>Type</span>
                <span>Flags</span>
                <span>Default / check</span>
                <span>Foreign key</span>
                <span />
              </div>
              {selected.columns.map((column) => (
                <div className="column-grid" key={column.id}>
                  <div className="cell">
                    <Input
                      className="input"
                      value={column.name}
                      onChange={(event) =>
                        patchColumn(selected.id, column.id, {
                          name: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="cell">
                    <select
                      aria-label={`Datatype for ${column.name}`}
                      className="select"
                      value={column.type}
                      onChange={(event) =>
                        patchColumn(selected.id, column.id, {
                          type: event.target.value as Column["type"],
                        })
                      }
                    >
                      {ORACLE_TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    {typeUsesSize(column.type) && (
                      <Input
                        className="input"
                        style={{ marginTop: 5 }}
                        placeholder={typeSizePlaceholder(column.type)}
                        value={column.size}
                        onChange={(event) =>
                          patchColumn(selected.id, column.id, {
                            size: event.target.value,
                          })
                        }
                      />
                    )}
                  </div>
                  <div className="checks">
                    <label>
                      <Checkbox
                        isSelected={column.pk}
                        onChange={(isSelected) =>
                          patchColumn(selected.id, column.id, {
                            pk: isSelected,
                            fk: isSelected ? null : column.fk,
                          })
                        }
                      />
                      PK
                    </label>
                    <label>
                      <Checkbox
                        isSelected={column.notNull}
                        onChange={(isSelected) =>
                          patchColumn(selected.id, column.id, {
                            notNull: isSelected,
                          })
                        }
                      />
                      NN
                    </label>
                    <label>
                      <Checkbox
                        isSelected={column.unique}
                        onChange={(isSelected) =>
                          patchColumn(selected.id, column.id, {
                            unique: isSelected,
                          })
                        }
                      />
                      UQ
                    </label>
                  </div>
                  <div className="cell">
                    <Input
                      className="input"
                      placeholder="DEFAULT expression"
                      value={column.defaultValue}
                      onChange={(event) =>
                        patchColumn(selected.id, column.id, {
                          defaultValue: event.target.value,
                        })
                      }
                    />
                    <Input
                      className="input"
                      style={{ marginTop: 5 }}
                      placeholder="CHECK expression"
                      value={column.check}
                      onChange={(event) =>
                        patchColumn(selected.id, column.id, {
                          check: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="cell">
                    {!column.pk && (
                      <select
                        aria-label={`Foreign key for ${column.name}`}
                        className="select"
                        value={
                          column.fk
                            ? `${column.fk.tableId}::${column.fk.columnId}`
                            : ""
                        }
                        onChange={(event) => {
                          const [tableId, columnId] =
                            event.target.value.split("::");
                          patchColumn(selected.id, column.id, {
                            fk:
                              tableId && columnId
                                ? { tableId, columnId }
                                : null,
                          });
                        }}
                      >
                        <option value="">No reference</option>
                        {compatibleForeignKeyTargets(column).map(
                          ({ table, target }) => (
                            <option
                              key={`${table.id}::${target.id}`}
                              value={`${table.id}::${target.id}`}
                            >
                              {table.name.toUpperCase()}.
                              {target.name.toUpperCase()}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </div>
                  <Button
                    className="btn ghost danger"
                    aria-label={`Delete column ${column.name}`}
                    onClick={() => deleteColumn(selected.id, column.id)}
                  >
                    <X size={15} />
                  </Button>
                </div>
              ))}
            </div>
            {issues
              .filter((issue) => issue.tableId === selected.id)
              .slice(0, 2)
              .map((issue) => (
                <div className="issue-strip" key={issue.message}>
                  <ChevronDown size={14} />
                  {issue.message}
                </div>
              ))}
          </div>
        )}
      </section>
      {modal === "export" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div className="tabs">
                {(
                  [
                    ["ddl", "DDL"],
                    ["plsql", "PL/SQL Packages"],
                    ["combined", "Combined"],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    className={`tab ${exportTab === key ? "active" : ""}`}
                    key={key}
                    onClick={() => setExportTab(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="toolbar">
                <Button
                  className="btn ghost"
                  aria-label="Copy export"
                  onClick={copyOutput}
                >
                  {copied ? (
                    <Check size={15} color="var(--chart-3)" />
                  ) : (
                    <Copy size={15} />
                  )}
                </Button>
                <Button
                  className="btn ghost"
                  aria-label="Download export"
                  onClick={download}
                >
                  <Download size={15} />
                </Button>
                <Button
                  className="btn ghost"
                  aria-label="Close dialog"
                  onClick={() => setModal(null)}
                >
                  <X size={15} />
                </Button>
              </div>
            </div>
            {errors.length > 0 && (
              <div className="issue-strip danger">
                <X size={14} />
                Export blocked: {errors[0].message} ({errors.length} error(s))
                <Button className="btn" onClick={clearInvalidForeignKeys}>
                  Clear invalid references
                </Button>
              </div>
            )}
            <pre className="code">{output}</pre>
          </div>
        </div>
      )}
      {modal === "import" && (
        <div className="modal-backdrop" onMouseDown={() => setModal(null)}>
          <div
            className="modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <strong>Import Oracle DDL</strong>
                <div className="brand-sub">
                  Supported CREATE TABLE subset · all-or-nothing
                </div>
              </div>
              <Button
                className="btn ghost"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={15} />
              </Button>
            </div>
            <div className="import-area">
              <Textarea
                aria-label="Oracle DDL input"
                className="textarea"
                placeholder="CREATE TABLE STUDENT ( ID NUMBER NOT NULL, NAME VARCHAR2(100), CONSTRAINT PK_STUDENT PRIMARY KEY (ID) );"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
              />
              {importMessage && (
                <div
                  className={`parse-result ${importMessage.ok ? "" : "parse-error"}`}
                >
                  {importMessage.text}
                </div>
              )}
              <div className="toolbar">
                <Button className="btn" onClick={() => setImportText(ddl)}>
                  Use current export
                </Button>
                <Button className="btn primary" onClick={importSchema}>
                  <FileUp size={15} /> Parse and replace
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
