"use client";

import { memo as reactMemo, type PointerEvent as ReactPointerEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CursorRectangleSelectionIcon,
  DatabaseIcon,
  Delete02Icon,
  PaintBoardIcon,
  StickyNote01Icon,
  Table01Icon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GROUP_PALETTE, groupPrefix, type SchemaGroup } from "@/app/lib/schema";
import { keywordHint, resizeDelta } from "../geometry";

export type SchemaGroupCardProps = {
  group: SchemaGroup;
  /** On-screen box: the in-flight drag/resize values while a gesture is live. */
  position: { x: number; y: number; width: number; height: number };
  isSelected: boolean;
  inMultiSelection: boolean;
  isMoving: boolean;
  /** How many tables in this group do not yet carry its keyword prefix. */
  pendingPrefix: number;
  readOnly: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onHeadPointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    group: SchemaGroup,
  ) => void;
  onResizePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    group: SchemaGroup,
  ) => void;
  onContextOpen: () => void;
  onPatch: (id: string, patch: Partial<SchemaGroup>) => void;
  onDelete: (id: string) => void;
  onAddTable: (groupId: string) => void;
  onAddMemo: (groupId: string) => void;
  onSelectMembers: (groupId: string) => void;
  onApplyKeyword: (groupId: string) => void;
  onResizeCommit: (id: string, width: number, height: number) => void;
};

function SchemaGroupCardComponent({
  group,
  position,
  isSelected,
  inMultiSelection,
  isMoving,
  pendingPrefix,
  readOnly,
  onPointerDown,
  onHeadPointerDown,
  onResizePointerDown,
  onContextOpen,
  onPatch,
  onDelete,
  onAddTable,
  onAddMemo,
  onSelectMembers,
  onApplyKeyword,
  onResizeCommit,
}: SchemaGroupCardProps) {
  const palette = GROUP_PALETTE[group.color];
  const prefix = groupPrefix(group);
  return (
    /*
     * Outside the section, not inside it: the trigger renders as a
     * `display: contents` wrapper, so a right-click anywhere in the group's own
     * box — which is the section's element, not a descendant — would never
     * reach a handler mounted underneath it.
     */
    <ContextMenuTrigger onOpenChange={(open) => open && onContextOpen()}>
    <section
      className={`schema-group ${isSelected ? "selected" : ""} ${inMultiSelection ? "multi-selected" : ""} ${isMoving ? "moving" : ""}`}
      role="group"
      aria-label={`Schema group ${group.name}`}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: position.width,
        height: position.height,
        background: palette.background,
        borderColor: palette.border,
        zIndex: 0,
      }}
      onPointerDown={onPointerDown}
    >
        <div
          className="schema-group-head"
          style={{
            background: palette.header,
            color: palette.text,
            borderColor: palette.border,
          }}
          onPointerDown={(event) => onHeadPointerDown(event, group)}
        >
          <HugeiconsIcon icon={DatabaseIcon} size={15} aria-hidden="true" />
          {/* Ahead of the name, in the order it reads on the cards below. */}
          <input
            className="schema-group-keyword"
            aria-label={`Table name prefix for schema group ${group.name}`}
            value={group.keyword ?? ""}
            placeholder={keywordHint(group.name)}
            maxLength={12}
            size={1}
            spellCheck={false}
            disabled={readOnly}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) =>
              onPatch(group.id, { keyword: event.target.value })
            }
          />
          <input
            className="schema-group-name"
            aria-label={`Name of schema group ${group.name}`}
            value={group.name}
            disabled={readOnly}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onPatch(group.id, { name: event.target.value })}
          />
          <div
            className="schema-group-actions"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <ToggleGroup
              aria-label="Group color"
              selectionMode="single"
              disallowEmptySelection
              isDisabled={readOnly}
              selectedKeys={[group.color]}
              onSelectionChange={(keys) => {
                const [key] = [...keys];
                if (key)
                  onPatch(group.id, { color: key as SchemaGroup["color"] });
              }}
            >
              {Object.entries(GROUP_PALETTE).map(([color, option]) => (
                <ToggleGroupItem
                  key={color}
                  id={color}
                  className="schema-group-color"
                  aria-label={`Use ${color} group color`}
                  style={{ background: option.border }}
                />
              ))}
            </ToggleGroup>
            <TooltipTrigger>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete schema group ${group.name}`}
                isDisabled={readOnly}
                onClick={() => onDelete(group.id)}
              >
                <HugeiconsIcon icon={Delete02Icon} />
              </Button>
              <Tooltip>Delete group</Tooltip>
            </TooltipTrigger>
          </div>
        </div>
        <ContextMenu className="w-auto">
          <ContextMenuLabel>{group.name}</ContextMenuLabel>
          <ContextMenuGroup>
            <ContextMenuItem
              isDisabled={readOnly}
              onAction={() => onAddTable(group.id)}
            >
              <HugeiconsIcon icon={Table01Icon} />
              Add table to this schema
            </ContextMenuItem>
            <ContextMenuItem
              isDisabled={readOnly}
              onAction={() => onAddMemo(group.id)}
            >
              <HugeiconsIcon icon={StickyNote01Icon} />
              Add memo to this schema
            </ContextMenuItem>
            <ContextMenuItem onAction={() => onSelectMembers(group.id)}>
              <HugeiconsIcon icon={CursorRectangleSelectionIcon} />
              {/* It selects the memos and the rectangle too, so it cannot
                  claim to select only the tables. */}
              Select everything in this schema
            </ContextMenuItem>
            {/* Same selection API as the header's swatches, driving the same
                `onPatch` — one code path, two ways in, so the two cannot
                disagree, and both show which colour is currently on. */}
            <ContextMenuSub>
              <ContextMenuSubTrigger isDisabled={readOnly}>
                <HugeiconsIcon icon={PaintBoardIcon} />
                Color
                <span
                  className="schema-group-color-dot ml-auto"
                  style={{ background: palette.border }}
                  aria-hidden="true"
                />
              </ContextMenuSubTrigger>
              <ContextMenuSubContent
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[group.color]}
                onSelectionChange={(keys) => {
                  const [key] = [...keys];
                  if (key) onPatch(group.id, { color: key as SchemaGroup["color"] });
                }}
              >
                {Object.entries(GROUP_PALETTE).map(([color, option]) => (
                  <ContextMenuItem key={color} id={color}>
                    <span
                      className="schema-group-color-dot"
                      style={{ background: option.border }}
                      aria-hidden="true"
                    />
                    {color[0].toUpperCase()}{color.slice(1)}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem
              isDisabled={readOnly || !pendingPrefix}
              onAction={() => onApplyKeyword(group.id)}
            >
              <HugeiconsIcon icon={Tag01Icon} />
              {/* Disabled rows still have to say what they mean: "Prefix no
                  tables with MLL_" reads as an action nobody asked for, where
                  the real message is that there is nothing left to do. */}
              {!prefix
                ? "Set a keyword to prefix tables"
                : pendingPrefix
                  ? `Prefix ${pendingPrefix} ${pendingPrefix === 1 ? "table" : "tables"} with ${prefix}`
                  : `Every table already carries ${prefix}`}
            </ContextMenuItem>
          </ContextMenuGroup>
          <ContextMenuSeparator />
          <ContextMenuGroup>
            <ContextMenuItem
              variant="destructive"
              isDisabled={readOnly}
              onAction={() => onDelete(group.id)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
              Delete schema group
            </ContextMenuItem>
          </ContextMenuGroup>
        </ContextMenu>
      <button
        type="button"
        className="schema-group-resize"
        aria-label={`Resize schema group ${group.name}. Arrow keys resize, Shift for larger steps.`}
        disabled={readOnly}
        onPointerDown={(event) => onResizePointerDown(event, group)}
        onKeyDown={(event) => {
          const delta = resizeDelta(event);
          if (!delta) return;
          event.preventDefault();
          event.stopPropagation();
          onResizeCommit(
            group.id,
            position.width + delta[0],
            position.height + delta[1],
          );
        }}
      />
    </section>
    </ContextMenuTrigger>
  );
}

export const SchemaGroupCard = reactMemo(SchemaGroupCardComponent);
