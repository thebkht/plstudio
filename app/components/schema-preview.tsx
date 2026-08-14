import { PREVIEW_HEIGHT, PREVIEW_WIDTH, schemaPreview } from "@/app/lib/schema-preview";
import { type Schema } from "@/app/lib/schema";

/**
 * A schema's silhouette, sized to a card. Deliberately not a client component:
 * the dashboards are server components, so the whole `schemaJson` stays on the
 * server and only this markup crosses the wire. It holds no state and reads no
 * DOM, which also lets the (client) templates gallery render it unchanged.
 *
 * Decorative: the card states the name and table count in text, so announcing
 * a wall of rectangles would only add noise.
 */

/** Kept in device pixels rather than scaled, so density never changes weight. */
const STRIP_HEIGHT = 2;
const CORNER = 2;

export default function SchemaPreview({ schema }: { schema: Schema }) {
  const preview = schemaPreview(schema);
  if (!preview)
    return (
      <div className="schema-preview schema-preview-empty">
        <span>Nothing drawn yet</span>
      </div>
    );
  return (
    <svg
      className="schema-preview"
      viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
      aria-hidden="true"
      focusable="false"
    >
      {/* Wiring first, so the blocks sit above their own connections. */}
      {preview.edges.map((edge, index) => (
        <line
          key={index}
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          className="schema-preview-edge"
        />
      ))}
      {preview.tables.map((table, index) => (
        <g key={index}>
          <rect
            x={table.x}
            y={table.y}
            width={table.w}
            height={table.h}
            rx={CORNER}
            className="schema-preview-table"
          />
          {/* The accent strip the canvas card wears, at a fixed weight. Clipped
              to the block's own corner so it cannot outrun a short table. */}
          <rect
            x={table.x}
            y={table.y}
            width={table.w}
            height={Math.min(STRIP_HEIGHT, table.h)}
            rx={Math.min(CORNER, table.h / 2)}
            fill={table.color}
          />
        </g>
      ))}
    </svg>
  );
}
