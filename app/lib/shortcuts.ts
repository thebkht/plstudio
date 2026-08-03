/**
 * The single source of truth for Designer keyboard shortcuts. The global key
 * handler, the menu-bar hints, and the shortcuts reference dialog all read this
 * table, so an advertised chord can never drift from the one that actually fires.
 *
 * Pure by design — no React, no DOM globals beyond the KeyboardEvent passed in.
 */

export type ShortcutId =
  | "save"
  | "export"
  | "import"
  | "share"
  | "undo"
  | "redo"
  | "addColumn"
  | "addTable"
  | "addGroup"
  | "addMemo"
  | "junction"
  | "deleteSelection"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "fitView"
  | "tidyLayout"
  | "toggleSidebar"
  | "shortcutsHelp";

export type ShortcutGroup = "File" | "Edit" | "Canvas" | "View";

/**
 * `key` is compared case-insensitively against `KeyboardEvent.key`. `mod` means
 * ⌘ on Apple platforms and Ctrl everywhere else. `shift: "any"` exists because
 * punctuation chords such as ⌘+ and ? require Shift on some layouts but not others.
 */
export type Chord = { key: string; mod?: boolean; shift?: boolean | "any" };

export type ShortcutDef = {
  id: ShortcutId;
  group: ShortcutGroup;
  label: string;
  /** Alternate accepted forms; the first is the one rendered in hints. */
  chords: Chord[];
  /** Suppressed on read-only share links. */
  mutating?: boolean;
  /** Fires even while a text field has focus. Modified chords always do. */
  allowWhileEditing?: boolean;
};

export const SHORTCUTS: ShortcutDef[] = [
  { id: "save", group: "File", label: "Save to database", chords: [{ key: "s", mod: true }], mutating: true },
  { id: "export", group: "File", label: "Export SQL", chords: [{ key: "e", mod: true }] },
  { id: "import", group: "File", label: "Import DDL", chords: [{ key: "i", mod: true }], mutating: true },
  { id: "share", group: "File", label: "Share project", chords: [{ key: "s", mod: true, shift: true }], mutating: true },
  { id: "undo", group: "Edit", label: "Undo", chords: [{ key: "z", mod: true }], mutating: true },
  { id: "redo", group: "Edit", label: "Redo", chords: [{ key: "z", mod: true, shift: true }, { key: "y", mod: true }], mutating: true },
  { id: "addColumn", group: "Edit", label: "Add column to selected table", chords: [{ key: "enter", mod: true }], mutating: true, allowWhileEditing: true },
  { id: "addTable", group: "Canvas", label: "Add table", chords: [{ key: "t" }], mutating: true },
  { id: "addGroup", group: "Canvas", label: "Add schema group", chords: [{ key: "g" }], mutating: true },
  { id: "addMemo", group: "Canvas", label: "Add memo", chords: [{ key: "m" }], mutating: true },
  { id: "junction", group: "Canvas", label: "Add junction table", chords: [{ key: "j" }], mutating: true },
  { id: "deleteSelection", group: "Canvas", label: "Delete selection", chords: [{ key: "delete" }, { key: "backspace" }], mutating: true },
  { id: "zoomIn", group: "View", label: "Zoom in", chords: [{ key: "+", mod: true, shift: "any" }, { key: "=", mod: true, shift: "any" }], allowWhileEditing: true },
  { id: "zoomOut", group: "View", label: "Zoom out", chords: [{ key: "-", mod: true, shift: "any" }, { key: "_", mod: true, shift: "any" }], allowWhileEditing: true },
  { id: "zoomReset", group: "View", label: "Reset zoom", chords: [{ key: "0", mod: true }], allowWhileEditing: true },
  { id: "fitView", group: "View", label: "Fit to screen", chords: [{ key: "1", shift: true }, { key: "!", shift: true }] },
  { id: "tidyLayout", group: "View", label: "Tidy up layout", chords: [{ key: "l", shift: true }], mutating: true },
  { id: "toggleSidebar", group: "View", label: "Show or hide side panel", chords: [{ key: ".", mod: true }] },
  { id: "shortcutsHelp", group: "View", label: "Keyboard shortcuts", chords: [{ key: "?", shift: "any" }, { key: "/", mod: true }] },
];

export const SHORTCUT_GROUPS: ShortcutGroup[] = ["File", "Edit", "Canvas", "View"];

const byId = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

export const shortcutById = (id: ShortcutId) => byId.get(id);

/** Apple platforms use ⌘ for `mod`; everything else uses Ctrl. */
export const isMacPlatform = () =>
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent || "");

/** True while focus sits in a text field, where bare-letter chords must not fire. */
export const isEditingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return (
    !!element?.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName ?? "")
  );
};

const chordMatches = (chord: Chord, event: KeyboardEvent, isMac: boolean) =>
  chord.key.toLowerCase() === event.key.toLowerCase() &&
  !!chord.mod === (isMac ? event.metaKey : event.ctrlKey) &&
  (isMac ? !event.ctrlKey : !event.metaKey) &&
  !event.altKey &&
  (chord.shift === "any" || !!chord.shift === event.shiftKey);

/**
 * Resolves a keydown to a shortcut id, or null when nothing matches or the chord
 * is unmodified while the user is typing.
 */
export const matchShortcut = (event: KeyboardEvent, isMac: boolean): ShortcutId | null => {
  const editing = isEditingTarget(event.target);
  const hit = SHORTCUTS.find((shortcut) =>
    shortcut.chords.some(
      (chord) =>
        chordMatches(chord, event, isMac) &&
        (!editing || !!chord.mod || !!shortcut.allowWhileEditing),
    ),
  );
  return hit?.id ?? null;
};

const KEY_LABEL: Record<string, { mac: string; other: string }> = {
  enter: { mac: "↵", other: "Enter" },
  delete: { mac: "⌫", other: "Del" },
  backspace: { mac: "⌫", other: "Backspace" },
  escape: { mac: "esc", other: "Esc" },
  "-": { mac: "−", other: "−" },
};

/**
 * The chord split into rendered tokens, for a `<Kbd>` per key. macOS orders
 * modifiers ⌃⌥⇧⌘; Windows and Linux lead with Ctrl.
 */
export const chordParts = (chord: Chord, isMac: boolean) => {
  const label = KEY_LABEL[chord.key.toLowerCase()];
  const key = label
    ? isMac
      ? label.mac
      : label.other
    : chord.key.length === 1
      ? chord.key.toUpperCase()
      : chord.key;
  const shift = chord.shift === true;
  return (
    isMac
      ? [shift && "⇧", chord.mod && "⌘", key]
      : [chord.mod && "Ctrl", shift && "Shift", key]
  ).filter(Boolean) as string[];
};

/** Renders a chord the way its platform writes it: "⇧⌘Z" on macOS, "Ctrl+Shift+Z" elsewhere. */
export const formatChord = (chord: Chord, isMac: boolean) =>
  chordParts(chord, isMac).join(isMac ? "" : "+");

export const shortcutHint = (id: ShortcutId, isMac: boolean) => {
  const chord = byId.get(id)?.chords[0];
  return chord ? formatChord(chord, isMac) : "";
};
