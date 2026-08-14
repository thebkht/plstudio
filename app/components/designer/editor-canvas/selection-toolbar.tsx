"use client";

import type { ShortcutId } from "@/app/lib/shortcuts";
import { selectionCount } from "@/app/lib/selection";
import { useSelect, useTransform } from "@/app/hooks";

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
  const { pan, zoom } = useTransform();
  return (
    <div
      className="selection-toolbar"
      style={{
        transform: `translate3d(${pan.x + (frame.x + frame.width / 2) * zoom}px, ${pan.y + frame.y * zoom}px, 0)`,
      }}
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
