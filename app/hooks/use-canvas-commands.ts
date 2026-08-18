import { useContext } from "react";
import { CanvasCommandsContext } from "@/app/components/designer/context/canvas-commands-context";

/**
 * The canvas' command surface. The value is created once, so consuming this
 * never re-renders anything — which is the whole point of it existing.
 */
export function useCanvasCommands() {
  const value = useContext(CanvasCommandsContext);
  if (!value)
    throw new Error(
      "useCanvasCommands must be used within CanvasCommandsProvider",
    );
  return value;
}
