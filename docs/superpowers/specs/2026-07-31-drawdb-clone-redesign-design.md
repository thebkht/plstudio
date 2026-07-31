# DrawDB Clone Redesign

## Goal

Rework DrawSQL's visible product experience to closely match `/Users/thebkht/drawdb` across the landing page, editor, templates, workspace, onboarding, settings, and authentication screens. The result should feel like the same product family as DrawDB while preserving DrawSQL's organization-aware persistence, authentication, project access rules, and existing schema Designer behavior.

## Non-goals

- Replacing the existing database schema or auth implementation.
- Reimplementing DrawDB's IndexedDB, anonymous-local-storage, or file-sharing data flows.
- Replacing the schema editor's domain model when the current Designer already supports the needed interaction.
- Adding unrelated product features not present in either application.

## Reference and adaptation boundary

DrawDB is the visual and structural reference: page hierarchy, navigation rhythm, editor chrome, card treatment, template gallery, landing hero, responsive behavior, and visual language. DrawSQL remains the source of truth for data and permissions:

| DrawDB concept | DrawSQL implementation |
| --- | --- |
| Direct editor entry | Signed-in users without a workspace can create a personal project at `/editor` |
| Local diagrams/templates | Existing `projects` records and native template-start flow |
| Editor save state | Existing project API and Designer autosave |
| Anonymous/local user | Existing Better Auth session and guest behavior |
| DrawDB settings/context | Existing workspace settings and Designer state |
| DrawDB route pages | Next.js routes under the current app structure |

## Route experience

### Landing page

The root experience will use DrawDB's light, editorial landing layout:

- compact branded navbar with primary navigation and a prominent editor CTA;
- large rounded hero surface on a zinc background;
- dotted or diagrammatic backdrop behind the hero copy;
- DrawDB-style headline treatment, supporting copy, and paired secondary/primary actions;
- product screenshot/diagram feature section;
- supported database row using local assets or lightweight branded marks;
- feature cards with a teal accent edge and hover lift;
- community/social footer with no dependency on live external counters.

The primary CTA will respect authentication: signed-out users go through the existing auth flow, while signed-in users reach their workspace or onboarding.

### Workspace and project list

The workspace route will become a DrawDB-like project home rather than a plain list:

- branded header with workspace identity, navigation, settings, and account affordances;
- prominent “new diagram” action;
- project cards with diagram preview treatment, project name, table count, updated time, and hover/focus states;
- empty state with a DrawDB-style starter/template invitation;
- existing workspace membership and project access checks remain unchanged.

### Editor

The current `Designer` remains the behavior and state boundary. Its surrounding UI will be reshaped to resemble DrawDB's editor:

- light top app bar with logo, diagram/project name, menus, and account/workspace controls;
- compact tool and action controls with DrawDB-like spacing, borders, icon sizing, and active states;
- canvas with DrawDB-style neutral background/grid treatment;
- floating or docked controls for zoom, selection, and diagram actions;
- side panels, dialogs, and menus restyled to the same white/zinc/teal system;
- responsive collapse rules for narrow screens;
- existing schema editing, import/export, SQL generation, undo/redo, and autosave behavior preserved.

### Templates

Add or reshape the templates experience to match DrawDB's gallery:

- branded page header and breadcrumb/back affordance;
- “database schema templates” intro copy;
- default and user template tabs or equivalent segmented navigation;
- preview cards with title, description, fork/create action, and hover lift;
- empty state explaining how to save or start from a template;
- template selection creates a normal persisted project through the existing project API.

If no template persistence exists in the current schema, the first implementation will use a curated static starter catalog and create a project from the selected schema. User-created template storage is out of scope unless already supported by the existing code.

### Auth, onboarding, and settings

All supporting screens will share the DrawDB-inspired shell:

- centered, spacious, light card layouts;
- the same rounded controls, typography, neutral surfaces, and teal primary action;
- clear error and focus states;
- auth behavior and guest sign-in remain unchanged;
- onboarding continues to create an organization and redirect to its workspace;
- settings keeps current member-management permissions and operations.

## Component and styling plan

Create or consolidate a small set of reusable visual primitives rather than styling each route independently:

- `BrandMark` / `DrawSqlLogo` for navbar, editor, and auth surfaces;
- `PublicNavbar` and `ProductShell` for landing/templates/shared footer;
- `WorkspaceHeader` for workspace and editor identity/actions;
- `DiagramPreviewCard` for projects and templates;
- shared button, field, menu, tab, card, and empty-state variants;
- CSS tokens for DrawDB's zinc/white surfaces, teal/navy accent, border ramp, shadows, radii, typography, and motion.

Use the existing component library where it already provides accessible behavior. Adapt DrawDB's visual patterns into the current Tailwind/CSS setup instead of importing DrawDB's entire dependency tree.

## Data flow and behavior

1. Root route checks the existing Better Auth session and directs users to auth, their workspace, or a new personal editor project.
2. Workspace loads projects through the existing organization-scoped query.
3. New personal diagrams submit through the same project creation path with a nullable organization and `createdBy` ownership.
4. New diagram and template actions submit through the existing project creation path.
5. Editor loads the existing schema and continues to persist changes through the current API/autosave path.
6. Settings and membership actions continue through current permission checks and client components.
7. Visual state such as menus, tabs, dialogs, hover, focus, and responsive panel visibility stays local to the UI components unless it is already part of Designer state.

## Accessibility and responsive requirements

- Preserve semantic headings, labels, and keyboard-operable controls.
- Maintain visible focus rings against light surfaces.
- Use accessible names for icon-only buttons and menu triggers.
- Ensure landing, workspace, templates, auth, and editor layouts work at mobile, tablet, and desktop widths.
- Respect reduced-motion preferences for DrawDB-style entrance and hover transitions.
- Keep color contrast compliant for primary text, muted text, borders, and accent controls.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- manual route checks for `/`, `/login`, `/signup`, `/onboarding`, `/:workspace`, `/:workspace/:projectId`, `/:workspace/settings`, and `/templates`;
- verify project creation, template-to-project creation, editor autosave, auth redirects, and settings access;
- inspect desktop and narrow viewport layouts for overflow, unreadable controls, and broken canvas interactions.

## Acceptance criteria

- A user familiar with DrawDB recognizes the same visual language and page structure throughout DrawSQL.
- The editor shell is structurally DrawDB-like without losing existing schema editing capabilities.
- All current auth, organization, project, permissions, and autosave behavior still works.
- Signed-in users can create and edit a personal project without a workspace.
- Templates can start a persisted project.
- The app passes typecheck, tests, and production build.
- No live external analytics or social API is required for the core experience.
