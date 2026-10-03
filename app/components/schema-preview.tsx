import { PREVIEW_HEIGHT, PREVIEW_WIDTH, type PreviewGeometry } from "@/app/lib/schema-preview";

/**
 * A schema's map, sized to a card -- drawn exactly as the editor's minimap
 * draws the same diagram, so the thumbnail you click is the overview you land
 * on. Deliberately not a client component: the dashboards are server
 * components, so the whole `schemaJson` stays on the server and only this
 * markup crosses the wire. It holds no state and reads no DOM, and it takes the
 * geometry rather than the schema so the dashboards can hand it a cached one.
 *
 * Decorative: the card states the name and table count in text, so announcing
 * a wall of rectangles would only add noise.
 */

/** Kept in device pixels rather than scaled, so density never changes weight. */
const CORNER = 1.5;

export default function SchemaPreview({ preview }: { preview: PreviewGeometry | null }) {
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
      {/* Regions first, faint, so the tables read as sitting inside them.
          Their fill goes through `style` because memo colours are custom
          properties, which a presentation attribute cannot resolve -- safe
          only because region colours come from the built-in palettes. */}
      {preview.regions.map((region, index) => (
        <rect key={`r${index}`} x={region.x} y={region.y} width={region.w} height={region.h} rx={CORNER * 2} className="schema-preview-region" style={{ fill: region.color }} />
      ))}
      {preview.tables.map((table, index) => (
        <rect key={index} x={table.x} y={table.y} width={table.w} height={table.h} rx={CORNER} fill={table.color} className="schema-preview-table" />
      ))}
    </svg>
  );
}
