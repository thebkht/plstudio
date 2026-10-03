import {
  currentTableColor,
  GROUP_PALETTE,
  tableHeight,
  tableWidth,
  type Schema,
} from "@/app/lib/schema";
import { MEMO_COLORS } from "@/app/components/designer/constants";

/**
 * The canvas reduced to a card-sized map, drawn the way the editor's minimap
 * draws it: every table a solid block in its own colour, groups and memos as
 * faint regions underneath, and no wiring -- at this scale a line is a hair
 * and a column row is well under a pixel, so what survives is the shape of the
 * diagram, which is what makes one recognisable against another.
 *
 * Pure arithmetic over `Schema`, so it lives beside the other projections
 * (validation, generators) and is testable without mounting anything.
 */

/** The frame every preview is fitted into. 8:5, matching the card's crop. */
export const PREVIEW_WIDTH = 320;
export const PREVIEW_HEIGHT = 200;
/** Breathing room between the content's bounding box and the frame edge. */
const PREVIEW_PADDING = 16;
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
const MAX_REGIONS = 30;

export type PreviewTable = { x: number; y: number; w: number; h: number; color: string };
export type PreviewRegion = PreviewTable & { kind: "group" | "memo" };
export type PreviewGeometry = {
  width: number;
  height: number;
  /** Groups and memos, drawn first and faint, as the minimap draws them. */
  regions: PreviewRegion[];
  tables: PreviewTable[];
};

/**
 * `null` when there is nothing to draw — the caller's signal to render an empty
 * state rather than an empty frame. Tables are what make a diagram: a group or
 * a memo on its own is still "nothing drawn yet".
 */
export function schemaPreview(schema: Schema): PreviewGeometry | null {
  const tables = (schema.tables ?? []).slice(0, MAX_TABLES);
  if (!tables.length) return null;

  const boxes = tables.map((table) => ({ x: table.x, y: table.y, w: tableWidth(table), h: tableHeight(table), color: currentTableColor(table.color)?.a ?? "#a1a1aa" }));
  /* Stored JSON is not trusted to be well-formed: bound the work before
     mapping, and drop any box whose geometry is not a finite number rather
     than letting one NaN collapse the whole frame. */
  const finite = (box: { x: number; y: number; w: number; h: number }) => [box.x, box.y, box.w, box.h].every(Number.isFinite);
  const regions = [
    ...(schema.groups ?? []).slice(0, MAX_REGIONS).map((group) => ({ x: group.x, y: group.y, w: group.width, h: group.height, color: GROUP_PALETTE[group.color]?.border ?? GROUP_PALETTE.blue.border, kind: "group" as const })),
    ...(schema.memos ?? []).slice(0, MAX_REGIONS).map((memo) => ({ x: memo.x, y: memo.y, w: memo.width, h: memo.height, color: (MEMO_COLORS.find((color) => color.id === memo.color) ?? MEMO_COLORS[0]).border, kind: "memo" as const })),
  ].filter(finite).slice(0, MAX_REGIONS);
  const all = [...boxes.filter(finite), ...regions];
  if (!all.length) return null;
  const minX = Math.min(...all.map((box) => box.x));
  const minY = Math.min(...all.map((box) => box.y));
  const maxX = Math.max(...all.map((box) => box.x + box.w));
  const maxY = Math.max(...all.map((box) => box.y + box.h));

  const frameW = PREVIEW_WIDTH - PREVIEW_PADDING * 2;
  const frameH = PREVIEW_HEIGHT - PREVIEW_PADDING * 2;
  /* A single table has zero extent in one axis often enough to guard the divide. */
  const scale = Math.min(MAX_SCALE, frameW / Math.max(maxX - minX, 1), frameH / Math.max(maxY - minY, 1));
  /* Centre the scaled content rather than pinning it to the padding corner, so
     a small schema sits in the middle of the card instead of the top-left. */
  const offsetX = (PREVIEW_WIDTH - (maxX - minX) * scale) / 2;
  const offsetY = (PREVIEW_HEIGHT - (maxY - minY) * scale) / 2;
  const place = <T extends PreviewTable>(box: T): T => ({ ...box, x: (box.x - minX) * scale + offsetX, y: (box.y - minY) * scale + offsetY, w: box.w * scale, h: box.h * scale });

  return { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, regions: regions.map(place), tables: boxes.filter(finite).map(place) };
}
