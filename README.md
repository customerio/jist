# Jist

Cross-platform library for rendering JSON template trees into native UI. One template, one theme, three platforms — pixel-perfect output.

| Platform | View | Package |
|----------|------|---------|
| Web | `<jist-template>` custom element | `@customerio/jist` |
| iOS | `JistView` (SwiftUI) | `Jist` (Swift Package) |
| Android | `JistView` (Jetpack Compose) | `io.customer:jist` |

## How it works

Jist takes three JSON inputs and produces a platform-native view:

- **Template** — tree of components defining structure and layout
- **Data** — content for each component (text, URLs, dates)
- **Theme** — visual appearance (colors, fonts, spacing, borders)

```
┌──────────┐   ┌──────┐   ┌───────┐
│ Template │ + │ Data │ + │ Theme │  →  Native View
└──────────┘   └──────┘   └───────┘
```

Templates are version-tagged JSON. Renderers that don't support a template's version silently skip it. Unknown components and properties are ignored, so templates degrade gracefully on older renderers.

## Quick start

### Example

A vertical card with a heading, full-width image, body text, and a bottom row containing a date and secondary button:

**Templates (registry):**

```json
{
  "inbox": [
    {
      "version": "1",
      "root": {
        "type": "layout",
        "direction": "vertical",
        "gap": 8,
        "children": [
          { "type": "heading", "name": "title", "variant": "h3" },
          { "type": "image", "name": "media", "width": "fill", "objectFit": "cover", "borderRadius": 6 },
          { "type": "text", "name": "body" },
          {
            "type": "layout",
            "direction": "horizontal",
            "align": "center",
            "justify": "space-between",
            "children": [
              { "type": "date", "name": "timestamp" },
              { "type": "button", "name": "cta", "variant": "secondary" }
            ]
          }
        ]
      }
    }
  ]
}
```

**Data:**

```json
{
  "title": "New Dashboard Design",
  "media": "https://example.com/dashboard-preview.png",
  "body": "Check out the redesigned analytics dashboard with improved charts.",
  "timestamp": "2026-04-01T08:30:00Z",
  "cta": { "label": "View dashboard", "url": "/dashboard" }
}
```

**Theme:**

```json
{
  "heading": {
    "text": { "fontSize": 16, "fontWeight": 600, "color": "#1A1A2E" }
  },
  "text": {
    "text": { "fontSize": 14, "color": "#4A4A68", "maxLines": 3 }
  },
  "date": {
    "text": { "fontSize": 12, "color": "#8E8EA0" }
  },
  "button": {
    "text": { "color": "#FFFFFF", "fontSize": 14, "fontWeight": 500 },
    "background": { "color": "#4F46E5" },
    "border": { "radius": 6 },
    "padding": { "top": 8, "right": 16, "bottom": 8, "left": 16 },
    "secondary": {
      "text": { "color": "#4A4A68" },
      "background": { "color": "#F4F4F6" },
      "border": { "width": 1, "color": "#E2E2E8" }
    }
  },
  "modes": {
    "dark": {
      "heading": { "text": { "color": "#F0F0F5" } },
      "text": { "text": { "color": "#B0B0C0" } },
      "date": { "text": { "color": "#707088" } },
      "button": {
        "background": { "color": "#6366F1" },
        "secondary": {
          "text": { "color": "#C0C0D0" },
          "background": { "color": "#2A2A3C" }
        }
      }
    }
  }
}
```

This renders identically on all three platforms. The theme adapts to light/dark mode automatically — only color values are overridden in dark mode, everything else inherits from the base.

### Web

```html
<script type="module" src="jist-element.js"></script>

<jist-template
  template="inbox"
  data='{ "title": "Hello" }'
  theme='{ "heading": { ... } }'
  mode="auto"
></jist-template>
```

```js
const el = document.querySelector("jist-template");
el.templates = allTemplates; // Record<string, JistTemplate[]>
el.template = "inbox";       // name of template to render
el.formatDate = (iso, name) => new Date(iso).toLocaleDateString();
el.onAction = (event) => console.log(event);
```

### iOS (SwiftUI)

Add the Swift package from the `ios/` directory, then:

```swift
import Jist

JistView(
    name: "basic",
    templates: allTemplates,
    data: ["title": "Hello", "body": "World"],
    theme: theme,
    formatDate: { iso, name in "2 hours ago" },
    onAction: { event in print(event) }
)
```

### Android (Jetpack Compose)

Define your fonts once at the app level and wrap your root composable with `JistTheme`. All `JistView` calls inside inherit the fonts automatically:

```kotlin
import io.customer.jist.JistTheme
import io.customer.jist.JistView

val dmSans = FontFamily(
    Font(R.font.dm_sans_regular, FontWeight.Normal),
    Font(R.font.dm_sans_bold, FontWeight.Bold),
)

JistTheme(fonts = mapOf("DM Sans" to dmSans)) {
    JistView(
        name = "basic",
        templates = allTemplates,
        data = data,
        theme = theme,
        formatDate = { iso, name -> "2 hours ago" },
        onAction = { event -> Log.d("Jist", event.toString()) }
    )
}
```

## Components

**Container nodes** arrange children:

| Component | Description |
|-----------|-------------|
| `layout` | Arranges children along a vertical or horizontal axis |
| `action` | Wraps children in a clickable region |
| `dynamicLayout` | Repeats a template node for each item in a data array |

**Leaf nodes** render content from data:

| Component | Description |
|-----------|-------------|
| `heading` | Text heading (h2, h3, h4) |
| `text` | Body text |
| `date` | Formatted timestamp via `formatDate` callback |
| `button` | Action button (skipped if data absent) |
| `image` | Image from URL (skipped if data absent) |
| `template` | References a named template from the registry |

## Theme & color modes

The theme object styles each component type with properties like `text`, `background`, `border`, `shadow`, `padding`, and `margin`. Variants (e.g., `"secondary"`) override specific properties while inheriting the rest from the base.

Dark mode is handled via sparse overrides under `modes.dark` — only the values that change need to be defined. Mode detection is automatic (system preference) but can be overridden explicitly on each platform.

## Callbacks

| Callback | Signature | Purpose |
|----------|-----------|---------|
| `formatDate` | `(isoString, name) -> string` | Converts ISO 8601 dates to display text. Optional — falls back to locale-aware formatting. |
| `onAction` | `(event) -> void` | Receives `{ component, name, data, meta }` when a button or action is activated. |

## Custom fonts

Set `fontFamily` in any theme text group using the human-readable family name or a CSS-style fallback stack. Each platform resolves it natively — see [`spec/fonts.md`](spec/fonts.md) for bundling instructions and weight variant conventions.

## Project structure

```
jist/
├── spec/               # Specification and JSON schemas
│   ├── jist-spec.md
│   ├── fonts.md
│   ├── jist-template-schema.json
│   ├── jist-template-registry-schema.json
│   └── jist-theme-schema.json
├── shared/             # Shared fixtures (used by tests and example apps)
│   ├── templates.json
│   ├── data.json
│   ├── theme.json
│   └── tests/          # Per-component test fixtures (heading, text, date, button, image)
├── builder/            # Visual template editor (Next.js)
│   └── src/
├── web/                # Web renderer (custom element)
│   └── src/
├── ios/                # iOS renderer (SwiftUI, Swift Package)
│   └── Sources/Jist/
├── android/            # Android renderer (Jetpack Compose)
│   └── jist/src/
└── .github/workflows/  # CI (snapshot tests on PR and main)
```

## Visual regression testing

Each platform has two suites of snapshot tests that compare against committed baseline images. Any pixel-level drift beyond a small tolerance fails the test.

All tests use a deterministic `formatDate` (returns `"Apr 1, 2026"`) and placeholder images to ensure reproducible output without network access.

### Demo template tests

Render every demo template with the shared fixtures (templates.json, data.json, theme.json) in light and dark mode:

| Template     | Light | Dark |
|--------------|-------|------|
| basic        | ✓     | ✓    |
| image        | ✓     | ✓    |
| cta          | ✓     | ✓    |
| liveActivity | ✓     | ✓    |
| action       | ✓     | ✓    |
| hero         | ✓     | ✓    |
| inbox        | ✓     | ✓    |
| profile      | ✓     | ✓    |
| announcement | ✓     | ✓    |

### Component tests

Per-component tests that exercise individual theme properties in isolation. Fixtures live in `shared/tests/{component}.json` — each file defines test cases with a node, data, and theme. The test harness wraps each node in a layout root automatically.

| Component | required | all-properties | variant |
|-----------|----------|----------------|---------|
| heading   | light    | light + dark   | light + dark |
| text      | light    | light + dark   | light + dark |
| date      | light    | light + dark   | light + dark |
| button    | light    | light + dark   | light + dark |
| image     | light    | light + dark   | light + dark |

Three cases per component: **required** (no theme, validates defaults), **all-properties** (every theme property set), **variant** (base + variant, validates cascade). Adding a test case is just a JSON entry — no platform code changes.

### Platform tools

| Platform | Tool | Runner | Key detail |
|----------|------|--------|------------|
| Web | [Playwright](https://playwright.dev/) | Chromium (headless) | Screenshots of the `<jist-template>` element via `toHaveScreenshot()` |
| iOS | [swift-snapshot-testing](https://github.com/pointfreeco/swift-snapshot-testing) | macOS (Swift CLI) | `NSHostingView` rendered to 1x bitmap; local file placeholders for `AsyncImage` |
| Android | [Paparazzi](https://github.com/cashapp/paparazzi) | JVM (no emulator) | Coil `FakeImageLoaderEngine` provides solid-color placeholders |

### Running tests

**Web**
```bash
cd web
npm ci && npm run build && npx playwright install chromium
npx playwright test                       # verify against baselines
npx playwright test --update-snapshots    # re-record baselines
```

**iOS**
```bash
cd ios
swift test                                # verify against baselines
# To re-record: uncomment `isRecording = true` in SnapshotTests.swift and
# ComponentSnapshotTests.swift setUp(), run swift test, then set back to false.
```

**Android**
```bash
cd android
./gradlew :example:verifyPaparazziDebug      # verify against baselines
./gradlew :example:recordPaparazziDebug      # re-record baselines
```

### Baseline files

| Platform | Location |
|----------|----------|
| Web | `web/tests/__snapshots__/*.png` |
| iOS | `ios/Tests/JistTests/__Snapshots__/SnapshotTests/*.png` (demo), `__Snapshots__/ComponentSnapshotTests/*.png` (component) |
| Android | `android/example/src/test/snapshots/images/*.png` |

These PNGs are committed to the repo. When a renderer change is intentional, re-record and commit the updated baselines.

### CI

Snapshot tests run on every push to `main` and on pull requests via GitHub Actions (`.github/workflows/snapshot-tests.yml`). Runner versions and tool versions are pinned at the top of the workflow to prevent environment drift from breaking baselines.

If a test fails in CI, diff artifacts are uploaded so you can inspect exactly which pixels changed.

## Specification

The full specification — component properties, data binding rules, theme cascade, accessibility requirements, and platform rendering details — lives in [`spec/jist-spec.md`](spec/jist-spec.md).

JSON schemas for validating templates and themes are in the `spec/` directory.
