"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  prefersReducedMotion,
  runFrameLoop,
  Spring,
  type Vec,
} from "@/app/lib/motion";
import {
  GRID_DOT_RADIUS,
  GRID_FADE_END,
  GRID_FADE_START,
  GRID_SIZE,
} from "../constants";

export type Pan = { x: number; y: number };

/**
 * Frame-varying. `pan`/`zoom` change on every pointermove of a pan/zoom
 * gesture and every frame of the post-release momentum spring, so anything
 * that only needs to *read* the current camera should consume this context
 * — never `TransformControlsContext` — and accept that it re-renders at
 * gesture frame rate.
 */
export type TransformContextValue = {
  zoom: number;
  pan: Pan;
  /** The zoom level a screen reader hears, settled so it is not narrated per frame. */
  settledZoom: number;
};

/**
 * Permanently stable. Every field here keeps the same identity for the
 * app's entire lifetime (state setters are stable by React contract; the
 * refs are `useRef` objects; `stopAnimation`/`animateTo` are `useCallback`s
 * whose deps never change). Consuming this context never re-renders the
 * consumer — that's the point of splitting it out of `TransformContextValue`.
 */
export type TransformControlsContextValue = {
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPan: React.Dispatch<React.SetStateAction<Pan>>;
  /**
   * Moves the camera *without* re-rendering: writes the refs and the custom
   * properties the canvas is positioned from, and nothing else. Gestures drive
   * this per frame and commit to state once, on settle — the same split
   * `dragPosition` makes for a card's position.
   *
   * The corollary is a rule: **anything that reads the camera must go through
   * `panRef`/`zoomRef` or a custom property, never `pan`/`zoom` state**, which
   * is a gesture behind for the whole of a pan.
   */
  applyViewport: (pan: Pan, zoom: number) => void;
  /** The `.canvas-wrap` element `applyViewport` writes to. */
  viewportRef: React.RefObject<HTMLDivElement | null>;
  /**
   * The live camera. The canvas's long-lived pointer and wheel listeners read
   * these so they never re-subscribe mid-gesture — and, since `applyViewport`
   * updates them and `pan`/`zoom` state does not follow until the gesture
   * settles, they are the only correct source mid-gesture.
   */
  panRef: React.RefObject<Pan>;
  zoomRef: React.RefObject<number>;
  springsRef: React.RefObject<{ x: Spring; y: Spring } | null>;
  stopAnimationRef: React.RefObject<(() => void) | null>;
  stopAnimation: () => void;
  animateTo: (
    from: Vec,
    target: Vec,
    velocity: Vec,
    options: { damping: number; response: number },
    onFrame: (value: Vec) => void,
    onSettle?: (value: Vec) => void,
  ) => void;
};

export const TransformContext = createContext<TransformContextValue | null>(
  null,
);
export const TransformControlsContext =
  createContext<TransformControlsContextValue | null>(null);

export function TransformProvider({ children }: { children: ReactNode }) {
  const [zoom, setZoomState] = useState(1);
  const [pan, setPanState] = useState<Pan>({ x: 0, y: 0 });
  /*
   * Not mirrored during render, deliberately. `applyViewport` moves the camera
   * without touching state, so for the whole of a pan these refs are ahead of
   * `pan`/`zoom` — a render-time `panRef.current = pan` would stamp the stale
   * value back over the live one. They are written by the two functions that
   * move the camera instead, and by nothing else.
   */
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  /**
   * The one place the camera reaches the DOM. `.canvas` and the overlays are
   * positioned from these custom properties rather than from an inline
   * transform React re-stamps, which is what lets a pan skip React entirely.
   */
  const applyViewport = useCallback((nextPan: Pan, nextZoom: number) => {
    panRef.current = nextPan;
    zoomRef.current = nextZoom;
    const element = viewportRef.current;
    if (!element) return;
    const size = GRID_SIZE * nextZoom;
    const set = (name: string, value: string) =>
      element.style.setProperty(name, value);
    set("--pan-x", `${nextPan.x}px`);
    set("--pan-y", `${nextPan.y}px`);
    set("--zoom", `${nextZoom}`);
    // Counter-scale for anything drawn inside the canvas that must not grow
    // with it — peer cursors, and their labels.
    set("--inverse-zoom", `${1 / nextZoom}`);
    /*
     * The dot lattice, in canvas space. `.canvas` has `transform-origin: 0 0`,
     * so canvas point (0, 0) sits at screen (`pan.x`, `pan.y`) — anchoring the
     * tiling there is what keeps a dot on the same point of the diagram while
     * the camera moves. The half-tile shift centres each dot on a lattice point
     * rather than in the middle of its tile, matching drawDB's pattern offset
     * of `-gridCircleRadius`.
     */
    set("--grid-size", `${size}px`);
    set("--grid-dot-radius", `${GRID_DOT_RADIUS * nextZoom}px`);
    set("--grid-x", `${nextPan.x - size / 2}px`);
    set("--grid-y", `${nextPan.y - size / 2}px`);
    set(
      "--grid-opacity",
      `${Math.max(0, Math.min(1, (nextZoom - GRID_FADE_END) / (GRID_FADE_START - GRID_FADE_END)))}`,
    );
  }, []);

  /*
   * State setters that go through `applyViewport`, so a committed camera change
   * paints without waiting for React and the refs never fall behind. Functional
   * updates resolve against the ref, not the state — mid-gesture the ref is the
   * camera and the state is not.
   */
  const setPan = useCallback(
    (update: React.SetStateAction<Pan>) => {
      const next =
        typeof update === "function"
          ? (update as (previous: Pan) => Pan)(panRef.current)
          : update;
      applyViewport(next, zoomRef.current);
      setPanState(next);
    },
    [applyViewport],
  );
  const setZoom = useCallback(
    (update: React.SetStateAction<number>) => {
      const next =
        typeof update === "function"
          ? (update as (previous: number) => number)(zoomRef.current)
          : update;
      applyViewport(panRef.current, next);
      setZoomState(next);
    },
    [applyViewport],
  );

  const springsRef = useRef<{ x: Spring; y: Spring } | null>(null);
  const stopAnimationRef = useRef<(() => void) | null>(null);

  /**
   * The zoom level a screen reader hears. Continuous zoom changes many times a
   * second, so the announcement waits for the gesture to stop rather than
   * narrating every frame of it.
   */
  const [settledZoom, setSettledZoom] = useState(100);
  useEffect(() => {
    const timer = setTimeout(() => setSettledZoom(Math.round(zoom * 100)), 400);
    return () => clearTimeout(timer);
  }, [zoom]);

  const stopAnimation = useCallback(() => {
    stopAnimationRef.current?.();
    stopAnimationRef.current = null;
  }, []);

  /**
   * Springs a value pair from its current position to `target`, seeded with the
   * gesture's release velocity so there is no seam between drag and animation.
   */
  const animateTo = useCallback(
    (
      from: Vec,
      target: Vec,
      velocity: Vec,
      options: { damping: number; response: number },
      onFrame: (value: Vec) => void,
      onSettle?: (value: Vec) => void,
    ) => {
      stopAnimation();
      if (prefersReducedMotion()) {
        onFrame(target);
        onSettle?.(target);
        return;
      }
      // X and Y get independent springs; a single spring on 2D distance
      // desyncs whenever the two axes carry different velocities.
      const springX = new Spring(from.x, options);
      const springY = new Spring(from.y, options);
      springX.setTarget(target.x, velocity.x);
      springY.setTarget(target.y, velocity.y);
      springsRef.current = { x: springX, y: springY };
      stopAnimationRef.current = runFrameLoop((dt) => {
        const movingX = springX.step(dt);
        const movingY = springY.step(dt);
        const value = { x: springX.value, y: springY.value };
        onFrame(value);
        if (movingX || movingY) return true;
        springsRef.current = null;
        stopAnimationRef.current = null;
        onSettle?.(value);
        return false;
      });
    },
    [stopAnimation],
  );

  // Frame-varying — rebuilds (and re-renders TransformContext consumers) on
  // every zoom/pan/settledZoom change.
  const value = useMemo(
    () => ({ zoom, pan, settledZoom }),
    [zoom, pan, settledZoom],
  );

  // Stable — every member keeps its identity for the app's lifetime, so this
  // object is built exactly once and never causes a re-render downstream.
  const controls = useMemo(
    () => ({
      setZoom,
      setPan,
      applyViewport,
      viewportRef,
      panRef,
      zoomRef,
      springsRef,
      stopAnimationRef,
      stopAnimation,
      animateTo,
    }),
    [stopAnimation, animateTo, applyViewport, setPan, setZoom],
  );

  return (
    <TransformControlsContext.Provider value={controls}>
      <TransformContext.Provider value={value}>
        {children}
      </TransformContext.Provider>
    </TransformControlsContext.Provider>
  );
}
