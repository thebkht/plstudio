# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (pinned to `pnpm@11.0.9` via `packageManager`).

```bash
pnpm dev                      # Next dev server
pnpm build                    # next build --webpack (the --webpack flag is required)
pnpm typecheck                # tsc --noEmit
pnpm test                     # vitest run (node environment)
pnpm vitest run -t "detects normalization collisions"   # single test by name
pnpm vitest run tests/oracle.test.ts                    # single file
pnpm drizzle-kit push         # sync db/schema.ts to DATABASE_URL (no npm script exists)
```

`pnpm lint` is **broken** — it runs `next lint`, which Next 16 removed. Use `pnpm typecheck` instead, or fix the script if linting is needed.

The spec's definition of done (`docs/superpowers/specs/`) is: `pnpm test`, `pnpm build`, `pnpm typecheck`, and `git diff --check` all pass.

`DATABASE_URL` (Neon Postgres) is the only env var; without it the app still runs fully — only the `/api/projects` persistence layer returns 503.

## Architecture

An Oracle 12.2+ schema designer: a DrawSQL-style canvas where you draw tables, and the app generates Oracle DDL and PL/SQL CRUD packages.

**The domain model is the center of the app.** `app/lib/schema.ts` defines `Schema → Table → Column`, and everything else is a pure function over it:

- `app/lib/validation.ts` — `validateSchema()` returns `ValidationIssue[]`; enforces Oracle identifier rules (128-byte limit, reserved words, post-normalization collisions), per-type precision/size rules (`validateTypeSpec`), and a deliberately narrow CHECK-expression subset (`validateCheckExpression` rejects semicolons, DDL/DML keywords, unbalanced quotes).
- `app/lib/generators.ts` — `generateDDL()` / `generatePLSQL()` / `exportSchema()`.
- `app/lib/parser.ts` — `parseCreateTable()` imports a _subset_ of `CREATE TABLE` SQL back into a `Schema`, returning `{ schema, warnings, errors }`. It only round-trips what the generator emits; unsupported table-level constraints become warnings, not failures.

`normalizeIdentifier()` (uppercase, non-`[A-Z0-9_$#]` → `_`, numeric-leading prefixed `T_`) is applied at generation and validation time, not at edit time — users type freely and normalization happens on the way out. This is why collision detection compares _normalized_ names.

**Deliberate v1 constraints** — do not "fix" these without being asked:

- Foreign keys are single-column only. FKs targeting a composite-PK table are a validation error, and `generateDDL` silently skips them.
- `keyStrategy` is per-table: `"none"` | `"sequence-trigger"` (emits `CREATE SEQUENCE` + a `BEFORE INSERT` trigger) | `"identity"` (emits `GENERATED ALWAYS AS IDENTITY`, no sequence/trigger). Generated strategies require exactly one `NUMBER` PK; otherwise `keyStrategyArtifacts` returns nothing and validation warns.
- No table groups/categories in the domain model.

### UI

`app/components/Designer.tsx` (~1100 lines) is the whole client app — it owns schema state, selection, undo/redo history stacks, pointer-based drag/pan, zoom, and the export/import modals. `app/page.tsx` just mounts it. The spec assigns it sole ownership of state and command actions; sidebar/editor/canvas are presentation sections within it.

Canvas geometry constants (`TABLE_WIDTH = 236`, `HEADER_HEIGHT = 38`, `ROW_HEIGHT = 27`) are duplicated between `Designer.tsx` and `tableHeight()` in `schema.ts`. Relationship anchor routing depends on them matching — change both together.

Undo/redo: `commit(next)` pushes the _previous_ schema onto `history` (capped at 50) and clears `future`. Drags bypass `commit` (they mutate on every pointermove) and push history once on pointerup.

`app/globals.css` (~1000 lines) owns all workspace layout, light-mode materials, table-card styling, and responsive breakpoints. It supports `prefers-reduced-motion` and `prefers-reduced-transparency` — keep new styles consistent with that.

### Persistence

`app/api/projects/route.ts` + `db/schema.ts` (Drizzle, Neon serverless HTTP driver). The `projects` table stores the whole `Schema` as a `jsonb` blob alongside a mirrored `revision` and `schema_format_version`.

`PUT` implements optimistic concurrency: if the stored `revision` differs from the client's it returns **409 `REVISION_CONFLICT`** with the current row, unless `{ overwrite: true }` is passed. The new revision is `max(stored, incoming) + 1`. `SCHEMA_FORMAT_VERSION` (currently `1`) is stamped server-side on every write — bump it in `app/lib/schema.ts` when the JSON shape changes.

`getDb()` throws if `DATABASE_URL` is unset; every route catches and returns 503/400 rather than crashing.

## Conventions

- Path alias `@/*` maps to the repo root, configured in both `tsconfig.json` and `vitest.config.ts`.
- UI components come from shadcn with the `aria-vega` style and Base UI / react-aria-components underneath (`components.json`). Icon library is configured as `hugeicons`, but `Designer.tsx` currently imports from `lucide-react`.
- Tests live in `tests/` and target the pure domain layer (generators, parser, validation) — not the React tree.
- Code style is dense: single-line arrow functions and chained array methods over intermediate variables. Match it.
- Commit messages: no `Co-Authored-By` trailers.
