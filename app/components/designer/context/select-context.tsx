"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_SELECTION,
  selectOnly,
  selectionCount,
  type CanvasSelection,
  type SelectionKind,
} from "@/app/lib/selection";

export type SelectContextValue = {
  selection: CanvasSelection;
  setSelection: React.Dispatch<React.SetStateAction<CanvasSelection>>;
  /**
   * Read by the long-lived pointer/key listeners, which must see the current
   * selection without re-subscribing on every change.
   */
  selectionRef: React.RefObject<CanvasSelection>;
  single: boolean;
  selectedId: string | null;
  selectedGroupId: string | null;
  selectedMemoId: string | null;
  selectedIdRef: React.RefObject<string | null>;
  /** Replace the selection with one thing. Stable, so cards can memoize on it. */
  selectSingle: (kind: SelectionKind, id: string | null) => void;
  selectTable: (id: string | null) => void;
};

export const SelectContext = createContext<SelectContextValue | null>(null);

export function SelectProvider({ children }: { children: ReactNode }) {
  /**
   * One selection for the whole canvas. The three ids below are *derived* from
   * it rather than stored beside it: everything that acts on "the selected
   * table" — the side panel, ⌘↵, the junction command, the context menus — means
   * exactly one thing selected, which is what `single` says. Two sources of
   * truth here would drift within a release.
   */
  const [selection, setSelection] = useState<CanvasSelection>(EMPTY_SELECTION);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const single = selectionCount(selection) === 1;
  const selectedId = single ? (selection.tables[0] ?? null) : null;
  const selectedGroupId = single ? (selection.groups[0] ?? null) : null;
  const selectedMemoId = single ? (selection.memos[0] ?? null) : null;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const selectSingle = useCallback(
    (kind: SelectionKind, id: string | null) =>
      setSelection(id ? selectOnly(kind, id) : EMPTY_SELECTION),
    [],
  );
  const selectTable = useCallback(
    (id: string | null) => selectSingle("table", id),
    [selectSingle],
  );

  const value = useMemo(
    () => ({
      selection,
      setSelection,
      selectionRef,
      single,
      selectedId,
      selectedGroupId,
      selectedMemoId,
      selectedIdRef,
      selectSingle,
      selectTable,
    }),
    [
      selection,
      single,
      selectedId,
      selectedGroupId,
      selectedMemoId,
      selectSingle,
      selectTable,
    ],
  );
  return (
    <SelectContext.Provider value={value}>{children}</SelectContext.Provider>
  );
}
