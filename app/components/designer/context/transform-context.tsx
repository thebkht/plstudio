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
   * Mirrors of pan/zoom. The canvas's long-lived pointer and wheel
   * listeners read these so they never re-subscribe mid-gesture.
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

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
      panRef,
      zoomRef,
      springsRef,
      stopAnimationRef,
      stopAnimation,
      animateTo,
    }),
    [stopAnimation, animateTo],
  );

  return (
    <TransformControlsContext.Provider value={controls}>
      <TransformContext.Provider value={value}>
        {children}
      </TransformContext.Provider>
    </TransformControlsContext.Provider>
  );
}
