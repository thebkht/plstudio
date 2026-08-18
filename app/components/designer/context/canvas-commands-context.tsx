"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Table } from "@/app/lib/schema";

type Point = { x: number; y: number };

/**
 * The commands that cross *upward* out of the canvas: the appbar menus and the
 * window key handler fire them, and both render above the canvas in the tree.
 *
 * Every member is a command — a void function, never a rendered value. That is
 * the rule that makes the ref indirection below safe: nothing here can go stale
 * on screen, because nothing here is on screen.
 */
export type CanvasCommands = {
  addTable: (groupId?: string, at?: Point) => void;
  addGroup: (at?: Point) => void;
  addMemo: (at?: Point, schemaId?: string) => void;
  makeJunction: (tableId?: string) => void;
  autoLayout: () => void;
  fitView: () => void;
  zoomBy: (delta: number) => void;
  copySelection: (format: "sql" | "json") => void;
  deleteSelection: () => void;
  pasteSelection: (text: string) => void;
  revealTables: (tables: Table[]) => void;
  setHandMode: Dispatch<SetStateAction<boolean>>;
  setSpaceHeld: Dispatch<SetStateAction<boolean>>;
  assignTableToGroup: (tableId: string, schemaId: string) => void;
};

export type CanvasCommandsValue = CanvasCommands & {
  /** Called by `canvas-host` on every render; a ref write, so it costs nothing. */
  register: (commands: CanvasCommands) => void;
};

export const CanvasCommandsContext = createContext<CanvasCommandsValue | null>(
  null,
);

/**
 * Ref-backed on purpose. `useCanvasGestures` rebuilds most of these closures on
 * every frame of a drag, so a plain context value would re-render the appbar and
 * the side panel 60 times a second — exactly the cascade this provider exists to
 * break. Instead the live table sits in a ref and the context value is built
 * once, for the app's lifetime, out of forwarders that read it.
 *
 * A command fired before the canvas mounts is a no-op, which is the right
 * answer: there is no canvas to command.
 */
export function CanvasCommandsProvider({ children }: { children: ReactNode }) {
  const commandsRef = useRef<CanvasCommands | null>(null);
  const register = useCallback((commands: CanvasCommands) => {
    commandsRef.current = commands;
  }, []);
  const value = useMemo<CanvasCommandsValue>(() => {
    const forward = <K extends keyof CanvasCommands>(key: K) =>
      ((...args: unknown[]) =>
        (
          commandsRef.current?.[key] as
            | ((...rest: unknown[]) => void)
            | undefined
        )?.(...args)) as CanvasCommands[K];
    return {
      register,
      addTable: forward("addTable"),
      addGroup: forward("addGroup"),
      addMemo: forward("addMemo"),
      makeJunction: forward("makeJunction"),
      autoLayout: forward("autoLayout"),
      fitView: forward("fitView"),
      zoomBy: forward("zoomBy"),
      copySelection: forward("copySelection"),
      deleteSelection: forward("deleteSelection"),
      pasteSelection: forward("pasteSelection"),
      revealTables: forward("revealTables"),
      setHandMode: forward("setHandMode"),
      setSpaceHeld: forward("setSpaceHeld"),
      assignTableToGroup: forward("assignTableToGroup"),
    };
  }, [register]);
  return (
    <CanvasCommandsContext.Provider value={value}>
      {children}
    </CanvasCommandsContext.Provider>
  );
}
