"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useCanvasGestures } from "./use-canvas-gestures";
import { Canvas, type CanvasRelationship } from "./canvas";
import {
  useCanvasCommands,
  useDesignerSettings,
  useSchema,
  useSelect,
  useTransformControls,
} from "@/app/hooks";
import { selectGroupWithMembers } from "@/app/lib/selection";
import { shortcutHint, type ShortcutId } from "@/app/lib/shortcuts";
import type { Table } from "@/app/lib/schema";
import { HEADER_HEIGHT, ROW_HEIGHT } from "../constants";

export type CanvasHostProps = {
  readOnly: boolean;
  save: () => Promise<void> | void;
  relationships: CanvasRelationship[];
  relationshipCounts: Map<string, number>;
  /** Fires the same closure the chord does, so a menu row cannot drift from it. */
  runShortcut: (id: ShortcutId) => void;
};

/**
 * Where the gesture layer lives. `useCanvasGestures` owns `dragPosition`,
 * `marquee`, the resize values and the pan flags — state that changes on every
 * pointermove — so it is called *here*, below the appbar and the side panel,
 * rather than in `Workspace` above them. That placement is the reason a drag
 * re-renders the canvas and nothing else.
 *
 * The commands that genuinely have to reach upward are published through
 * `CanvasCommandsContext`, whose value never changes identity.
 */
export function CanvasHost({
  readOnly,
  save,
  relationships,
  relationshipCounts,
  runShortcut,
}: CanvasHostProps) {
  const { schema, setCursor } = useSchema();
  const { setSelection } = useSelect();
  const { isMac } = useDesignerSettings();
  const { register } = useCanvasCommands();
  const { applyViewport, panRef, zoomRef } = useTransformControls();
  const gestures = useCanvasGestures({ readOnly });

  /*
   * Re-assert the camera after every render. React does not write the viewport
   * custom properties at all — `applyViewport` does — so a `.canvas-wrap` that
   * has just mounted carries only the `:root` defaults while the refs hold the
   * real camera. This is the one line that closes that window.
   */
  useLayoutEffect(() => {
    applyViewport(panRef.current, zoomRef.current);
  });
  const {
    addGroup,
    addMemo,
    addTable,
    assignTableToGroup,
    autoLayout,
    canvasPoint,
    copySelection,
    deleteSelection,
    fitView,
    linking,
    livePosition,
    liveWidth,
    makeJunction,
    pasteSelection,
    revealTables,
    setHandMode,
    setLinking,
    setSpaceHeld,
    zoomBy,
  } = gestures;

  /*
   * Re-published on every render, because most of these closures are rebuilt on
   * every render. It is a ref write, so it costs nothing and re-renders nothing.
   * A layout effect rather than a passive one: the appbar is interactive as soon
   * as the browser paints, and a command that lands one commit late is a bug.
   */
  useLayoutEffect(() => {
    register({
      addTable,
      addGroup,
      addMemo,
      makeJunction,
      autoLayout,
      fitView,
      zoomBy,
      copySelection,
      deleteSelection,
      pasteSelection,
      revealTables,
      setHandMode,
      setSpaceHeld,
      assignTableToGroup,
    });
  });

  /*
   * Which flank each edge leaves from, with hysteresis so a card nudged across
   * the midpoint does not make its edges flip back and forth. It is per-anchor
   * history rather than a derivation, so it lives in a ref — see
   * `relationshipPoint` for the rule it applies.
   */
  const edgeSideRef = useRef(new Map<string, 1 | -1>());

  const relationshipPoint = (
    table: Table,
    index: number,
    other: Table,
    anchorKey: string,
  ) => {
    // Anchors follow the live position so edges stay attached mid-drag.
    const origin = livePosition(table);
    const otherOrigin = livePosition(other);

    const width = liveWidth(table);
    const right = origin.x + width;
    const otherRight = otherOrigin.x + liveWidth(other);

    // Comparing card extents ensures that when cards are clear of each other,
    // they leave facing each other (right edge to left edge, or vice versa).
    // Cards that overlap horizontally have no clear facing side, so both
    // ends route out the same flank (C-shaped curve) around whichever side
    // (left or right) has closer aligning edges.
    const raw: 1 | -1 =
      otherOrigin.x >= right
        ? 1
        : otherRight <= origin.x
          ? -1
          : Math.abs(right - otherRight) <= Math.abs(origin.x - otherOrigin.x)
            ? 1
            : -1;

    // Hysteresis: keep the previous direction unless the card position has moved
    // past the boundary margin to avoid edge flipping flicker.
    const HYSTERESIS = 30; // px
    const previous = edgeSideRef.current.get(anchorKey);
    let direction = raw;
    if (previous !== undefined && previous !== raw) {
      const keepsPrevious =
        previous === 1
          ? otherOrigin.x >= origin.x &&
            right - otherRight <=
              Math.abs(origin.x - otherOrigin.x) + HYSTERESIS
          : otherRight <= right &&
            origin.x - otherOrigin.x <=
              Math.abs(right - otherRight) + HYSTERESIS;
      if (keepsPrevious) direction = previous;
    }
    edgeSideRef.current.set(anchorKey, direction);

    return {
      x: origin.x + (direction === 1 ? width : 0),
      y: origin.y + HEADER_HEIGHT + index * ROW_HEIGHT + ROW_HEIGHT / 2,
      direction,
    };
  };

  /*
   * The pointer stream, rAF-coalesced. Presence and the in-flight link both
   * only ever need the newest position, and a trackpad delivers pointermoves
   * faster than the compositor can use them.
   */
  const pointRef = useRef<{ x: number; y: number } | null>(null);
  const frameRef = useRef<number | null>(null);
  const linkingRef = useRef(linking);
  linkingRef.current = linking;
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );
  const onPointerMove = (event: { clientX: number; clientY: number }) => {
    // Canvas space, not screen space: peers at other zoom levels must see the
    // pointer over the same table, not the same pixel.
    pointRef.current = canvasPoint(event);
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const point = pointRef.current;
      if (!point) return;
      setCursor(point);
      if (linkingRef.current)
        setLinking((current) => (current ? { ...current, ...point } : current));
    });
  };

  return (
    <Canvas
      readOnly={readOnly}
      save={save}
      gestures={{
        ...gestures,
        relationships,
        relationshipCounts,
        relationshipPoint,
        onPointerMove,
        onPointerLeave: () => setCursor(null),
        onPointerCancel: (event) => {
          if (linkingRef.current?.pointerId === event.pointerId)
            setLinking(null);
        },
        onToggleHand: () => setHandMode((on) => !on),
        hint: (id: ShortcutId) => shortcutHint(id, isMac),
        runShortcut,
        selectGroupMembers: (groupId: string) =>
          setSelection(selectGroupWithMembers(schema, groupId)),
      }}
    />
  );
}
