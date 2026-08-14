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

export type TransformContextValue = {
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  pan: Pan;
  setPan: React.Dispatch<React.SetStateAction<Pan>>;
  /**
   * Mirrors of the two above. The canvas's long-lived pointer and wheel
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
  /** The zoom level a screen reader hears, settled so it is not narrated per frame. */
  settledZoom: number;
};

export const TransformContext = createContext<TransformContextValue | null>(
  null,
);

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

  const value = useMemo(
    () => ({
      zoom,
      setZoom,
      pan,
      setPan,
      panRef,
      zoomRef,
      springsRef,
      stopAnimationRef,
      stopAnimation,
      animateTo,
      settledZoom,
    }),
    [zoom, pan, stopAnimation, animateTo, settledZoom],
  );
  return (
    <TransformContext.Provider value={value}>
      {children}
    </TransformContext.Provider>
  );
}
