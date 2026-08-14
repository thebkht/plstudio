"use client";

import { createContext, useMemo, useState, type ReactNode } from "react";
import type { SaveState } from "@/app/lib/save-queue";

/**
 * Deliberately just the state, not the pipeline — the queue, its revision
 * bookkeeping and the flush guards stay in `Workspace`, which is the only
 * place that knows the project being written to. drawdb draws the same line:
 * its SaveStateContext holds one value and `Workspace.jsx` does the saving.
 */
export type SaveStateContextValue = {
  saveState: SaveState;
  setSaveState: React.Dispatch<React.SetStateAction<SaveState>>;
  /** Whether the document has edits the queue has not yet been handed. */
  dirty: boolean;
  setDirty: React.Dispatch<React.SetStateAction<boolean>>;
};

export const SaveStateContext = createContext<SaveStateContextValue | null>(
  null,
);

export function SaveStateProvider({ children }: { children: ReactNode }) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);
  const value = useMemo(
    () => ({ saveState, setSaveState, dirty, setDirty }),
    [saveState, dirty],
  );
  return (
    <SaveStateContext.Provider value={value}>
      {children}
    </SaveStateContext.Provider>
  );
}
