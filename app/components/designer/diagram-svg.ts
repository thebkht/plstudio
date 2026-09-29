import {
  GROUP_PALETTE,
  normalizeRelationships,
  TABLE_COLOR_STRIP_HEIGHT,
  TABLE_HEADER_HEIGHT,
  tableHeight,
  tableWidth,
  typeString,
  uniqueGroupColumnIds,
  type MemoColor,
  type Schema,
  type Table,
} from "@/app/lib/schema";
import { HEADER_HEIGHT, MARKER_DISTANCE, ROW_HEIGHT } from "./constants";
import { edgePath, facingSide, idealBend, routeEdges, type EdgeInput } from "./edge-routing";
import { relationshipCardinalities } from "./geometry";

/**
 * The diagram as a standalone SVG document, drawn from the domain model rather
 * than screenshotted from the DOM: the canvas is transformed, culled with
 * `content-visibility` and themed through custom properties, none of which
 * survives serialization. Geometry is the canvas's own -- the same card
 * constants, the same router and the same edge path -- so the picture matches
 * what is on screen. Pure and deterministic; `svgToPng` rasterizes it.
 */
export type DiagramTheme = "light" | "dark";

const THEMES = {
  light: { background: "#ffffff", card: "#ffffff", border: "#d6d3d1", text: "#1c1917", muted: "#78716c", rule: "#f0eeec", edge: "#8a8580", badge: "#f5f5f4", key: "#b45309" },
  dark: { background: "#1c1917", card: "#292524", border: "#44403c", text: "#fafaf9", muted: "#a8a29e", rule: "#35302d", edge: "#8a8580", badge: "#3a3431", key: "#f59e0b" },
} as const;

const FONT = `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const PADDING = 48;
/** Rough advance of a 13px sans glyph -- enough to keep text inside its card. */
const CHAR_WIDTH = 7.4;

export const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);

const fit = (text: string, width: number, charWidth = CHAR_WIDTH) => {
  const max = Math.max(1, Math.floor(width / charWidth));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/**
 * Greedy word wrap to `width`, the way the memo's textarea wraps on screen.
 * A word longer than a whole line is broken across lines rather than lost.
 */
const wrap = (text: string, width: number, charWidth = CHAR_WIDTH) => {
  const max = Math.max(1, Math.floor(width / charWidth));
  return text.split("\n").flatMap((paragraph) =>
    paragraph.split(/\s+/).filter(Boolean).reduce<string[]>((lines, word) => {
      const pieces = word.match(new RegExp(`.{1,${max}}`, "g")) ?? [word];
      pieces.forEach((piece) => {
        const last = lines[lines.length - 1];
        if (last !== undefined && last.length + 1 + piece.length <= max) lines[lines.length - 1] = `${last} ${piece}`;
        else lines.push(piece);
      });
      return lines;
    }, []).concat(paragraph.trim() ? [] : [""]),
  );
};

/**
 * The memo tokens of globals.css as literals. The canvas resolves `var(--memo-…)`
 * against the page's stylesheet; an exported file has none, and an unresolvable
 * `fill` paints black.
 */
const MEMO_SWATCHES: Record<MemoColor, { surface: string; edge: string }> = {
  yellow: { surface: "#f4efdc", edge: "#a88d19" },
  green: { surface: "#e3f4e6", edge: "#4ea464" },
  blue: { surface: "#e0f1fe", edge: "#3598d4" },
  pink: { surface: "#fee8ef", edge: "#ca6c93" },
};
const MEMO_INK = "#322c28";
const MEMO_LINE = 18;

const round = (value: number) => Math.round(value * 100) / 100;

type Box = { x: number; y: number; width: number; height: number };

export function renderDiagramSVG(schema: Schema, { theme = "light" }: { theme?: DiagramTheme } = {}) {
  const colors = THEMES[theme];
  const canonical = schema.relationships?.length ? schema : normalizeRelationships(schema);
  const tablesById = new Map(canonical.tables.map((table) => [table.id, table]));
  const boxOf = (table: Table): Box => ({ x: table.x, y: table.y, width: tableWidth(table), height: tableHeight(table) });

  const edges = (canonical.relationships ?? []).flatMap((relationship) => {
    const from = tablesById.get(relationship.startTableId);
    const to = tablesById.get(relationship.endTableId);
    const pair = relationship.fields[0] ?? { startFieldId: relationship.startFieldId, endFieldId: relationship.endFieldId };
    const fromIndex = from?.columns.findIndex((column) => column.id === pair.startFieldId) ?? -1;
    const toIndex = to?.columns.findIndex((column) => column.id === pair.endFieldId) ?? -1;
    if (!from || !to || fromIndex < 0 || toIndex < 0) return [];
    const end = (table: Table, index: number, other: Table) => {
      const box = boxOf(table);
      const direction = facingSide(box.x, box.width, other.x, tableWidth(other));
      return { x: box.x + (direction === 1 ? box.width : 0), y: box.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2, direction, tableId: table.id };
    };
    return [{ id: relationship.id, relationship, from: end(from, fromIndex, to), to: end(to, toIndex, from) }];
  });
  const routes = routeEdges(
    edges.map(({ id, from, to }): EdgeInput => ({ id, from, to })),
    canonical.tables.map((table) => ({ id: table.id, ...boxOf(table) })),
  );
  const bends = new Map(edges.map((edge) => [edge.id, routes.get(edge.id) ?? idealBend(edge.from, edge.to)]));

  const boxes: Box[] = [
    ...canonical.tables.map(boxOf),
    ...(canonical.groups ?? []),
    ...(canonical.memos ?? []),
    // Markers sit outside the cards and trunks can run past them.
    ...edges.flatMap((edge) => [edge.from, edge.to].map((end) => ({ x: end.x + end.direction * MARKER_DISTANCE - 16, y: end.y - 14, width: 32, height: 28 }))),
    ...edges.map((edge) => ({ x: bends.get(edge.id)! - 1, y: Math.min(edge.from.y, edge.to.y), width: 2, height: Math.abs(edge.to.y - edge.from.y) })),
  ];
  const minX = boxes.length ? Math.min(...boxes.map((box) => box.x)) - PADDING : 0;
  const minY = boxes.length ? Math.min(...boxes.map((box) => box.y)) - PADDING : 0;
  const width = boxes.length ? Math.max(...boxes.map((box) => box.x + box.width)) + PADDING - minX : PADDING * 2;
  const height = boxes.length ? Math.max(...boxes.map((box) => box.y + box.height)) + PADDING - minY : PADDING * 2;

  const groups = (canonical.groups ?? []).map((group) => {
    const palette = GROUP_PALETTE[group.color];
    const fill = theme === "dark" ? `${palette.border}26` : palette.background;
    return [
      `<g>`,
      `<rect x="${group.x}" y="${group.y}" width="${group.width}" height="${group.height}" rx="14" fill="${fill}" stroke="${palette.border}" stroke-width="1.5"/>`,
      `<text x="${group.x + 16}" y="${group.y + 26}" font-size="13" font-weight="600" fill="${theme === "dark" ? palette.border : palette.text}">${escapeXml(fit([group.keyword, group.name].filter(Boolean).join(" · "), group.width - 32))}</text>`,
      `</g>`,
    ].join("");
  });

  const memos = (canonical.memos ?? []).map((memo) => {
    const swatch = MEMO_SWATCHES[memo.color] ?? MEMO_SWATCHES.yellow;
    const room = Math.max(1, Math.floor((memo.height - 40) / MEMO_LINE));
    const all = wrap(memo.text, memo.width - 28);
    // Cut where the card ends, and say so on the last line that fits.
    const lines = all.length > room ? [...all.slice(0, room - 1), fit(`${all[room - 1]}…`, memo.width - 28)] : all;
    return [
      `<g>`,
      `<rect x="${memo.x}" y="${memo.y}" width="${memo.width}" height="${memo.height}" rx="10" fill="${theme === "dark" ? `${swatch.edge}26` : swatch.surface}" stroke="${swatch.edge}"/>`,
      `<text x="${memo.x + 14}" y="${memo.y + 34}" font-size="13" fill="${theme === "dark" ? colors.text : MEMO_INK}">`,
      ...lines.map((line, index) => `<tspan x="${memo.x + 14}" dy="${index ? MEMO_LINE : 0}">${escapeXml(line)}</tspan>`),
      `</text>`,
      `</g>`,
    ].join("");
  });

  const markers = (x: number, y: number, label: string) =>
    `<rect x="${round(x - 14)}" y="${round(y - 12)}" width="28" height="24" rx="12" fill="${colors.card}" stroke="${colors.edge}"/>` +
    `<text x="${round(x)}" y="${round(y)}" font-size="11" text-anchor="middle" dominant-baseline="central" fill="${colors.text}">${escapeXml(label)}</text>`;
  const lines = edges.map((edge) => {
    const [fromCardinality, toCardinality] = relationshipCardinalities(edge.relationship);
    const bend = bends.get(edge.id)!;
    return [
      `<g>`,
      `<path d="${edgePath(edge.from, edge.to, round(bend))}" fill="none" stroke="${colors.edge}" stroke-width="1.5"/>`,
      markers(edge.from.x + edge.from.direction * MARKER_DISTANCE, edge.from.y, fromCardinality),
      markers(edge.to.x + edge.to.direction * MARKER_DISTANCE, edge.to.y, toCardinality),
      `</g>`,
    ].join("");
  });

  const cards = canonical.tables.map((table, index) => {
    const { x, y, width: cardWidth, height: cardHeight } = boxOf(table);
    const composite = uniqueGroupColumnIds(table);
    const clip = `card-${index}`;
    const rows = table.columns.map((column, row) => {
      const top = y + HEADER_HEIGHT + row * ROW_HEIGHT;
      const middle = top + ROW_HEIGHT / 2;
      const badge = column.pk ? "PK" : column.fk ? "FK" : column.unique || composite.has(column.id) ? "UQ" : "";
      const type = typeString(column).toLowerCase();
      const nameX = x + (badge ? 44 : 14);
      const nameRoom = cardWidth - (nameX - x) - 14 - type.length * 6.6 - 10;
      return [
        `<line x1="${x}" y1="${top}" x2="${x + cardWidth}" y2="${top}" stroke="${colors.rule}"/>`,
        badge ? `<rect x="${x + 10}" y="${middle - 9}" width="26" height="18" rx="5" fill="${colors.badge}"/><text x="${x + 23}" y="${middle}" font-size="10" font-weight="600" text-anchor="middle" dominant-baseline="central" fill="${column.pk ? colors.key : colors.muted}">${badge}</text>` : "",
        `<text x="${nameX}" y="${middle}" font-size="13" dominant-baseline="central" fill="${colors.text}"${column.pk ? ` font-weight="600"` : ""}>${escapeXml(fit(column.name.toUpperCase(), nameRoom))}${column.notNull || column.pk ? "" : `<tspan fill="${colors.muted}">?</tspan>`}</text>`,
        `<text x="${x + cardWidth - 14}" y="${middle}" font-size="12" text-anchor="end" dominant-baseline="central" fill="${colors.muted}">${escapeXml(type)}</text>`,
      ].join("");
    });
    return [
      `<g>`,
      `<clipPath id="${clip}"><rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="10"/></clipPath>`,
      `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="10" fill="${colors.card}"/>`,
      `<g clip-path="url(#${clip})">`,
      `<rect x="${x}" y="${y}" width="${cardWidth}" height="${TABLE_COLOR_STRIP_HEIGHT}" fill="${escapeXml(table.color.a)}"/>`,
      ...rows,
      `</g>`,
      `<text x="${x + 14}" y="${y + TABLE_COLOR_STRIP_HEIGHT + TABLE_HEADER_HEIGHT / 2}" font-size="14" font-weight="600" dominant-baseline="central" fill="${colors.text}">${escapeXml(fit(table.name.toUpperCase(), cardWidth - 28, 8.2))}</text>`,
      `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="10" fill="none" stroke="${colors.border}"/>`,
      `</g>`,
    ].join("");
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="${round(minX)} ${round(minY)} ${round(width)} ${round(height)}" font-family='${FONT}'>`,
    `<title>${escapeXml(schema.name)}</title>`,
    `<rect x="${round(minX)}" y="${round(minY)}" width="${round(width)}" height="${round(height)}" fill="${colors.background}"/>`,
    ...groups,
    ...memos,
    ...lines,
    ...cards,
    `</svg>`,
  ].join("\n");
}
