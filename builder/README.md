# Jist Builder

Visual drag-and-drop editor for building Jist templates. Load sample templates, compose new ones from a component palette, preview live output, and edit template JSON, data, and theme — all in the browser.

## Prerequisites

- **Node.js** 20+
- **npm** 10+

## Setup

1. **Install dependencies**

   ```bash
   cd builder
   npm install
   ```

2. **Build the web renderer** (if not already built)

   The preview panel uses the Jist web component. The assets in `public/jist/` are symlinked to the `web/` package, so you need to build it once:

   ```bash
   cd ../web && npm ci && npm run build
   ```

3. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Sync shared files, then start dev server (Turbopack) |
| `npm run build` | Sync shared files, then production build |
| `npm run sync` | Copy shared fixtures and schemas into `src/lib/shared/` |
| `npm run start` | Serve production build |
| `npm run lint` | Run ESLint |

## How it works

Sample templates, data, and themes come from the monorepo's `shared/` directory, and JSON schemas from `spec/`. A sync script (`scripts/sync-shared.sh`) copies them into `src/lib/shared/` before each `dev` or `build` run. The copied files are gitignored — the source of truth is always `shared/` and `spec/`.

The builder is a three-panel layout:

| Panel | Contents |
|-------|----------|
| **Left** | Component palette — drag components onto the canvas |
| **Center** | Editor canvas, live Preview, or template Code view (tabs) |
| **Right** | Properties for the selected node, Data editor, Theme editor (tabs) |

- **Editor** — drag-and-drop tree editor. Reorder and nest components visually.
- **Preview** — renders the template using the actual `<jist-template>` web component with sample data, in light or dark mode.
- **Code** — Monaco-based JSON editor for the raw template. Changes are validated against the Jist template schema in real time.
- **Data** — Monaco editor for the sample data object that populates the template.
- **Theme** — Monaco editor for the theme JSON, validated against the Jist theme schema.

Templates, data, and theme can be exported as a single JSON file via the **Export** button in the toolbar.

## Tech stack

- [Next.js](https://nextjs.org/) 16 (App Router, Turbopack)
- [Tailwind CSS](https://tailwindcss.com/) v4
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [@dnd-kit](https://dndkit.com/) — drag and drop
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) — JSON editing
- [AJV](https://ajv.js.org/) — JSON Schema validation

## Project structure

```
builder/
├── public/jist/            # Symlinks to web renderer assets
├── src/
│   ├── app/                # Next.js App Router (layout, page, globals.css)
│   ├── components/         # React components
│   │   ├── Builder.tsx     # Main layout, toolbar, drag context
│   │   ├── CanvasNode.tsx  # Tree node rendering + drag/drop
│   │   ├── CodeView.tsx    # Template JSON editor
│   │   ├── ComponentPalette.tsx
│   │   ├── DataEditor.tsx  # Data JSON editor
│   │   ├── Icons.tsx
│   │   ├── Preview.tsx     # Live jist-template preview
│   │   ├── PropertyPanel.tsx
│   │   ├── ResizeHandle.tsx
│   │   ├── TemplateCanvas.tsx
│   │   └── ThemeEditor.tsx # Theme JSON editor
│   ├── lib/
│   │   ├── shared/              # Synced from shared/ and spec/ (gitignored)
│   │   ├── component-defs.ts    # Component type definitions
│   │   ├── template-utils.ts    # Tree manipulation utilities
│   │   └── validator.ts         # AJV schema validation
│   └── store/
│       └── builder-store.ts     # Zustand store
└── package.json
```
