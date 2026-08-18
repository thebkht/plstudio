"use client";

import { memo as reactMemo, type PointerEvent as ReactPointerEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, StickyNote01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Memo, MemoColor } from "@/app/lib/schema";
import { MEMO_COLORS } from "../constants";
import { resizeDelta } from "../geometry";

export type MemoCardProps = {
  memo: Memo;
  /** On-screen box: the in-flight drag/resize values while a gesture is live. */
  position: { x: number; y: number; width: number; height: number };
  isSelected: boolean;
  inMultiSelection: boolean;
  isEditing: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>, memo: Memo) => void;
  onResizePointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    memo: Memo,
  ) => void;
  onSelect: () => void;
  onClick: (event: React.MouseEvent) => void;
  onPatch: (id: string, patch: Partial<Memo>) => void;
  onDelete: (id: string) => void;
  onResizeCommit: (id: string, width: number, height: number) => void;
  onFocusText: () => void;
  onBlurText: () => void;
  onChangeText: (value: string) => void;
};

function MemoCardComponent({
  memo,
  position,
  isSelected,
  inMultiSelection,
  isEditing,
  onPointerDown,
  onResizePointerDown,
  onClick,
  onPatch,
  onDelete,
  onResizeCommit,
  onFocusText,
  onBlurText,
  onChangeText,
}: MemoCardProps) {
  const color =
    MEMO_COLORS.find((item) => item.id === memo.color) ?? MEMO_COLORS[0];
  return (
    <article
      className={`memo-card ${isSelected ? "selected" : ""} ${inMultiSelection ? "multi-selected" : ""}`}
      data-memo-id={memo.id}
      role="group"
      tabIndex={0}
      aria-label="Memo"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width: position.width,
        height: position.height,
        background: color.background,
        borderColor: color.border,
        zIndex: isSelected ? 4 : 1,
      }}
      onPointerDown={(event) => onPointerDown(event, memo)}
      onClick={onClick}
      onKeyDown={(event) => {
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          event.preventDefault();
          // The window handler would delete it a second time and split the undo step.
          event.stopPropagation();
          onDelete(memo.id);
        }
      }}
    >
      <div
        className="memo-toolbar"
        onPointerDown={(event) => onPointerDown(event, memo)}
      >
        <HugeiconsIcon icon={StickyNote01Icon} size={14} aria-hidden="true" />
        <div
          className="memo-actions"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <ToggleGroup
            aria-label="Memo color"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[memo.color]}
            onSelectionChange={(keys) => {
              const [key] = [...keys];
              if (key) onPatch(memo.id, { color: key as MemoColor });
            }}
          >
            {MEMO_COLORS.map((option) => (
              <ToggleGroupItem
                key={option.id}
                id={option.id}
                className={`memo-color memo-color-${option.id}`}
                aria-label={`Use ${option.label} memo color`}
              />
            ))}
          </ToggleGroup>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete memo"
              onClick={() => onDelete(memo.id)}
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
            <Tooltip>Delete memo</Tooltip>
          </TooltipTrigger>
        </div>
      </div>
      <textarea
        className="memo-text"
        value={memo.text}
        aria-label="Memo text"
        placeholder="Write a memo..."
        onFocus={onFocusText}
        onChange={(event) => onChangeText(event.target.value)}
        onBlur={onBlurText}
        onPointerDown={(event) => event.stopPropagation()}
      />
      <button
        type="button"
        className="memo-resize"
        aria-label="Resize memo. Arrow keys resize, Shift for larger steps."
        onPointerDown={(event) => onResizePointerDown(event, memo)}
        onKeyDown={(event) => {
          const delta = resizeDelta(event);
          if (!delta) return;
          event.preventDefault();
          event.stopPropagation();
          onResizeCommit(
            memo.id,
            position.width + delta[0],
            position.height + delta[1],
          );
        }}
      />
      {isEditing && <span className="memo-edit-hint">Editing</span>}
    </article>
  );
}

export const MemoCard = reactMemo(MemoCardComponent);
