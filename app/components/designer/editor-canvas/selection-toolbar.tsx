"use client";

import type { ShortcutId } from "@/app/lib/shortcuts";
import { selectionCount } from "@/app/lib/selection";
import { useSelect } from "@/app/hooks";

export type SelectionToolbarProps = {
  /** Bounding box of the multi-selection, in canvas coordinates. */
  frame: { x: number; y: number; width: number; height: number };
  readOnly: boolean;
  hint: (id: ShortcutId) => string;
  onCopy: (format: "sql" | "json") => void;
  onDelete: () => void;
};

/** Floats above the multi-selection it acts on — the controls sit by their subject. */
export function SelectionToolbar({
  frame,
  readOnly,
  hint,
  onCopy,
  onDelete,
}: SelectionToolbarProps) {
  const { selection } = useSelect();
  /*
   * Screen-space chrome anchored to a canvas-space frame, so it has to follow
   * the camera — and it is visible while the camera can move, unlike the drag
   * overlays. Composing the two in `calc()` off the viewport custom properties
   * keeps it pinned during a pan without re-rendering it per frame; `frame` is
   * static for as long as this is on screen (a multi-drag hides it).
   */
  return (
    <div
      className="selection-toolbar"
      style={
        {
          "--frame-cx": `${frame.x + frame.width / 2}px`,
          "--frame-y": `${frame.y}px`,
        } as React.CSSProperties
      }
    >
      <span className="selection-toolbar-count">
        {selectionCount(selection)} selected
      </span>
      <button
        type="button"
        onClick={() => onCopy("sql")}
        title={`Copy as SQL (${hint("copySelectionSql")})`}
      >
        Copy SQL
      </button>
      <button
        type="button"
        onClick={() => onCopy("json")}
        title={`Copy as JSON (${hint("copySelectionJson")})`}
      >
        Copy JSON
      </button>
      {!readOnly && (
        <button
          type="button"
          className="selection-toolbar-danger"
          onClick={onDelete}
          title={`Delete (${hint("deleteSelection")})`}
        >
          Delete
        </button>
      )}
    </div>
  );
}
