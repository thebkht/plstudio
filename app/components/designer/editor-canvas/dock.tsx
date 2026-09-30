"use client";

import { DownloadIcon, HandIcon, LayersIcon, LayoutGridIcon, LinkIcon, MinusIcon, PlusIcon, Redo2Icon, SaveIcon, ScanIcon, StickyNoteIcon, TableIcon, Undo2Icon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  useDesignerSettings,
  useLayout,
  useSchema,
  useTransform,
  useTransformControls,
} from "@/app/hooks";
import { DockButton } from "../primitives";

export type DockProps = {
  panMode: boolean;
  onToggleHand: () => void;
  zoomBy: (delta: number) => void;
  fitView: () => void;
  addTable: () => void;
  addGroup: () => void;
  addMemo: () => void;
  makeJunction: () => void;
  /** Whether a single table is selected — the junction command needs one. */
  hasSelectedTable: boolean;
  autoLayout: () => void;
  save: () => Promise<void> | void;
};

export function Dock({
  panMode,
  onToggleHand,
  zoomBy,
  fitView,
  addTable,
  addGroup,
  addMemo,
  makeJunction,
  hasSelectedTable,
  autoLayout,
  save,
}: DockProps) {
  const { isMac } = useDesignerSettings();
  const { setModal } = useLayout();
  const { undo, redo, canUndo, canRedo } = useSchema();
  const { zoom, settledZoom } = useTransform();
  const { zoomRef } = useTransformControls();

  return (
    <>
      {/* A toolbar of separate controls, not a ButtonGroup: that joins its
          children into one segmented bar, squaring every hover and pilling
          the last button's right edge only. */}
      <div role="toolbar" className="dock" aria-label="Canvas controls">
        <DockButton
          label="Hand tool"
          icon={HandIcon}
          shortcut="toggleHand"
          isMac={isMac}
          isActive={panMode}
          onClick={onToggleHand}
        />
        <Separator orientation="vertical" />
        {/* The minus / percentage / plus stepper every canvas app uses. Plain
            signs rather than magnifiers-in-brackets: beside a number, "−" and
            "+" say what they do to it. The number is a control too -- it is
            where people look to get back to 100%. */}
        <DockButton
          label="Zoom out"
          icon={MinusIcon}
          shortcut="zoomOut"
          isMac={isMac}
          onClick={() => zoomBy(-0.1)}
        />
        <DockButton
          label="Reset zoom to 100%"
          shortcut="zoomReset"
          isMac={isMac}
          className="dock-zoom"
          onClick={() => zoomBy(1 - zoomRef.current)}
        >
          {Math.round(zoom * 100)}%
        </DockButton>
        <DockButton
          label="Zoom in"
          icon={PlusIcon}
          shortcut="zoomIn"
          isMac={isMac}
          onClick={() => zoomBy(0.1)}
        />
        <DockButton
          label="Fit to screen"
          icon={ScanIcon}
          shortcut="fitView"
          isMac={isMac}
          onClick={fitView}
        />
        <Separator orientation="vertical" />
        <DockButton
          label="Undo"
          icon={Undo2Icon}
          shortcut="undo"
          isMac={isMac}
          isDisabled={!canUndo}
          disabledReason="Nothing to undo yet"
          onClick={undo}
        />
        <DockButton
          label="Redo"
          icon={Redo2Icon}
          shortcut="redo"
          isMac={isMac}
          isDisabled={!canRedo}
          disabledReason="Nothing to redo"
          onClick={redo}
        />
        <Separator orientation="vertical" />
        <DockButton
          label="Add table"
          icon={TableIcon}
          shortcut="addTable"
          isMac={isMac}
          onClick={addTable}
        />
        <DockButton
          label="Add schema group"
          icon={LayersIcon}
          shortcut="addGroup"
          isMac={isMac}
          onClick={addGroup}
        />
        <DockButton
          label="Add memo"
          icon={StickyNoteIcon}
          shortcut="addMemo"
          isMac={isMac}
          onClick={addMemo}
        />
        <DockButton
          label="Add junction table"
          icon={LinkIcon}
          shortcut="junction"
          isMac={isMac}
          isDisabled={!hasSelectedTable}
          disabledReason="Select a table first"
          onClick={makeJunction}
        />
        <Separator orientation="vertical" />
        <DockButton
          label="Tidy up layout"
          icon={LayoutGridIcon}
          shortcut="tidyLayout"
          isMac={isMac}
          onClick={autoLayout}
        />
        <DockButton
          label="Save"
          icon={SaveIcon}
          shortcut="save"
          isMac={isMac}
          onClick={() => void save()}
        />
        <DockButton
          label="Export"
          icon={DownloadIcon}
          shortcut="export"
          isMac={isMac}
          onClick={() => setModal("export")}
        />
      </div>
      {/*
        The zoom readout is not itself a live region: it changes on every
        frame of a ctrl-scroll, which would announce a flood. This settles
        first and announces the number the gesture landed on.
      */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {settledZoom}% zoom
      </span>
    </>
  );
}
