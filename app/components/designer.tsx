"use client";

import Workspace, {
  type DesignerProps,
} from "@/app/components/designer/workspace";
import { SettingsProvider } from "@/app/components/designer/context/settings-context";

/**
 * The editor's entry point. This file is deliberately thin: it exists to mount
 * the provider stack around `Workspace`, mirroring drawdb's `pages/Editor.jsx`,
 * which is likewise provider-only. Everything with an opinion lives below it.
 *
 * Providers are added here as the state extraction proceeds; until then this is
 * a straight pass-through and `Workspace` still owns the state itself.
 */
export default function Designer(props: DesignerProps) {
  return (
    <SettingsProvider>
      <Workspace {...props} />
    </SettingsProvider>
  );
}
