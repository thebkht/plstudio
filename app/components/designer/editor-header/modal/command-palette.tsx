"use client";

/**
 * ⌘K: one search over every command, table and column, plus the column
 * templates for the selected table. The ranking is `rankPaletteItems`'s, so
 * react-aria's `Autocomplete` gets no `filter` and only supplies the keyboard
 * model -- typing stays in the field while ↑↓ move through the list.
 */

import { useMemo, useState } from "react";
import { Autocomplete, Menu, SearchField } from "react-aria-components";
import { ColumnsIcon, CommandIcon, LayoutTemplateIcon, SearchIcon, TableIcon, type LucideIcon } from "lucide-react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { BUILTIN_COLUMN_TEMPLATES } from "@/app/lib/schema";
import { paletteItems, rankPaletteItems, type PaletteItem } from "@/app/lib/palette";
import type { ShortcutId } from "@/app/lib/shortcuts";
import { useDesignerSettings, useSchema, useSelect } from "@/app/hooks";
import { ShortcutKeys } from "../../primitives";

export type CommandPaletteProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly: boolean;
  onRunCommand: (id: ShortcutId) => void;
  onJumpToTable: (tableId: string) => void;
};

const ICON: Record<PaletteItem["kind"], LucideIcon> = { command: CommandIcon, table: TableIcon, column: ColumnsIcon, template: LayoutTemplateIcon };

export function CommandPalette({ isOpen, onOpenChange, readOnly, onRunCommand, onJumpToTable }: CommandPaletteProps) {
  const { schema, applyTemplate } = useSchema();
  const { selectedId } = useSelect();
  const { isMac } = useDesignerSettings();
  const [query, setQuery] = useState("");
  const items = useMemo(() => paletteItems(schema, { readOnly, selectedTableId: selectedId }), [schema, readOnly, selectedId]);
  const ranked = useMemo(() => rankPaletteItems(items, query), [items, query]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };
  const run = (item: PaletteItem) => {
    // Closed first, so a command that opens a dialog of its own is not opened beneath this one.
    close();
    if (item.kind === "command") onRunCommand(item.shortcut);
    else if (item.kind === "template") {
      const template = [...BUILTIN_COLUMN_TEMPLATES, ...(schema.columnTemplates ?? [])].find((candidate) => candidate.id === item.templateId);
      if (template) applyTemplate(item.tableId, template);
    } else onJumpToTable(item.tableId);
  };

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => (open ? onOpenChange(true) : close())} showCloseButton={false} className="top-[20%] translate-y-0 gap-2 p-2 sm:max-w-xl">
      <DialogTitle className="sr-only">Search</DialogTitle>
      <Autocomplete inputValue={query} onInputChange={setQuery}>
        <SearchField autoFocus aria-label="Search commands, tables and columns">
          <InputGroup>
            <InputGroupInput placeholder="Search commands, tables and columns" className="[&::-webkit-search-cancel-button]:hidden" />
            <InputGroupAddon>
              <SearchIcon className="size-4 shrink-0 opacity-50" />
            </InputGroupAddon>
          </InputGroup>
        </SearchField>
        <Menu
          aria-label="Results"
          items={ranked}
          className="max-h-96 overflow-y-auto outline-none"
          renderEmptyState={() => <p className="px-3 py-6 text-center text-muted-foreground">Nothing matches.</p>}
          onAction={(key) => {
            const item = ranked.find((candidate) => candidate.id === key);
            if (item) run(item);
          }}
        >
          {(item) => {
            const Icon = ICON[item.kind];
            return (
              <DropdownMenuItem id={item.id} textValue={item.label}>
                <Icon />
                <span className={`min-w-0 flex-1 truncate ${item.kind === "command" || item.kind === "template" ? "" : "code-menu"}`}>{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.kind === "command" ? <ShortcutKeys id={item.shortcut} isMac={isMac} /> : item.detail}</span>
              </DropdownMenuItem>
            );
          }}
        </Menu>
      </Autocomplete>
    </Dialog>
  );
}
