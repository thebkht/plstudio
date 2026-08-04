# Designer Canvas Performance Refactor

## Goal

Make dragging, panning, typing, large schemas, and collaborative presence responsive without changing schema behavior or moving state ownership out of `Designer`.

## Constraints

- Preserve the current worktree and existing performance commits.
- `Designer` remains the sole owner of schema state, history, gestures, and command actions.
- Extracted components are presentation-only and receive primitive values, stable lookup results, and stable callbacks.
- Preserve undo/redo, drag-to-link, spring settling, pan bounds, zoom-at-cursor, keyboard navigation, context menus, collaboration highlighting/cursors, export behavior, and current edge routing.
- Leave shadcn components under `components/ui` unchanged.

## Design

### Part A: hot-path fixes

Complete and verify the existing targeted optimizations:

- Keep gesture callbacks stable with `useCallback`; read per-frame drag/resize state through refs so native window listeners attach once per gesture.
- Generate DDL and PL/SQL only while the export modal is open, and generate only the selected export tab. Combined output concatenates the already-computed strings.
- Cache the canvas bounding rectangle and invalidate it on resize, scroll, and canvas-size changes. Canvas pointer, drag, pan, and wheel paths read the cache.
- Use schema-keyed lookup maps for tables, foreign-key targets, and relationship counts. Use map/index values in render paths rather than nested `find`/`filter` scans.
- Keep `validateSchema` linear in table/column counts by indexing tables and columns once per validation.
- Coalesce remote awareness reads to one animation frame.
- Use `box-shadow` for table cards and disable dock backdrop blur during active gestures.

### Part B: memoized presentation boundaries

- Keep the existing memoized primitives and relationship edge extraction.
- Complete `TableCard` as a `React.memo` component. It receives the table record plus primitive geometry/state props, stable lookup callbacks, and stable command handlers. Handlers resolve current records by id in `Designer` rather than closing over table objects.
- Keep column rows memoized where their props permit it, so editing one column does not reconcile unrelated rows.
- Keep `RelationshipEdge` memoized and pass endpoint coordinates/directions and display strings as primitives. Its path computation is memoized on those values.
- Extract the column editor and the highest-impact sidebar/modal sections only when their props can remain stable. Export generation belongs inside or behind the mounted export boundary so it cannot run while the modal is absent.
- Render peer cursors through the isolated memoized presence component.

### Naming and documentation

After behavior is complete and verified, rename PascalCase component filenames to kebab-case with `git mv` in a separate commit. Update import sites and document the `app/components/designer/` layout, current `Designer` role, and kebab-case convention in `CLAUDE.md`.

## Verification

Run:

```bash
pnpm test
pnpm build
pnpm typecheck
git diff --check
```

Also inspect the diff for accidental broad rewrites and manually verify the gesture, collaboration, editor, export, and edge-routing behaviors listed above when a browser session is available.

## Completion criteria

No generator work occurs during ordinary edits while export is closed; native gesture listeners do not churn per frame; large-schema lookup paths are indexed; active gestures avoid expensive card shadows/backdrop blur; and a table drag can update the dragged card and connected edges without reconciling unrelated memoized cards/edges.
