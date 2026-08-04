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
pnpm drizzle-kit push         # create the auth tables in <DATA_DIR>/auth.db (no npm script exists)
```

`pnpm lint` is **broken** — it runs `next lint`, which Next 16 removed. Use `pnpm typecheck` instead, or fix the script if linting is needed.

The spec's definition of done (`docs/superpowers/specs/`) is: `pnpm test`, `pnpm build`, `pnpm typecheck`, and `git diff --check` all pass.

There is **no database server**. `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are required; `DATA_DIR` (default `./data`) is where everything durable lives. Auth opens its SQLite file at module load, so importing `app/lib/auth.ts` creates `<DATA_DIR>/auth.db` as a side effect.

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

Canvas geometry (`TABLE_WIDTH`, `TABLE_COLOR_STRIP_HEIGHT`, `TABLE_HEADER_HEIGHT`, `TABLE_FIELD_HEIGHT`) is defined once in `app/lib/schema.ts` alongside `tableHeight()`, and imported by `Designer.tsx`. Relationship anchors are derived from these — if the card's visual layout changes, update the constants rather than hardcoding new offsets.

Undo/redo: `commit(next)` pushes the _previous_ schema onto `history` (capped at 50) and clears `future`.

Canvas gestures live in `app/lib/motion.ts` (pure, tested): `Spring` (analytic damped oscillator, re-targetable mid-flight), `VelocityTracker`, `project()` for momentum, `rubberClamp()` for soft bounds. Drags do **not** write to `schema` per frame — the live position sits in `dragPosition` state and is committed once on release, so `validateSchema`/`generateDDL` don't rerun every pointermove. Anything reading a table's on-screen position must go through `livePosition(table)`, not `table.x/y`.

Wheel handling is attached natively with `{ passive: false }` because React registers `wheel` passively, which silently no-ops `preventDefault`. Scroll pans; ctrl/⌘-scroll zooms anchored at the cursor.

`app/globals.css` (~1000 lines) owns all workspace layout, light-mode materials, table-card styling, and responsive breakpoints. It supports `prefers-reduced-motion` and `prefers-reduced-transparency` — keep new styles consistent with that.

### Persistence

Everything durable lives under `DATA_DIR` (default `./data`), resolved once in `db/paths.ts` so the web app, the collab server and `drizzle.config.ts` cannot drift:

```
<DATA_DIR>/auth.db                    SQLite — Better Auth tables only (db/schema.ts)
<DATA_DIR>/projects/<ownerId>/<projectId>.json   one ProjectRecord each
<DATA_DIR>/yjs/<projectId>.bin                   raw Yjs update log
<DATA_DIR>/shares/<tokenHash>.json               share links
```

`ownerId` is `organizationId ?? createdBy ?? "_unowned"` (`ownerSegment()`). Callers still address a project by **id alone** — a share link is opened by a non-owner and the collab server knows only the document name — so the store resolves id → owner itself by scanning the owner directories, memoized in a `Map` that is only ever a hint (a stale entry costs one failed read and a rescan). Changing a project's organization or creator therefore *moves* its file: `writeProject` writes the new path before removing the old one. `listProjects({ organizationId })` reads only that organization's directory; the other filters still scan.

`db/file-store.ts` is the **only** module that touches project files; `db/index.ts` is the only one that opens SQLite. `ProjectRecord` keeps the field names of the old `projects` row (`schemaJson`, `revision`, `schemaFormatVersion`, `organizationId`, `createdBy`, `updatedAt`) so readers are unchanged. Projects are still scoped to Better Auth organizations and addressable at `/[workspace]/[projectId]`.

Three things Postgres used to do implicitly and the store now does explicitly — do not remove them:

- **`withProjectLock(id, fn)`** — a lock directory (`fs.mkdir` is an atomic exclusive create, stale after 10s) plus an in-process promise chain. The collab server is a *separate process* that bumps the same `revision`, so read-modify-write has to be serialized by hand. `PUT`/`PATCH` re-read the record **inside** the lock; comparing against a pre-lock read races.
- **`writeAtomic`** — temp file + `rename`, so a reader never sees half-written JSON.
- **`deleteProject`** — walks to the Yjs blob and the share file itself, replacing `ON DELETE CASCADE`. `ProjectRecord.shareTokenHash` is the back-pointer that replaces `project_share`'s unique foreign key.

`PUT` implements optimistic concurrency: if the stored `revision` differs from the client's it returns **409 `REVISION_CONFLICT`** with the current record, unless `{ overwrite: true }` is passed. The new revision is `max(stored, incoming) + 1`. `SCHEMA_FORMAT_VERSION` (currently `3`) is stamped server-side on every write — bump it in `app/lib/schema.ts` when the JSON shape changes.

`scripts/migrate-from-neon.ts` imports an existing Postgres database into `DATA_DIR` (`DATABASE_URL=… pnpm tsx scripts/migrate-from-neon.ts`, `--force` to re-import). It reads only, so it can be re-run and verified before anything is dropped. `pg` is a devDependency for its sake alone. `scripts/migrate-storage-layout.ts` (`pnpm tsx scripts/migrate-storage-layout.ts`, `--force` to overwrite a taken destination) renames the older flat `projects/<projectId>.json` files into their owner directory; it only touches top-level `*.json`, so re-running it does nothing.

Because storage is a directory, the app needs a **persistent volume** — it cannot run on an ephemeral-filesystem host. In Docker the `web` and `collab` services must mount the *same* volume, or collab's mirror writes go somewhere the web app never reads.

### Realtime collaboration

A self-hosted **Hocuspocus** (Yjs) service in `collab/` is the source of truth for a project's schema; the project file's `schemaJson` is a **mirror** it rewrites on every store, so the REST routes, share pages, project list and DDL export are unchanged. The collab server opens no database — it reads and writes `DATA_DIR` through `db/file-store.ts` only.

- `app/lib/collab/ydoc.ts` — pure `schemaFromYDoc()` / `applySchemaToYDoc()`. Imported by *both* browser and server, so the projection can never diverge. Tested in `tests/ydoc.test.ts`.
- `app/lib/collab/useCollaborativeSchema.ts` — owns the `Y.Doc` and presents the designer's old surface (`schema`, `commit(next)`, `undo`, `redo`). Undo is per-user via `Y.UndoManager` tracking this client's origin.
- `app/api/collab/token/route.ts` — the **only** place access is decided, via the same session helpers as the REST routes. It signs a 120s token bound to one `documentName`; the collab server verifies and trusts it. Read-only shares are enforced on the connection.
- Presence (cursors, selection) rides the Yjs awareness channel — no second transport. Cursor coordinates are canvas space, never screen space.

Without `NEXT_PUBLIC_COLLAB_URL` the app degrades to single-player editing and the debounced `PUT` (with its 409 toast) remains the durability path — do not delete it.

`nextId()` mints UUIDs because ids must be unique across *clients*, not just per session.

`getDb()` creates `auth.db` if it is missing; every route catches storage failures and returns 503/400 rather than crashing.
`PATCH` renames use the same optimistic revision scheme as `PUT`; a successful rename bumps the revision and updates `schemaJson.name`.

## Conventions

- Path alias `@/*` maps to the repo root, configured in both `tsconfig.json` and `vitest.config.ts`.
- UI components come from shadcn with the `aria-vega` style and Base UI / react-aria-components underneath (`components.json`). Icon library is configured as `hugeicons`, but `Designer.tsx` currently imports from `lucide-react`.
- Tests live in `tests/` and target the pure domain layer (generators, parser, validation) — not the React tree.
- Code style is dense: single-line arrow functions and chained array methods over intermediate variables. Match it.
- Commit messages: no `Co-Authored-By` trailers.
