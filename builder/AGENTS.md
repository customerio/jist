<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Jist Builder

Visual drag-and-drop editor for Jist templates. Built with Next.js 16, React 19, Zustand, dnd-kit, and Monaco Editor.

## Architecture

- **Store** (`src/store/builder-store.ts`): Zustand store managing the full template registry, per-template data, shared theme, UI state, and all mutation actions. The store validates templates and themes against JSON Schema (via ajv) on every change.
- **Template utils** (`src/lib/template-utils.ts`): Tree manipulation functions using a path-based addressing scheme (`""` = root, `"0"` = first child, `"0.2"` = grandchild). Handles `layout`, `action`, and `dynamicLayout` as containers — `dynamicLayout` uses `node.template` (single slot) instead of `node.children`.
- **Component defs** (`src/lib/component-defs.ts`): Registry of all component types with their default nodes. Must match the spec exactly.
- **Validator** (`src/lib/validator.ts`): Wraps ajv to validate against the Jist JSON schemas.

## Shared files

The `scripts/sync-shared.sh` script copies shared fixtures and JSON schemas from `../shared/` and `../spec/` into `src/lib/shared/` (gitignored). Runs automatically via `predev`/`prebuild` npm scripts.

## Spec compliance

The builder must match the Jist spec (`../spec/jist-spec.md`) exactly. All component types, properties, data binding rules, and theme structure must be supported. When the spec adds new components or properties, update:
1. `component-defs.ts` — add the component definition
2. `template-utils.ts` — ensure container logic handles new types
3. `PropertyPanel.tsx` — add a property editor for the new type
4. `CanvasNode.tsx` — add type color/icon entries

## Key conventions

- Templates are stored as `Record<string, TemplateRoot[]>` (registry format: name to array of versioned templates). The builder always works with the first (and usually only) version.
- The preview panel loads the actual `@customerio/jist` web component from `/jist/` static files. It reflects real renderer behavior.
- Dark mode is toggled via `data-theme="dark"` on the root element, driven by CSS custom properties.
