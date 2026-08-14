import {
  TABLE_COLOR_STRIP_HEIGHT,
  TABLE_FIELD_HEIGHT,
  TABLE_HEADER_HEIGHT,
  tableHeight,
  tableWidth,
  type Schema,
  type Table,
} from "@/app/lib/schema";

/**
 * The canvas reduced to a card-sized silhouette: table blocks at their true
 * relative positions, plus the lines between them. Text is deliberately absent
 * — at this scale a column row is well under a pixel and reads as grey noise,
 * so what survives is shape and topology, which is what makes one diagram
 * recognisable against another.
 *
 * Pure arithmetic over `Schema`, so it lives beside the other projections
 * (validation, generators) and is testable without mounting anything.
 */

/** The frame every preview is fitted into. 8:5, matching the card's crop. */
export const PREVIEW_WIDTH = 320;
export const PREVIEW_HEIGHT = 200;
/** Breathing room between the content's bounding box and the frame edge. */
const PREVIEW_PADDING = 14;
/**
 * Zoom ceiling. Without it a lone table would be scaled up until it filled the
 * frame, which reads as a big empty box rather than a small sparse schema.
 */
const MAX_SCALE = 0.35;

/**
 * Density ceilings. Past these the marks are sub-pixel and add bytes to every
 * card on the dashboard without adding anything to look at.
 */
const MAX_TABLES = 60;
const MAX_EDGES = 80;

export type PreviewTable = { x: number; y: number; w: number; h: number; color: string };
export type PreviewEdge = { x1: number; y1: number; x2: number; y2: number };
export type PreviewGeometry = {
  width: number;
  height: number;
  tables: PreviewTable[];
  edges: PreviewEdge[];
};

/** Vertical centre of a column's row on the card, in canvas coordinates. */
const rowCenter = (table: Table, index: number) =>
  table.y + TABLE_COLOR_STRIP_HEIGHT + TABLE_HEADER_HEIGHT + index * TABLE_FIELD_HEIGHT + TABLE_FIELD_HEIGHT / 2;

/**
 * `null` when there is nothing to draw — the caller's signal to render an empty
 * state rather than an empty frame.
 */
export function schemaPreview(schema: Schema): PreviewGeometry | null {
  const tables = (schema.tables ?? []).slice(0, MAX_TABLES);
  if (!tables.length) return null;

  const boxes = tables.map((table) => ({ table, w: tableWidth(table), h: tableHeight(table) }));
  const minX = Math.min(...boxes.map(({ table }) => table.x));
  const minY = Math.min(...boxes.map(({ table }) => table.y));
  const maxX = Math.max(...boxes.map(({ table, w }) => table.x + w));
  const maxY = Math.max(...boxes.map(({ table, h }) => table.y + h));

  const frameW = PREVIEW_WIDTH - PREVIEW_PADDING * 2;
  const frameH = PREVIEW_HEIGHT - PREVIEW_PADDING * 2;
  /* A single table has zero extent in one axis often enough to guard the divide. */
  const scale = Math.min(MAX_SCALE, frameW / Math.max(maxX - minX, 1), frameH / Math.max(maxY - minY, 1));
  /* Centre the scaled content rather than pinning it to the padding corner, so
     a small schema sits in the middle of the card instead of the top-left. */
  const offsetX = (PREVIEW_WIDTH - (maxX - minX) * scale) / 2;
  const offsetY = (PREVIEW_HEIGHT - (maxY - minY) * scale) / 2;
  const toX = (x: number) => (x - minX) * scale + offsetX;
  const toY = (y: number) => (y - minY) * scale + offsetY;

  const placed = boxes.map(({ table, w, h }) => ({
    x: toX(table.x),
    y: toY(table.y),
    w: w * scale,
    h: h * scale,
    color: table.color?.a ?? "#a1a1aa",
  }));

  const byId = new Map(tables.map((table) => [table.id, table]));
  const edges: PreviewEdge[] = [];
  for (const relationship of schema.relationships ?? []) {
    if (edges.length >= MAX_EDGES) break;
    const from = byId.get(relationship.startTableId);
    const to = byId.get(relationship.endTableId);
    /* A relationship can outlive the table or column it points at; the canvas
       drops those and so does the preview, rather than throwing on a card. */
    if (!from || !to || from === to) continue;
    const fromIndex = from.columns.findIndex((column) => column.id === relationship.startFieldId);
    const toIndex = to.columns.findIndex((column) => column.id === relationship.endFieldId);
    if (fromIndex < 0 || toIndex < 0) continue;

    const fromW = tableWidth(from);
    const toW = tableWidth(to);
    /* Leave from whichever flank faces the other card. The designer's 30px
       hysteresis exists to stop the anchor flipping mid-drag; nothing is
       dragging here, so the plain comparison is the whole rule. */
    const fromRight = from.x + fromW / 2 <= to.x + toW / 2;
    edges.push({
      x1: toX(from.x + (fromRight ? fromW : 0)),
      y1: toY(rowCenter(from, fromIndex)),
      x2: toX(to.x + (fromRight ? 0 : toW)),
      y2: toY(rowCenter(to, toIndex)),
    });
  }

  return { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, tables: placed, edges };
}
