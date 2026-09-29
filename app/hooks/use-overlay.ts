import { useContext } from "react";
import { OverlayContext } from "@/app/components/designer/context/overlay-context";

export function useOverlay() {
  const value = useContext(OverlayContext);
  if (!value) throw new Error("useOverlay must be used within OverlayProvider");
  return value;
}
