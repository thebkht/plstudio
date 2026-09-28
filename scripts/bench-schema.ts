/**
 * Synthetic diagram for profiling, and timings for the pure passes over it.
 *
 *   pnpm tsx scripts/bench-schema.ts [tables=200]
 *
 * Writes `<DATA_DIR>/bench-<n>.json`, which the Import dialog's JSON tab takes
 * as-is, so the same diagram can be profiled in the browser (React Profiler /
 * Performance panel) while dragging and typing. Then times the passes that run
 * on every commit -- validation, DDL, DML -- and the whole-diagram edge router,
 * and prints median/p95 over 50 runs. Deterministic: ids and placement come
 * from the index, never the clock, so two runs are comparable.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DATA_DIR } from "@/db/paths";
import { generateDDL, generateDML } from "@/app/lib/generators";
import { exportSchemaJson } from "@/app/lib/schema-json";
import { validateSchema } from "@/app/lib/validation";
import { HEADER_HEIGHT, ROW_HEIGHT } from "@/app/components/designer/constants";
import { routeEdges, type EdgeInput } from "@/app/components/designer/edge-routing";
import {
  makeColumn,
  makeMemo,
  makeSchemaGroup,
  makeTable,
  normalizeRelationships,
  SCHEMA_FORMAT_VERSION,
  tableHeight,
  tableWidth,
  type Column,
  type Schema,
  type Table,
} from "@/app/lib/schema";

const count = Number(process.argv[2] ?? 200);
const RUNS = 50;
const PER_ROW = 12;

const pad = (value: number) => String(value).padStart(3, "0");

function buildSchema(n: number): Schema {
  const tables: Table[] = Array.from({ length: n }, (_, index) => {
    const table = makeTable(`T${pad(index)}_ENTITY`, 80 + (index % PER_ROW) * 360, 80 + Math.floor(index / PER_ROW) * 520, index);
    table.id = `tbl_${pad(index)}`;
    table.columns[0].id = `col_${pad(index)}_id`;
    table.schemaId = `group_${Math.floor(index / 40)}`;
    return table;
  });
  tables.forEach((table, index) => {
    // Three keys back to earlier tables: dense enough to exercise the router.
    const fks: Column[] = [1, 5, 13]
      .filter((offset) => index - offset >= 0)
      .map((offset) => {
        const target = tables[index - offset];
        return makeColumn({ id: `col_${pad(index)}_fk${offset}`, name: `${target.name}_ID`, type: "NUMBER", size: "", notNull: true, fk: { tableId: target.id, columnId: target.columns[0].id } });
      });
    const plain = Array.from({ length: 5 }, (_, column) =>
      makeColumn({ id: `col_${pad(index)}_c${column}`, name: `ATTRIBUTE_${column}`, size: "100", check: column === 0 ? `ATTRIBUTE_0 IN ('A', 'B')` : "" }),
    );
    table.columns.push(...fks, ...plain);
  });
  const groups = Array.from({ length: Math.ceil(n / 40) }, (_, index) => ({ ...makeSchemaGroup(`Module ${index}`, 40, 40 + index * 1600, index), id: `group_${index}`, keyword: `M${index}` }));
  const memos = Array.from({ length: 10 }, (_, index) => ({ ...makeMemo(`Note ${index}`, -400, 80 + index * 220), id: `memo_${index}` }));
  return normalizeRelationships({ id: "schema_bench", name: `Bench ${n}`, revision: 1, schemaFormatVersion: SCHEMA_FORMAT_VERSION, tables, groups, relationships: [], memos });
}

/** Right flank to left flank at the key's row: what the canvas does for most edges. */
function edgeInputs(schema: Schema): EdgeInput[] {
  const byId = new Map(schema.tables.map((table) => [table.id, table]));
  return (schema.relationships ?? []).flatMap((relationship) => {
    const from = byId.get(relationship.startTableId);
    const to = byId.get(relationship.endTableId);
    if (!from || !to) return [];
    const row = (table: Table, columnId: string) => Math.max(0, table.columns.findIndex((column) => column.id === columnId));
    const fromRight = from.x < to.x;
    return [{
      id: relationship.id,
      from: { x: fromRight ? from.x + tableWidth(from) : from.x, y: from.y + HEADER_HEIGHT + (row(from, relationship.startFieldId) + 0.5) * ROW_HEIGHT, direction: fromRight ? 1 : -1, tableId: from.id },
      to: { x: fromRight ? to.x : to.x + tableWidth(to), y: to.y + HEADER_HEIGHT + (row(to, relationship.endFieldId) + 0.5) * ROW_HEIGHT, direction: fromRight ? -1 : 1, tableId: to.id },
    }];
  });
}

function time(label: string, fn: () => unknown) {
  fn();
  const samples = Array.from({ length: RUNS }, () => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  const at = (q: number) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))].toFixed(2);
  console.log(`${label.padEnd(16)} median ${at(0.5).padStart(8)}ms   p95 ${at(0.95).padStart(8)}ms`);
}

async function main() {
  const schema = buildSchema(count);
  const file = path.join(DATA_DIR, `bench-${count}.json`);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, exportSchemaJson(schema));
  console.log(`${schema.tables.length} tables, ${schema.relationships?.length ?? 0} relationships -> ${file}\n`);
  const edges = edgeInputs(schema);
  const obstacles = schema.tables.map((table) => ({ id: table.id, x: table.x, y: table.y, width: tableWidth(table), height: tableHeight(table) }));
  time("validateSchema", () => validateSchema(schema));
  time("generateDDL", () => generateDDL(schema));
  time("generateDML", () => generateDML(schema));
  time("routeEdges", () => routeEdges(edges, obstacles));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
