"use client";

import {
  ArrowTurnBackwardIcon,
  ArrowTurnForwardIcon,
  Download04Icon,
  FloppyDiskIcon,
  GridViewIcon,
  HandGrabIcon,
  Layers01Icon,
  Link01Icon,
  Maximize01Icon,
  StickyNote01Icon,
  Table01Icon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons";
import { ButtonGroup } from "@/components/ui/button-group";
import { Separator } from "@/components/ui/separator";
import {
  useDesignerSettings,
  useLayout,
  useSchema,
  useTransform,
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

  return (
    <>
      <ButtonGroup className="dock" aria-label="Canvas controls">
        <DockButton
          label="Hand tool"
          icon={HandGrabIcon}
          shortcut="toggleHand"
          isMac={isMac}
          isActive={panMode}
          onClick={onToggleHand}
        />
        <DockButton
          label="Zoom out"
          icon={ZoomOutAreaIcon}
          shortcut="zoomOut"
          isMac={isMac}
          onClick={() => zoomBy(-0.1)}
        />
        <span className="dock-zoom">{Math.round(zoom * 100)}%</span>
        <DockButton
          label="Zoom in"
          icon={ZoomInAreaIcon}
          shortcut="zoomIn"
          isMac={isMac}
          onClick={() => zoomBy(0.1)}
        />
        <DockButton
          label="Fit to screen"
          icon={Maximize01Icon}
          shortcut="fitView"
          isMac={isMac}
          onClick={fitView}
        />
        <Separator orientation="vertical" />
        <DockButton
          label="Undo"
          icon={ArrowTurnBackwardIcon}
          shortcut="undo"
          isMac={isMac}
          isDisabled={!canUndo}
          disabledReason="Nothing to undo yet"
          onClick={undo}
        />
        <DockButton
          label="Redo"
          icon={ArrowTurnForwardIcon}
          shortcut="redo"
          isMac={isMac}
          isDisabled={!canRedo}
          disabledReason="Nothing to redo"
          onClick={redo}
        />
        <Separator orientation="vertical" />
        <DockButton
          label="Add table"
          icon={Table01Icon}
          shortcut="addTable"
          isMac={isMac}
          onClick={addTable}
        />
        <DockButton
          label="Add schema group"
          icon={Layers01Icon}
          shortcut="addGroup"
          isMac={isMac}
          onClick={addGroup}
        />
        <DockButton
          label="Add memo"
          icon={StickyNote01Icon}
          shortcut="addMemo"
          isMac={isMac}
          onClick={addMemo}
        />
        <DockButton
          label="Add junction table"
          icon={Link01Icon}
          shortcut="junction"
          isMac={isMac}
          isDisabled={!hasSelectedTable}
          disabledReason="Select a table first"
          onClick={makeJunction}
        />
        <Separator orientation="vertical" />
        <DockButton
          label="Tidy up layout"
          icon={GridViewIcon}
          shortcut="tidyLayout"
          isMac={isMac}
          onClick={autoLayout}
        />
        <DockButton
          label="Save to database"
          icon={FloppyDiskIcon}
          shortcut="save"
          isMac={isMac}
          onClick={() => void save()}
        />
        <DockButton
          label="Export"
          icon={Download04Icon}
          shortcut="export"
          isMac={isMac}
          onClick={() => setModal("export")}
        />
      </ButtonGroup>
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
