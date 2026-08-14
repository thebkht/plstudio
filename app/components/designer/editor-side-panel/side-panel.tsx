"use client";

import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  DatabaseIcon,
  GridViewIcon,
  Link01Icon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useLayout, useSchema } from "@/app/hooks";
import type { PanelMode, PanelTab } from "../constants";
import { CodeView } from "./code-view";
import { Issues } from "./issues";

export type SidePanelProps = {
  /** Count shown on the relationships tab and in the footer. */
  relationshipCount: number;
  tablesTab: ReactNode;
  relationshipsTab: ReactNode;
};

/**
 * The panel shell: the resize grip, the tab strip, and the footer that switches
 * between the structure tabs and the generated code. Which body is showing is
 * decided here, the way drawdb's SidePanel.jsx builds its tab array.
 */
export function SidePanel({
  relationshipCount,
  tablesTab,
  relationshipsTab,
}: SidePanelProps) {
  const { schema } = useSchema();
  const {
    isResizingSidebar,
    onSidebarResizeStart,
    resetSidebarWidth,
    panelTab,
    setPanelTab,
    panelMode,
    setPanelMode,
  } = useLayout();

  return (
    /* The sidebar sits below the app bar, not against the viewport top. */
    <Sidebar
      className="top-(--appbar-height) h-[calc(100svh-var(--appbar-height))]"
      aria-label="Diagram structure"
    >
      <div
        className={`sidebar-resizer ${isResizingSidebar ? "resizing" : ""}`}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar width"
        title="Drag to resize sidebar · Double-click to reset width"
        onPointerDown={onSidebarResizeStart}
        onDoubleClick={resetSidebarWidth}
      >
        <div className="sidebar-resizer-line" aria-hidden="true" />
      </div>
      <SidebarHeader className="panel-tabs">
        <SidebarTrigger aria-label="Hide side panel">
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </SidebarTrigger>
        <Tabs
          selectedKey={panelTab}
          onSelectionChange={(key) => setPanelTab(key as PanelTab)}
        >
          <TabsList variant="line">
            <TabsTrigger id="tables">
              Tables ({schema.tables.length})
            </TabsTrigger>
            <TabsTrigger id="relationships">
              Relationships ({relationshipCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </SidebarHeader>

      <SidebarContent>
        {panelMode === "code" ? (
          <CodeView />
        ) : panelTab === "tables" ? (
          tablesTab
        ) : (
          relationshipsTab
        )}
      </SidebarContent>

      <SidebarFooter className="p-0">
        <div className="panel-footer">
          <span className="counter">
            <HugeiconsIcon icon={DatabaseIcon} aria-hidden="true" />
            {schema.tables.length}
            <span className="sr-only">tables</span>
          </span>
          <span className="counter">
            <HugeiconsIcon icon={Link01Icon} aria-hidden="true" />
            {relationshipCount}
            <span className="sr-only">relationships</span>
          </span>
          <ToggleGroup
            aria-label="Panel view"
            size="sm"
            spacing={0}
            variant="outline"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[panelMode]}
            onSelectionChange={(keys) => {
              const [key] = [...keys];
              if (key) setPanelMode(key as PanelMode);
            }}
          >
            <ToggleGroupItem id="structure">
              <HugeiconsIcon icon={GridViewIcon} data-icon="inline-start" />
              Structure
            </ToggleGroupItem>
            <ToggleGroupItem id="code">
              <HugeiconsIcon icon={SourceCodeIcon} data-icon="inline-start" />
              Code
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Issues />
      </SidebarFooter>
    </Sidebar>
  );
}
