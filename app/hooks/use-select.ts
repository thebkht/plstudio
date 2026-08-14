import { useContext } from "react";
import { SelectContext } from "@/app/components/designer/context/select-context";

export function useSelect() {
  const value = useContext(SelectContext);
  if (!value) throw new Error("useSelect must be used within SelectProvider");
  return value;
}
