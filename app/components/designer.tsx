"use client";

import Workspace, {
  type DesignerProps,
} from "@/app/components/designer/workspace";
import { SettingsProvider } from "@/app/components/designer/context/settings-context";
import { LayoutProvider } from "@/app/components/designer/context/layout-context";
import { SelectProvider } from "@/app/components/designer/context/select-context";
import { TransformProvider } from "@/app/components/designer/context/transform-context";
import { SaveStateProvider } from "@/app/components/designer/context/save-state-context";
import { SchemaProvider } from "@/app/components/designer/context/schema-context";
import { CanvasCommandsProvider } from "@/app/components/designer/context/canvas-commands-context";

/**
 * The editor's entry point. This file is deliberately thin: it exists to mount
 * the provider stack around `Workspace`, mirroring drawdb's `pages/Editor.jsx`,
 * which is likewise provider-only. Everything with an opinion lives below it.
 *
 * Order is a dependency order, not a preference: `SchemaProvider` reads the
 * panel mode from `LayoutProvider` and marks the document dirty through
 * `SaveStateProvider`, so it is mounted innermost. The gesture state that
 * changes every frame is deliberately *not* here — it belongs to the canvas
 * alone, and hoisting it would re-render the appbar and side panel on every
 * pointermove.
 */
export default function Designer(props: DesignerProps) {
  const { initialSchema, projectId, workspaceSlug, shareToken, readOnly, user } =
    props;
  return (
    <SettingsProvider>
      <LayoutProvider>
        <SelectProvider>
          <TransformProvider>
            <SaveStateProvider>
              <SchemaProvider
                initialSchema={initialSchema}
                projectId={projectId}
                workspaceSlug={workspaceSlug}
                shareToken={shareToken}
                readOnly={readOnly ?? false}
                user={user}
              >
                <CanvasCommandsProvider>
                  <Workspace {...props} />
                </CanvasCommandsProvider>
              </SchemaProvider>
            </SaveStateProvider>
          </TransformProvider>
        </SelectProvider>
      </LayoutProvider>
    </SettingsProvider>
  );
}
