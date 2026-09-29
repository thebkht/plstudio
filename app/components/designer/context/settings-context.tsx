"use client";

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isMacPlatform } from "@/app/lib/shortcuts";
import { CARD_STYLES, type CardStyle } from "@/app/lib/schema";

export type DesignerSettings = {
  showCardinality: boolean;
  showRelationshipLabels: boolean;
  /** Whether pointing at or selecting a table fades everything a foreign key
   *  away from it. On by default: it is what makes a dense diagram legible. */
  dimUnrelated: boolean;
  autoSave: boolean;
  showMinimap: boolean;
  /** How tables are drawn on this user's canvas; the export is always `document`. */
  cardStyle: CardStyle;
};

const DEFAULT_SETTINGS: DesignerSettings = {
  showCardinality: true,
  showRelationshipLabels: true,
  dimUnrelated: false,
  autoSave: false,
  showMinimap: true,
  cardStyle: "classic",
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
        setSettings((current) => {
          const next = { ...current, ...JSON.parse(saved) };
          // Card geometry depends on it, so a value from a future build falls back rather than through.
          return CARD_STYLES.includes(next.cardStyle) ? next : { ...next, cardStyle: current.cardStyle };
        });
    } catch {
      /* Ignore malformed local settings. */
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("plstudio-settings", JSON.stringify(settings));
  }, [settings]);

  const value = useMemo(
    () => ({ settings, setSettings, isMac }),
    [settings, isMac],
  );
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
