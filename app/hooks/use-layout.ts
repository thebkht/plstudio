import { useContext } from "react";
import { LayoutContext } from "@/app/components/designer/context/layout-context";

export function useLayout() {
  const value = useContext(LayoutContext);
  if (!value) throw new Error("useLayout must be used within LayoutProvider");
  return value;
}
