import { PREVIEW_HEIGHT, PREVIEW_WIDTH, schemaPreview } from "@/app/lib/schema-preview";
import { type Schema } from "@/app/lib/schema";

/**
 * A schema's map, sized to a card -- drawn exactly as the editor's minimap
 * draws the same diagram, so the thumbnail you click is the overview you land
 * on. Deliberately not a client component: the dashboards are server
 * components, so the whole `schemaJson` stays on the server and only this
 * markup crosses the wire. It holds no state and reads no DOM.
 *
 * Decorative: the card states the name and table count in text, so announcing
 * a wall of rectangles would only add noise.
 */

/** Kept in device pixels rather than scaled, so density never changes weight. */
const CORNER = 1.5;

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
      {/* Regions first, faint, so the tables read as sitting inside them. Fill
          goes through `style`: memo colours are custom properties, which a
          presentation attribute cannot resolve. */}
      {preview.regions.map((region, index) => (
        <rect key={`r${index}`} x={region.x} y={region.y} width={region.w} height={region.h} rx={CORNER * 2} className="schema-preview-region" style={{ fill: region.color }} />
      ))}
      {preview.tables.map((table, index) => (
        <rect key={index} x={table.x} y={table.y} width={table.w} height={table.h} rx={CORNER} className="schema-preview-table" style={{ fill: table.color }} />
      ))}
    </svg>
  );
}
