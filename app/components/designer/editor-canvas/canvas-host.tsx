"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useCanvasGestures } from "./use-canvas-gestures";
import { Canvas, type CanvasRelationship } from "./canvas";
import {
  useCanvasCommands,
  useDesignerSettings,
  useSchema,
  useSelect,
  useTransformControls,
} from "@/app/hooks";
import {
  focusedEntities,
  selectGroupWithMembers,
  type FocusTarget,
} from "@/app/lib/selection";
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
  const { setSelection, selectedIdRef } = useSelect();
  const { settings, isMac } = useDesignerSettings();
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
   * Focus dimming. Pointing at a table lights one hop of foreign keys around
   * it; pointing at one of the lines lights just that line and the two tables
   * it joins, which is the narrower question, and the one worth asking when a
   * dozen edges leave the same card. Everything else fades -- on the diagrams
   * that need this at all, that is most of the canvas.
   *
   * React does not own any of it, for the same reason it does not own the
   * camera: hover changes as fast as the pointer moves, and routing it through
   * state would re-render every card on the canvas to fade twenty of them. The
   * neighbourhood is applied by toggling a class on the nodes already in the
   * DOM, found by the `data-*` attributes the cards and edges carry, so a card
   * outside the neighbourhood is never re-rendered at all.
   */
  const hoverRef = useRef<FocusTarget | null>(null);
  /** What the DOM currently shows, so an unchanged hover costs nothing. */
  const focusedRef = useRef<string | null>(null);
  const dimRef = useRef(settings.dimUnrelated);
  dimRef.current = settings.dimUnrelated;
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  /** Identity of a focus target, so "did it change" is a string comparison. */
  const focusKey = (target: FocusTarget | null) =>
    target && `${target.kind}:${target.id}`;

  const applyFocus = () => {
    const wrap = gestures.canvasRef.current;
    if (!wrap) return;
    // Selection wins over hover: a click is a deliberate answer to the question
    // hovering only asks in passing.
    const selected = selectedIdRef.current;
    const root: FocusTarget | null = dimRef.current
      ? selected
        ? { kind: "table", id: selected }
        : hoverRef.current
      : null;
    focusedRef.current = focusKey(root);
    const { tables, edges } = focusedEntities(
      schemaRef.current.relationships ?? [],
      root,
    );
    // A group stays lit while anything inside it is lit, so the region a
    // neighbourhood lives in keeps its label and its colour.
    const groups = new Set(
      schemaRef.current.tables
        .filter((table) => table.schemaId && tables.has(table.id))
        .map((table) => table.schemaId),
    );
    wrap.classList.toggle("focusing", root !== null);
    wrap.classList.toggle("hover-focus", root !== null && !selected);
    const paint = (selector: string, key: string, lit: Set<unknown>) =>
      wrap
        .querySelectorAll(selector)
        .forEach((node) =>
          node.classList.toggle(
            "dimmed",
            root !== null && !lit.has(node.getAttribute(key)),
          ),
        );
    paint(".table-card[data-table-id]", "data-table-id", tables);
    paint("[data-edge-id]", "data-edge-id", edges);
    paint("[data-group-id]", "data-group-id", groups);
    paint("[data-memo-id]", "data-memo-id", new Set());
  };

  /*
   * After every render, because a card that has just mounted -- pasted, undone,
   * or scrolled back into view -- carries no class of its own. The same window
   * `applyViewport` is re-asserted for, closed the same way.
   */
  useLayoutEffect(applyFocus);

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
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Canvas space, not screen space: peers at other zoom levels must see the
    // pointer over the same table, not the same pixel.
    pointRef.current = canvasPoint(event);
    // A card first, then a line. While anything is focused the edge layer sits
    // above the cards, so a lit line crossing a card is genuinely the thing
    // being pointed at -- and the dimmed ones are pointer-transparent, so the
    // faded slab cannot answer for a card underneath it.
    const target = event.target as Element | null;
    const card = target?.closest?.(".table-card[data-table-id]");
    const line = card ? null : target?.closest?.("[data-edge-id]");
    hoverRef.current = card
      ? { kind: "table", id: card.getAttribute("data-table-id")! }
      : line
        ? { kind: "edge", id: line.getAttribute("data-edge-id")! }
        : null;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const point = pointRef.current;
      if (!point) return;
      setCursor(point);
      if (linkingRef.current)
        setLinking((current) => (current ? { ...current, ...point } : current));
      // Only when it actually changed: the pointer crosses a card once, but it
      // moves across it a hundred times.
      if (focusKey(hoverRef.current) !== focusedRef.current && !selectedIdRef.current)
        applyFocus();
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
        onPointerLeave: () => {
          setCursor(null);
          hoverRef.current = null;
          applyFocus();
        },
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
