"use client";

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isMacPlatform } from "@/app/lib/shortcuts";

export type DesignerSettings = {
  showCardinality: boolean;
  showRelationshipLabels: boolean;
  /** Whether pointing at or selecting a table fades everything a foreign key
   *  away from it. On by default: it is what makes a dense diagram legible. */
  dimUnrelated: boolean;
  autoSave: boolean;
};

const DEFAULT_SETTINGS: DesignerSettings = {
  showCardinality: true,
  showRelationshipLabels: true,
  dimUnrelated: true,
  autoSave: false,
};

export type SettingsContextValue = {
  settings: DesignerSettings;
  setSettings: React.Dispatch<React.SetStateAction<DesignerSettings>>;
  /**
   * Chord glyphs differ per platform, and the platform is unknowable during SSR —
   * so this settles after mount rather than during render, to keep hydration clean.
   */
  isMac: boolean;
};

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DesignerSettings>(DEFAULT_SETTINGS);
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(isMacPlatform()), []);

  useEffect(() => {
    try {
      const saved =
        window.localStorage.getItem("plstudio-settings") ||
        window.localStorage.getItem("drawsql-settings");
      if (saved)
        setSettings((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch {
      /* Ignore malformed local settings. */
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("plstudio-settings", JSON.stringify(settings));
  }, [settings]);

  const value = useMemo(() => ({ settings, setSettings, isMac }), [
    settings,
    isMac,
  ]);
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
