import { useContext } from "react";
import {
  TransformContext,
  TransformControlsContext,
} from "@/app/components/designer/context/transform-context";

/**
 * The camera's current value. Changes on every frame of a pan, zoom or momentum
 * spring, so consume it only where the rendered output genuinely depends on it —
 * anything that merely *drives* the camera wants `useTransformControls`, which
 * never re-renders its consumer.
 */
export function useTransform() {
  const value = useContext(TransformContext);
  if (!value)
    throw new Error("useTransform must be used within TransformProvider");
  return value;
}

export function useTransformControls() {
  const value = useContext(TransformControlsContext);
  if (!value)
    throw new Error(
      "useTransformControls must be used within TransformProvider",
    );
  return value;
}
