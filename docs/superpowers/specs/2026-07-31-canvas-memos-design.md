# Canvas Memos Design

## Goal

Add DrawDB-style canvas memos to saved diagrams. A memo is a single editable text block that can be positioned beside tables and relationships to capture context, decisions, or implementation notes.

## Scope

Each memo supports:

- A single plain-text value.
- Dragging to reposition it on the canvas.
- Resizing with a visible corner handle.
- A small set of color themes matching the existing canvas palette.
- Deletion through a visible control and the Delete/Backspace key when selected.
- Persistence through the existing schema JSON, revisioning, autosave, and project loading.

Memos do not have separate title/body fields, rich text, markdown, comments, or collaboration-specific permissions in this iteration.

## Data model

Extend `Schema` with an optional `memos` collection for backward-compatible loading of existing projects. Each memo contains:

```ts
type Memo = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: MemoColor;
};
```

`MemoColor` is a finite union of named themes. New memos use a stable default size and theme. Loading normalizes missing or invalid memo values so older or manually edited project JSON cannot break the canvas.

## Interaction

- An `Add memo` action in the canvas toolbar creates a memo at a visible, non-overlapping position and selects it.
- The memo text is edited directly in a textarea. Empty text is allowed while editing, but an empty memo is removed when editing ends unless the user has entered content.
- Pointer dragging on the memo surface moves it without starting table dragging, canvas panning, or relationship linking.
- A resize handle changes width and height within minimum and maximum bounds. Resize updates remain responsive during the gesture and commit through the same dirty/autosave path as table movement.
- The selected memo exposes its color controls and delete affordance. Delete/Backspace removes the selected memo when focus is not inside the textarea.
- Clicking a table, relationship, or empty canvas clears memo selection as appropriate. Clicking inside a memo stops canvas-level gestures.
- Memo movement and resizing use the existing direct-manipulation interaction style and remain usable with keyboard focus. Reduced-motion preferences do not add animated transitions to editing or resizing.

## Visual treatment

Memos use a lightly tinted paper-like surface, a clear colored border, a subtle shadow, rounded corners, and a small top grip/toolbar area. The note remains readable over the dotted canvas. The selected state uses the existing blue focus treatment without obscuring the memo text. Color controls are compact and labeled for assistive technology.

## Persistence and compatibility

The existing project PUT endpoint already persists the complete schema JSON, so no database migration is required. The schema format version should remain compatible unless normalization requires a version bump. Existing projects without `memos` load with an empty collection. Memo changes mark the project dirty and use the existing autosave and conflict handling.

## Testing

- Schema tests cover memo defaults and normalization of missing/invalid collections.
- Component or interaction tests cover creation, direct text editing, move, resize, color change, deletion, and isolation from table/relationship gestures.
- Existing typecheck, unit tests, and production build must continue to pass.

## Out of scope

- Rich text or markdown rendering.
- Comments attached to tables or columns.
- Multi-user cursor presence or per-memo permissions.
- Searching/filtering memo text.
- Exporting memos into Oracle DDL.
