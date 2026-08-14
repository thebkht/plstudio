"use client";

/**
 * The reorderable column list for one table in the side panel.
 *
 * Column order is DDL order, so a reorder is a real schema edit — but the
 * schema only changes once the card has landed in its slot. Everything in
 * between is written straight to the DOM: React renders twice per gesture
 * (grab and drop), not once per frame, which keeps `validateSchema` and
 * `generateDDL` out of the drag loop exactly as the canvas does.
 *
 * The card tracks the pointer 1:1 from the offset it was grabbed at, the
 * neighbours spring aside as it passes their midpoints, and on release the
 * card carries its own velocity into the spring that lands it — so there is no
 * seam between the drag and the animation.
 */

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ColumnEditor } from "./column-editor";
import {
  FLICK_SPRING,
  SETTLE_SPRING,
  Spring,
  VelocityTracker,
  prefersReducedMotion,
  rubberClamp,
  runFrameLoop,
} from "@/app/lib/motion";
import type { Column, Table } from "@/app/lib/schema";

type ForeignKeyTarget = { table: Table; target: Column };

/** How close to the scroll edge the pointer has to get before the list follows. */
const EDGE = 56;
const EDGE_SPEED = 820;
/** A flick is a release fast enough to deserve overshoot rather than a flat settle. */
const FLICK_VELOCITY = 320;

type Gesture = {
  pointerId: number;
  columnId: string;
  from: number;
  to: number;
  /** Ids in the order the DOM had them when the gesture began. */
  ids: string[];
  /** Each card's height plus the gap below it, so the maths survives variable heights. */
  slots: number[];
  /** Pointer position within the list at the moment of the grab. */
  grabY: number;
  pointerY: number;
  offset: number;
  shifts: Map<string, Spring>;
  /** Non-null once released: the spring carrying the card into its slot. */
  drop: Spring | null;
  tracker: VelocityTracker;
  scroller: HTMLElement | null;
  stop: (() => void) | null;
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Where the dragged card rests if it lands at `to`, relative to where it started. */
const restOffset = (gesture: Gesture, to: number) =>
  to === gesture.from
    ? 0
    : to > gesture.from
      ? sum(gesture.slots.slice(gesture.from + 1, to + 1))
      : -sum(gesture.slots.slice(to, gesture.from));

/** How far the card at `index` steps aside to open the gap at `gesture.to`. */
const shiftFor = (gesture: Gesture, index: number) => {
  if (index === gesture.from) return 0;
  if (gesture.to > gesture.from && index > gesture.from && index <= gesture.to)
    return -gesture.slots[gesture.from];
  if (gesture.to < gesture.from && index >= gesture.to && index < gesture.from)
    return gesture.slots[gesture.from];
  return 0;
};

export const ColumnList = memo(function ColumnList({
  table,
  readOnly,
  patchColumn,
  deleteColumn,
  reorderColumns,
  compatibleForeignKeyTargets,
}: {
  table: Table;
  readOnly: boolean;
  patchColumn: (tableId: string, columnId: string, patch: Partial<Column>) => void;
  deleteColumn: (tableId: string, columnId: string) => void;
  reorderColumns: (tableId: string, from: number, to: number) => void;
  compatibleForeignKeyTargets: (column: Column) => ForeignKeyTarget[];
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef(new Map<string, HTMLDivElement>());
  const gestureRef = useRef<Gesture | null>(null);
  const columnsRef = useRef(table.columns);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  columnsRef.current = table.columns;

  const setSlot = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) slotsRef.current.set(id, node);
    else slotsRef.current.delete(id);
  }, []);

  const paint = useCallback((gesture: Gesture) => {
    gesture.ids.forEach((id, index) => {
      const node = slotsRef.current.get(id);
      if (!node) return;
      const y =
        index === gesture.from ? gesture.offset : (gesture.shifts.get(id)?.value ?? 0);
      node.style.transform = y ? `translate3d(0, ${y}px, 0)` : "";
    });
  }, []);

  const clearTransforms = useCallback(() => {
    slotsRef.current.forEach((node) => {
      node.style.transform = "";
    });
  }, []);

  /**
   * The drop lands the schema edit. Clearing the transforms before committing
   * keeps the two in the same frame: React re-renders in the microtask after
   * this callback, so the reordered DOM is painted once, without a flash of the
   * old order.
   */
  const finish = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gesture.stop?.();
    gestureRef.current = null;
    clearTransforms();
    setDraggingId(null);
    if (gesture.to !== gesture.from)
      reorderColumns(table.id, gesture.from, gesture.to);
  }, [clearTransforms, reorderColumns, table.id]);

  /** Scroll the panel when the pointer reaches its edge, so a long list is reachable. */
  const autoScroll = useCallback((gesture: Gesture, dt: number) => {
    const scroller = gesture.scroller;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const above = EDGE - (gesture.pointerY - rect.top);
    const below = EDGE - (rect.bottom - gesture.pointerY);
    const speed =
      above > 0
        ? -EDGE_SPEED * Math.min(1, above / EDGE)
        : below > 0
          ? EDGE_SPEED * Math.min(1, below / EDGE)
          : 0;
    if (speed) scroller.scrollTop += speed * dt;
  }, []);

  const retarget = useCallback((gesture: Gesture) => {
    const candidates = gesture.ids.map((_, index) => index);
    const to = candidates.reduce((best, index) =>
      Math.abs(gesture.offset - restOffset(gesture, index)) <
      Math.abs(gesture.offset - restOffset(gesture, best))
        ? index
        : best,
    );
    if (to === gesture.to) return;
    gesture.to = to;
    gesture.ids.forEach((id, index) => {
      if (index === gesture.from) return;
      const spring = gesture.shifts.get(id);
      if (!spring) return;
      const target = shiftFor(gesture, index);
      if (prefersReducedMotion()) spring.reset(target);
      else spring.setTarget(target);
    });
  }, []);

  const step = useCallback(
    (dt: number) => {
      const gesture = gestureRef.current;
      const list = listRef.current;
      if (!gesture || !list) return false;
      let active = false;
      if (gesture.drop) {
        active = gesture.drop.step(dt);
        gesture.offset = gesture.drop.value;
      } else {
        autoScroll(gesture, dt);
        /*
         * Re-derived from the live list rect rather than accumulated, so an
         * auto-scroll moves the card through the list while it stays glued to
         * the pointer.
         */
        const raw = gesture.pointerY - list.getBoundingClientRect().top - gesture.grabY;
        const span = gesture.slots[gesture.from] * 2;
        gesture.offset = rubberClamp(
          raw,
          restOffset(gesture, 0),
          restOffset(gesture, gesture.ids.length - 1),
          span,
        );
        retarget(gesture);
        active = true;
      }
      gesture.shifts.forEach((spring) => {
        if (spring.step(dt)) active = true;
      });
      paint(gesture);
      if (!active) finish();
      return active;
    },
    [autoScroll, finish, paint, retarget],
  );

  const begin = useCallback(
    (columnId: string, pointerId: number, pointerY: number) => {
      const list = listRef.current;
      const ids = columnsRef.current.map((column) => column.id);
      const from = ids.indexOf(columnId);
      if (!list || from < 0 || ids.length < 2) return;
      const rects = ids.map((id) => slotsRef.current.get(id)?.getBoundingClientRect());
      if (rects.some((rect) => !rect)) return;
      const boxes = rects as DOMRect[];
      // The gap is a constant of the list, so one pair is enough to read it.
      const gap = Math.max(0, boxes[1].top - boxes[0].bottom);
      const gesture: Gesture = {
        pointerId,
        columnId,
        from,
        to: from,
        ids,
        slots: boxes.map((rect) => rect.height + gap),
        grabY: pointerY - list.getBoundingClientRect().top,
        pointerY,
        offset: 0,
        shifts: new Map(
          ids.map((id) => [id, new Spring(0, SETTLE_SPRING)] as const),
        ),
        drop: null,
        tracker: new VelocityTracker(),
        scroller: list.closest<HTMLElement>('[data-slot="scroll-area"]'),
        stop: null,
      };
      gesture.tracker.add(0, pointerY, performance.now());
      gestureRef.current = gesture;
      setDraggingId(columnId);
      gesture.stop = runFrameLoop(step);
    },
    [step],
  );

  const onGrab = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, columnId: string) => {
      if (readOnly || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const { pointerId, clientY } = event;
      if (gestureRef.current) {
        /*
         * A card grabbed while the last one is still settling: land that edit
         * first, then measure on the next frame, once React has re-rendered the
         * committed order. Measuring now would cache a layout about to change.
         */
        finish();
        requestAnimationFrame(() => begin(columnId, pointerId, clientY));
      } else begin(columnId, pointerId, clientY);
    },
    [begin, finish, readOnly],
  );

  const onGrabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, columnId: string) => {
      if (readOnly) return;
      const delta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
      if (!delta) return;
      const columns = columnsRef.current;
      const from = columns.findIndex((column) => column.id === columnId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= columns.length) return;
      event.preventDefault();
      reorderColumns(table.id, from, to);
      setAnnouncement(
        `${columns[from].name.toUpperCase()} moved to position ${to + 1} of ${columns.length}.`,
      );
    },
    [readOnly, reorderColumns, table.id],
  );

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId || gesture.drop) return;
      gesture.pointerY = event.clientY;
      gesture.tracker.add(0, event.clientY, event.timeStamp);
    };
    const release = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId || gesture.drop) return;
      const velocity = gesture.tracker.velocity(event.timeStamp).y;
      const target = restOffset(gesture, gesture.to);
      if (prefersReducedMotion()) {
        gesture.offset = target;
        gesture.shifts.forEach((spring, id) =>
          spring.reset(shiftFor(gesture, gesture.ids.indexOf(id))),
        );
        finish();
        return;
      }
      // Overshoot is earned by the flick that preceded it, never by a slow drop.
      const drop = new Spring(
        gesture.offset,
        Math.abs(velocity) > FLICK_VELOCITY ? FLICK_SPRING : SETTLE_SPRING,
      );
      drop.setTarget(target, velocity);
      gesture.drop = drop;
      setDraggingId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [finish]);

  /** A collaborator's edit can reorder the list underneath a gesture. */
  useLayoutEffect(() => {
    if (!gestureRef.current) clearTransforms();
  }, [clearTransforms, table.columns]);

  useEffect(() => () => gestureRef.current?.stop?.(), []);

  return (
    <div className="column-list" ref={listRef}>
      {table.columns.map((column, index) => (
        <div
          className={`column-slot ${draggingId === column.id ? "lifted" : ""}`}
          key={column.id}
          ref={(node) => setSlot(column.id, node)}
        >
          <ColumnEditor
            table={table}
            column={column}
            position={`${index + 1} of ${table.columns.length}`}
            patchColumn={patchColumn}
            deleteColumn={deleteColumn}
            compatibleForeignKeyTargets={compatibleForeignKeyTargets}
            onGrab={readOnly || table.columns.length < 2 ? undefined : onGrab}
            onGrabKeyDown={onGrabKeyDown}
          />
        </div>
      ))}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
});
