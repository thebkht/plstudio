"use client";

import { SHORTCUTS, SHORTCUT_GROUPS } from "@/app/lib/shortcuts";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useDesignerSettings } from "@/app/hooks";
import { ShortcutKeys } from "../../primitives";

export type ShortcutsModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly: boolean;
};

export function ShortcutsModal({
  isOpen,
  onOpenChange,
  readOnly,
}: ShortcutsModalProps) {
  const { isMac } = useDesignerSettings();
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl"
    >
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>
          {readOnly
            ? "Editing shortcuts are unavailable on a read-only link."
            : "Bare-letter shortcuts pause while you are typing in a field."}
        </DialogDescription>
      </DialogHeader>
      <div className="shortcut-sheet">
        {SHORTCUT_GROUPS.map((group) => (
          <section className="shortcut-group" key={group}>
            <h3 className="shortcut-group-title">{group}</h3>
            <dl className="shortcut-list">
              {SHORTCUTS.filter((shortcut) => shortcut.group === group).map(
                (shortcut) => (
                  <div
                    className="shortcut-row"
                    key={shortcut.id}
                    aria-disabled={shortcut.mutating && readOnly}
                  >
                    <dt>{shortcut.label}</dt>
                    <dd>
                      <ShortcutKeys id={shortcut.id} isMac={isMac} />
                    </dd>
                  </div>
                ),
              )}
            </dl>
          </section>
        ))}
        <section className="shortcut-group">
          <h3 className="shortcut-group-title">Selection</h3>
          <dl className="shortcut-list">
            <div className="shortcut-row">
              <dt>Clear selection</dt>
              <dd>
                <KbdGroup>
                  <Kbd>{isMac ? "esc" : "Esc"}</Kbd>
                </KbdGroup>
              </dd>
            </div>
            <div className="shortcut-row">
              <dt>Nudge the focused table</dt>
              <dd>
                <KbdGroup>
                  <Kbd>←</Kbd>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <Kbd>→</Kbd>
                </KbdGroup>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </Dialog>
  );
}
