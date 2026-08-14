import {
  cloneSchema,
  normalizeMemos,
  normalizeGroups,
  normalizeRelationships,
  normalizeTables,
  tableHeight,
  tableWidth,
  type Relationship,
  type Schema,
  type Table,
} from "@/app/lib/schema";
import {
  GROUP_HEADER_HEIGHT,
  RESIZE_STEP,
  RESIZE_STEP_COARSE,
  WHEEL_LINE_HEIGHT,
  WHEEL_PAGE_HEIGHT,
} from "./constants";

/** Pixels per unit of a wheel event's delta, whichever unit the device reports. */
export const wheelScale = (event: WheelEvent) =>
  event.deltaMode === 1
    ? WHEEL_LINE_HEIGHT
    : event.deltaMode === 2
      ? WHEEL_PAGE_HEIGHT
      : 1;

/** Arrow-key deltas for the resize handles, which are otherwise pointer-only. */
export const resizeDelta = (event: React.KeyboardEvent) => {
  const step = event.shiftKey ? RESIZE_STEP_COARSE : RESIZE_STEP;
  const deltas: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  };
  return deltas[event.key] ?? null;
};

/**
 * Whether a dropped card's centre lands inside a group. The header strip is
 * excluded: that band is how the group itself is grabbed, so a card resting
 * over it belongs to the canvas, not to the group.
 */
export const enclosedBy = (
  rect: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
) =>
  x >= rect.x &&
  x <= rect.x + rect.width &&
  y >= rect.y + GROUP_HEADER_HEIGHT &&
  y <= rect.y + rect.height;

/**
 * `MLL` out of `MLL -- MULTI LANGUAGE TOOLS`. Only a short leading token that
 * is actually set off by a separator counts, so `Schema 1` suggests nothing
 * rather than suggesting `SCHEMA`. A placeholder only — never written.
 */
export const keywordHint = (name: string) =>
  name
    .trim()
    .match(/^([A-Za-z0-9]{1,8})\s*(?:--|[-–—:_])/)?.[1]
    .toUpperCase() ?? "KEY";

/**
 * Where the `index`-th card of a group lands: stacked down from the corner
 * below the header, kept clear of the borders, and centred instead when the
 * card is too wide or tall to sit inside with margins. Centring is the part
 * that matters — `enclosedBy` tests the card's *centre*, so a card placed
 * anywhere else would be evicted from the group by the next resize.
 */
export const insideGroup = (
  rect: { x: number; y: number; width: number; height: number },
  table: Table,
  index: number,
) => {
  const place = (start: number, span: number, size: number, offset: number) => {
    const low = start + 12;
    const high = start + span - size - 12;
    return Math.round(
      high < low
        ? start + (span - size) / 2
        : Math.max(low, Math.min(high, low + offset)),
    );
  };
  return {
    x: place(rect.x, rect.width, tableWidth(table), 12 + (index % 3) * 40),
    y: place(
      rect.y + GROUP_HEADER_HEIGHT,
      rect.height - GROUP_HEADER_HEIGHT,
      tableHeight(table),
      6 + (index % 4) * 40,
    ),
  };
};

export function repairInitialLayout(schema: Schema): Schema {
  const next = cloneSchema(schema);
  const gap = 24;
  const overlaps = (table: Table, x: number, y: number) =>
    next.tables.some((other) => {
      if (other.id === table.id) return false;
      const width = tableWidth(table);
      const otherWidth = tableWidth(other);
      return (
        x < other.x + otherWidth + gap &&
        x + width + gap > other.x &&
        y < other.y + tableHeight(other) + gap &&
        y + tableHeight(table) + gap > other.y
      );
    });
  next.tables.forEach((table, index) => {
    if (index === 0 || !overlaps(table, table.x, table.y)) return;
    const startX = table.x;
    const startY = table.y;
    for (let ring = 1; ring <= 24; ring += 1) {
      const step = 48 * ring;
      const candidates = [
        { x: startX + step, y: startY },
        { x: startX - step, y: startY },
        { x: startX, y: startY + step },
        { x: startX, y: startY - step },
        { x: startX + step, y: startY + step },
        { x: startX - step, y: startY + step },
        { x: startX + step, y: startY - step },
        { x: startX - step, y: startY - step },
      ];
      // Every ring is legal, negatives included: there is no edge to fall off.
      const free = candidates.find(
        (candidate) => !overlaps(table, candidate.x, candidate.y),
      );
      if (free) {
        table.x = free.x;
        table.y = free.y;
        break;
      }
    }
  });
  return next;
}

export function prepareCanvasSchema(schema: Schema): Schema {
  const next = repairInitialLayout(
    normalizeTables(normalizeGroups(normalizeRelationships(schema))),
  );
  next.memos = normalizeMemos(next.memos);
  return next;
}

/**
 * The pair of markers drawn at each end of an edge, and the pair the side panel
 * joins with a colon. Shared so the two can never disagree.
 */
export const relationshipCardinalities = (relationship: Relationship) => {
  if (relationship.cardinality === "one_to_one") return ["1", "1"];
  if (relationship.cardinality === "one_to_many")
    return ["1", relationship.manyLabel || "n"];
  return [relationship.manyLabel || "n", "1"];
};
