import { useContext } from "react";
import { SaveStateContext } from "@/app/components/designer/context/save-state-context";

export function useSaveState() {
  const value = useContext(SaveStateContext);
  if (!value)
    throw new Error("useSaveState must be used within SaveStateProvider");
  return value;
}
