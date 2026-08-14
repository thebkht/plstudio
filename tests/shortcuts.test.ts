import { describe, expect, it } from "vitest";
import {
  SHORTCUTS,
  formatChord,
  isEditingTarget,
  matchShortcut,
  shortcutHint,
} from "@/app/lib/shortcuts";

/** The suite runs in the node environment, so events and targets are structural stand-ins. */
const press = (
  key: string,
  modifiers: Partial<Record<"meta" | "ctrl" | "shift" | "alt", boolean>> = {},
  target: unknown = { tagName: "DIV" },
) =>
  ({
    key,
    metaKey: !!modifiers.meta,
    ctrlKey: !!modifiers.ctrl,
    shiftKey: !!modifiers.shift,
    altKey: !!modifiers.alt,
    target,
  }) as unknown as KeyboardEvent;

describe("modifier resolution", () => {
  it("treats ⌘ as the modifier on macOS", () => {
    expect(matchShortcut(press("s", { meta: true }), true)).toBe("save");
    expect(matchShortcut(press("s", { ctrl: true }), true)).toBeNull();
  });

  it("treats Ctrl as the modifier everywhere else", () => {
    expect(matchShortcut(press("s", { ctrl: true }), false)).toBe("save");
    expect(matchShortcut(press("s", { meta: true }), false)).toBeNull();
  });

  it("ignores chords held with Alt", () => {
    expect(matchShortcut(press("s", { meta: true, alt: true }), true)).toBeNull();
  });

  it("separates Shift variants of the same key", () => {
    expect(matchShortcut(press("z", { meta: true }), true)).toBe("undo");
    expect(matchShortcut(press("z", { meta: true, shift: true }), true)).toBe("redo");
    expect(matchShortcut(press("s", { meta: true, shift: true }), true)).toBe("share");
  });

  it("matches keys case-insensitively, since Shift uppercases them", () => {
    expect(matchShortcut(press("L", { shift: true }), true)).toBe("tidyLayout");
  });
});

describe("typing suppression", () => {
  const input = { tagName: "INPUT" };
  const editable = { tagName: "DIV", isContentEditable: true };

  it("recognises fields that swallow bare keys", () => {
    expect(isEditingTarget(input as unknown as EventTarget)).toBe(true);
    expect(isEditingTarget(editable as unknown as EventTarget)).toBe(true);
    expect(isEditingTarget({ tagName: "DIV" } as unknown as EventTarget)).toBe(false);
  });

  it("drops bare-key chords while a field has focus", () => {
    expect(matchShortcut(press("t"), true)).toBe("addTable");
    expect(matchShortcut(press("t", {}, input), true)).toBeNull();
    expect(matchShortcut(press("Delete", {}, input), true)).toBeNull();
    expect(matchShortcut(press("?", { shift: true }, editable), true)).toBeNull();
  });

  it("keeps modified chords alive while typing", () => {
    expect(matchShortcut(press("s", { meta: true }, input), true)).toBe("save");
  });

  it("keeps ⌘↵ alive while typing, since it acts on the selected table", () => {
    expect(matchShortcut(press("Enter", { meta: true }, input), true)).toBe("addColumn");
  });

  it("yields ⌘A, ⌘C and ⌘V back to the field they were pressed in", () => {
    expect(matchShortcut(press("a", { meta: true }), true)).toBe("selectAll");
    expect(matchShortcut(press("c", { meta: true }), true)).toBe("copySelectionSql");
    expect(matchShortcut(press("c", { meta: true, shift: true }), true)).toBe("copySelectionJson");
    expect(matchShortcut(press("v", { meta: true }), true)).toBe("pasteSelection");
    // Selecting and copying text inside an input has to keep working.
    expect(matchShortcut(press("a", { meta: true }, input), true)).toBeNull();
    expect(matchShortcut(press("c", { meta: true }, input), true)).toBeNull();
    expect(matchShortcut(press("c", { meta: true, shift: true }, editable), true)).toBeNull();
    expect(matchShortcut(press("v", { meta: true }, input), true)).toBeNull();
    // Everything else modified still fires there.
    expect(matchShortcut(press("s", { meta: true }, input), true)).toBe("save");
  });
});

describe("layout-dependent chords", () => {
  it("accepts both forms of zoom in and zoom out", () => {
    expect(matchShortcut(press("+", { meta: true, shift: true }), true)).toBe("zoomIn");
    expect(matchShortcut(press("=", { meta: true }), true)).toBe("zoomIn");
    expect(matchShortcut(press("-", { meta: true }), true)).toBe("zoomOut");
    expect(matchShortcut(press("_", { meta: true, shift: true }), true)).toBe("zoomOut");
  });

  it("accepts Shift+1 whether the layout reports 1 or !", () => {
    expect(matchShortcut(press("1", { shift: true }), true)).toBe("fitView");
    expect(matchShortcut(press("!", { shift: true }), true)).toBe("fitView");
  });

  it("opens help from either ? or ⌘/", () => {
    expect(matchShortcut(press("?", { shift: true }), true)).toBe("shortcutsHelp");
    expect(matchShortcut(press("/", { meta: true }), true)).toBe("shortcutsHelp");
  });

  it("leaves an unmodified digit alone so it can reach the canvas", () => {
    expect(matchShortcut(press("1"), true)).toBeNull();
  });
});

describe("hint rendering", () => {
  it("writes macOS chords as glyphs in ⌃⌥⇧⌘ order", () => {
    expect(shortcutHint("save", true)).toBe("⌘S");
    expect(shortcutHint("redo", true)).toBe("⇧⌘Z");
    expect(shortcutHint("fitView", true)).toBe("⇧1");
    expect(shortcutHint("addColumn", true)).toBe("⌘↵");
  });

  it("spells chords out elsewhere", () => {
    expect(shortcutHint("save", false)).toBe("Ctrl+S");
    expect(shortcutHint("redo", false)).toBe("Ctrl+Shift+Z");
    expect(shortcutHint("fitView", false)).toBe("Shift+1");
  });

  it("ignores an optional Shift when rendering punctuation", () => {
    expect(formatChord({ key: "?", shift: "any" }, true)).toBe("?");
    expect(shortcutHint("zoomOut", true)).toBe("⌘−");
  });
});

describe("the table itself", () => {
  it("gives every shortcut at least one chord and a unique id", () => {
    expect(SHORTCUTS.every((shortcut) => shortcut.chords.length > 0)).toBe(true);
    expect(new Set(SHORTCUTS.map((shortcut) => shortcut.id)).size).toBe(SHORTCUTS.length);
  });

  it("never binds the same chord twice", () => {
    const keys = SHORTCUTS.flatMap((shortcut) =>
      shortcut.chords.map((chord) => `${chord.mod ? "mod+" : ""}${chord.shift === true ? "shift+" : ""}${chord.key.toLowerCase()}`),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
