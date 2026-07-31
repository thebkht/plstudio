# DrawSQL-style Oracle designer workspace

## Goal

Rework the existing Oracle PL/SQL schema designer into a light, DrawSQL-inspired workspace while preserving the current schema model, Oracle validation, import/export, package generation, undo/redo, and pointer-based canvas interactions.

## Scope

This pass adds a persistent flat table navigator and improves the visual relationship between navigation, canvas, and table editing. It does not add table groups or categories to the domain model.

## Layout

- A blue/purple top navigation bar contains the product identity, schema context, and primary actions.
- A persistent left `Tables` sidebar contains search, a flat table list, selected state, and add-table action.
- The main workspace is a light dotted canvas containing draggable table cards and relationship lines.
- Table cards use compact white surfaces with colored headers, readable column/type rows, and a selected outline.
- Canvas controls sit in a fixed bottom-right control cluster for zoom, fit, tidy-up, and related actions.
- The sidebar and canvas have independent scrolling behavior.

## Selection and editing

- Selecting a table from the sidebar or canvas selects the same domain table, highlights its node, and opens the existing editor panel on the left.
- Closing the editor preserves selection and returns visual focus to the canvas.
- The editor remains closable, scroll-contained, and responsive; it must not create horizontal overflow.
- On narrow screens, the sidebar becomes a compact drawer and the editor becomes a full-width sheet with a clear close action.
- Search filters the flat table list by table name only.

## Component responsibilities

- `Designer.tsx` owns schema state, selection, drag handling, and command actions.
- A sidebar presentation section renders search, table navigation, and selection callbacks.
- The existing editor presentation renders table settings and column controls, with styling/layout changes only.
- A canvas presentation section renders grid, relationships, nodes, selection state, and controls.
- `app/globals.css` owns workspace layout, light materials, compact table cards, responsive breakpoints, and focus/selection states.
- `app/lib/schema.ts`, validation, parser, generators, and persistence remain unchanged unless a test reveals a regression.

## Interaction details

- Existing pointer capture is retained for direct 1:1 table dragging.
- Sidebar/editor controls must not initiate canvas dragging.
- Selected table rows use a blue-tinted surface and selected canvas nodes use a visible outline.
- Canvas controls remain fixed to the viewport rather than moving with the diagram.
- Reduced-motion and reduced-transparency preferences remain supported.

## Acceptance criteria

1. The light workspace clearly presents a persistent table sidebar and dotted diagram canvas.
2. Sidebar and canvas selection open the same table editor and preserve selection when the editor closes.
3. Sidebar search filters the table list without changing schema data.
4. Table dragging, relationship rendering, zoom/pan, tidy-up, import/export, and undo/redo continue to work.
5. The editor and sidebar do not cause horizontal overflow at desktop or narrow widths.
6. No table-group fields or grouping behavior are added to the domain model.
7. `pnpm test`, `pnpm build`, `pnpm typecheck`, and `git diff --check` pass.

## Test plan

- Add focused component checks for sidebar selection, search filtering, editor close, and narrow-layout containment if the project’s current test setup supports them.
- Keep existing Oracle domain/generator tests unchanged and green.
- Manually verify pointer dragging after the sidebar is introduced.
- Manually verify export/import output is unchanged for the acceptance schema.

