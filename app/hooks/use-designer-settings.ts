import { useContext } from "react";
import { SettingsContext } from "@/app/components/designer/context/settings-context";

export function useDesignerSettings() {
  const value = useContext(SettingsContext);
  if (!value)
    throw new Error("useDesignerSettings must be used within SettingsProvider");
  return value;
}
