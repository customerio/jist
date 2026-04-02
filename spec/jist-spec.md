# Jist Template Specification

**Version: 1**

## Overview

Jist is a cross-platform library for rendering JSON template trees into native UI. It takes three inputs and produces a platform-native view:

- **Template** — JSON tree defining structure and layout (what components exist and how they're arranged)
- **Data** — JSON object providing content for each component (text, URLs, dates, labels)
- **Theme** — JSON object defining visual appearance (colors, fonts, spacing, borders)

Two callbacks configure behavior:

- **formatDate** — converts ISO 8601 date strings into display text
- **onAction** — receives events when interactive components are activated

### Platform Targets

| Platform | View | Package |
|---|---|---|
| Web | `<jist-template>` custom element | `@customerio/jist` |
| iOS | `JistView` (SwiftUI) | `Jist` (Swift Package) |
| Android | `JistView` (Jetpack Compose) | `io.customer:jist` |

---

## Template Structure

A template is a JSON object with two required fields:

```json
{
  "version": "1",
  "root": {
    "type": "layout",
    "direction": "vertical",
    "children": [
      { "type": "heading", "name": "title" },
      { "type": "text", "name": "body" },
      { "type": "date", "name": "timestamp" }
    ]
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | string | Yes | Spec version this template targets |
| `root` | component node | Yes | Root of the template tree (must be a layout node) |

---

## Components

### Node Categories

**Container nodes** hold children:
- `layout` — arranges children along an axis
- `action` — wraps children in a clickable region

**Leaf nodes** render content from data:
- `heading` — text heading (h2–h4)
- `text` — body text
- `date` — formatted timestamp
- `button` — action button
- `image` — image from URL

---

### layout

Arranges children along a single axis. Can be nested to any depth.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"layout"` | Yes | | |
| `direction` | `"vertical"` \| `"horizontal"` | Yes | | Main axis |
| `gap` | number | No | 0 | Space between children |
| `align` | enum | No | `"stretch"` | Cross-axis alignment |
| `justify` | enum | No | `"start"` | Main-axis distribution |
| `margin` | spacing object | No | | Outer spacing |
| `children` | node[] | Yes | | Ordered child nodes |

**`align` values:** `"stretch"`, `"start"`, `"end"`, `"center"`, `"baseline"`

**`justify` values:** `"start"`, `"end"`, `"center"`, `"space-between"`, `"space-around"`, `"space-evenly"`

**Spacing object:** `{ "top": number, "right": number, "bottom": number, "left": number }` — all fields optional, default 0.

Layout is structural, not themed. All visual properties come from the template node, not the theme.

**Example:**

```json
{
  "type": "layout",
  "direction": "horizontal",
  "align": "center",
  "justify": "space-between",
  "gap": 12,
  "margin": { "top": 8 },
  "children": [
    { "type": "date", "name": "timestamp" },
    { "type": "button", "name": "cta", "variant": "secondary" }
  ]
}
```

---

### action

Clickable wrapper that makes its children interactive. Fires an action event when activated.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"action"` | Yes | | |
| `name` | string | Yes | | Data binding key |
| `meta` | object | No | | Static metadata included in the action event |
| `children` | node[] | Yes | | Child nodes |

**Data binding:** `data[name]` provides action data (any shape). Passed as `data` in the action event. The action renders even if the data field is absent — it passes `null` as data.

**Events:** Fires `onAction` with `{ component: "action", name, data, meta }` on activation (click/tap, Enter/Space key).

**Accessibility:** Must be focusable and announce as a button role.

**Example:**

```json
{
  "type": "action",
  "name": "open",
  "meta": { "trackEvent": "card_click" },
  "children": [
    { "type": "image", "name": "thumbnail", "width": 64, "height": 64, "objectFit": "cover", "borderRadius": 8 },
    { "type": "heading", "name": "title", "variant": "h4" }
  ]
}
```

---

### heading

Text heading with semantic level. The `variant` determines both the semantic level and the style.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"heading"` | Yes | | |
| `name` | string | No | `"heading"` | Data binding key |
| `variant` | `"h2"` \| `"h3"` \| `"h4"` | No | `"h3"` | Semantic level and style variant |

**Data binding:** `data[name]` provides text content (string). Renders empty if absent.

**Theme properties:** `text`, `padding`, `margin`. Variants `h2`, `h3`, `h4` override the base.

**Example:**

```json
{ "type": "heading", "name": "title", "variant": "h4" }
```

---

### text

General-purpose text content.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"text"` | Yes | | |
| `name` | string | No | `"text"` | Data binding key |
| `variant` | string | No | | Style variant |

**Data binding:** `data[name]` provides text content (string). Renders empty if absent.

**Theme properties:** `text`, `padding`, `margin`. Supports arbitrary named variants.

**Example:**

```json
{ "type": "text", "name": "body" }
```

---

### date

Formatted timestamp. Display text is produced by the `formatDate` callback.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"date"` | Yes | | |
| `name` | string | No | `"date"` | Data binding key |
| `variant` | string | No | | Style variant |

**Data binding:** `data[name]` provides an ISO 8601 date string. Passed to `formatDate`; the returned string is displayed.

**Theme properties:** `text`, `padding`, `margin`. Supports arbitrary named variants.

**Example:**

```json
{ "type": "date", "name": "timestamp" }
```

---

### button

Action button. **Not rendered** if the bound data field is absent — templates can include optional buttons without conditional logic.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"button"` | Yes | | |
| `name` | string | Yes | | Data binding key (expects `{ label, url }`) |
| `variant` | string | No | | Style variant (e.g., `"primary"`, `"secondary"`) |
| `meta` | object | No | | Static metadata included in the action event |

**Data binding:** `data[name]` provides `{ label: string, url: string }`. `label` becomes the button text. If absent, button is skipped.

**Events:** Fires `onAction` with `{ component: "button", name, data, meta }` on activation.

**Theme properties:** `text`, `background`, `border`, `shadow`, `padding`, `margin`, `states` (hover, active, disabled). Supports arbitrary named variants.

**Example:**

```json
{ "type": "button", "name": "cta", "variant": "secondary" }
```

---

### image

Image loaded from a URL. **Not rendered** if the bound data field is absent.

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `type` | `"image"` | Yes | | |
| `name` | string | Yes | | Data binding key (expects URL string) |
| `variant` | string | No | | Style variant |
| `width` | number \| `"fill"` | No | auto | Width (`"fill"` = expand to container) |
| `height` | number | No | auto | Height |
| `objectFit` | `"contain"` \| `"cover"` \| `"fill"` | No | `"contain"` | How the image fills its box |
| `borderRadius` | number | No | 0 | Corner rounding |

Width, height, objectFit, and borderRadius are template-level properties (not theme properties) because they control how this specific template uses the image, not global appearance.

**Data binding:** `data[name]` provides the image URL (string). Alt text is derived from the nearest heading text in the data.

**Theme properties:** `border` (radius only), `padding`, `margin`. Supports arbitrary named variants.

**Example — full-width banner:**

```json
{ "type": "image", "name": "hero", "width": "fill", "height": 180, "objectFit": "cover", "borderRadius": 8 }
```

**Example — small thumbnail:**

```json
{ "type": "image", "name": "avatar", "width": 40, "height": 40, "objectFit": "cover", "borderRadius": 20 }
```

---

## Data Binding

Components read content from the data object using their `name` property as the lookup key.

```
template:  { "type": "heading", "name": "title" }
data:      { "title": "Hello World" }
result:    renders "Hello World" as a heading
```

### Rules

1. `name` is the lookup key into the data object
2. When `name` is omitted, it defaults to the component's `type` (e.g., a heading without `name` reads `data["heading"]`)
3. The same component type can appear multiple times with different names, each bound to different data fields
4. Missing data behavior varies by component type:

| Component | Missing data behavior |
|---|---|
| heading | Rendered empty |
| text | Rendered empty |
| date | Rendered empty |
| button | **Not rendered** (skipped) |
| image | **Not rendered** (skipped) |
| action | Rendered (children appear), data is null |

### Name as Style Hook

The `name` serves double duty as a style targeting identifier. When `name` differs from `type`, it generates an additional style hook that consumers can use for per-instance styling. This allows two buttons with different names to be styled independently.

---

## Theme Configuration

The theme defines visual appearance for each component type. It is separate from the template — templates define structure, themes define how components look.

### Structure

```json
{
  "heading": {
    "text": { "fontSize": 16, "fontWeight": 600, "color": "#1A1A2E" },
    "padding": { "bottom": 4 },
    "h4": {
      "text": { "fontSize": 13, "fontWeight": 500 }
    }
  },
  "button": {
    "text": { "color": "#FFFFFF", "fontSize": 14 },
    "background": { "color": "#4F46E5" },
    "border": { "radius": 6 },
    "padding": { "top": 8, "right": 16, "bottom": 8, "left": 16 },
    "secondary": {
      "text": { "color": "#4A4A68" },
      "background": { "color": "#F4F4F6" },
      "border": { "width": 1, "color": "#E2E2E8" }
    }
  },
  "date": {
    "text": { "fontSize": 12, "color": "#8E8EA0" }
  },
  "modes": {
    "dark": {
      "heading": {
        "text": { "color": "#F0F0F5" }
      },
      "button": {
        "background": { "color": "#6366F1" },
        "secondary": {
          "text": { "color": "#C0C0D0" },
          "background": { "color": "#2A2A3C" }
        }
      },
      "date": {
        "text": { "color": "#707088" }
      }
    }
  }
}
```

Top-level keys are component types. Properties directly under a type are **base** styles. Named sub-objects (e.g., `"secondary"`, `"h4"`) are **variant** overrides. The `modes` key contains named color mode overrides (see [Color Modes](#color-modes)).

### Measurement Units

All numeric measurement values are **unitless**. Each platform interprets them in its native unit:

| Platform | Unit | Notes |
|---|---|---|
| Web | px (pixels) | Applied as CSS pixel values |
| iOS | pt (points) | UIKit/SwiftUI points (1pt = 1px at 1x, 2px at 2x, 3px at 3x) |
| Android | dp (density-independent pixels) | Scales with screen density |

Colors are hex strings: `"#RRGGBB"` or `"#RRGGBBAA"` for alpha.

### Property Types

#### Text

| Property | Type | Description |
|---|---|---|
| `fontSize` | number | Font size |
| `fontWeight` | number | Weight (100–900) |
| `fontFamily` | string | Font family name |
| `color` | string | Text color (hex) |
| `lineHeight` | number | Line height multiplier |
| `letterSpacing` | number | Letter spacing |
| `maxLines` | integer | Max visible lines (clamped with ellipsis) |

#### Background

| Property | Type | Description |
|---|---|---|
| `color` | string | Background color (hex) |

#### Border

| Property | Type | Description |
|---|---|---|
| `width` | number | Border width |
| `color` | string | Border color (hex) |
| `radius` | number | Corner radius |

#### Shadow

| Property | Type | Description |
|---|---|---|
| `color` | string | Shadow color (hex) |
| `offsetX` | number | Horizontal offset |
| `offsetY` | number | Vertical offset |
| `blur` | number | Blur radius |

#### Spacing (padding / margin)

| Property | Type | Description |
|---|---|---|
| `top` | number | Top spacing |
| `right` | number | Right spacing |
| `bottom` | number | Bottom spacing |
| `left` | number | Left spacing |

### Style Cascade

Styles resolve using a three-level cascade:

```
base type  →  variant  →  consumer override
```

1. **Base type** — properties defined directly under the component type key in the theme
2. **Variant** — properties defined under a named sub-object; override only the properties explicitly set
3. **Consumer override** — platform-specific per-instance styling (CSS on web, ViewModifier on iOS, Modifier on Android)

**Resolution algorithm:**

```
resolve(type, variant, group, property, mode):
  if mode == "dark":
    if variant AND modes.dark[type][variant][group][property] exists:
      return that value
    if modes.dark[type][group][property] exists:
      return that value
  if variant AND theme[type][variant][group][property] exists:
    return that value
  if theme[type][group][property] exists:
    return that value
  return platform default
```

Variant properties **fall back** to the base type when not set. Setting `button.secondary.text.color` only overrides the color — all other text properties (fontSize, fontWeight, etc.) inherit from `button.text`. In dark mode, the same cascade applies within the dark overrides first, then falls through to the light (default) values.

### Themeable Components

| Component | Theme properties |
|---|---|
| heading | text, padding, margin |
| text | text, padding, margin |
| date | text, padding, margin |
| button | text, background, border, shadow, padding, margin, states |
| image | border (radius), padding, margin |

Layout and action are **not themed** — layout is structural (properties come from the template node), action is a behavioral wrapper.

### Interaction States

Button supports interaction states under a `states` sub-object:

```json
{
  "button": {
    "background": { "color": "#4F46E5" },
    "states": {
      "hover": { "background": { "color": "#4338CA" } },
      "active": { "background": { "color": "#3730A3" } },
      "disabled": { "background": { "color": "#C7D2FE" } }
    }
  }
}
```

State properties fall back to the base component style when not set. Each variant can also define its own states:

```json
{
  "button": {
    "secondary": {
      "states": {
        "hover": { "background": { "color": "#E8E8EE" } }
      }
    }
  }
}
```

Platform mapping:

| State | Web | iOS | Android |
|---|---|---|---|
| hover | `:hover` | pointer hover (iPadOS/macOS) | pointer hover (desktop) |
| active | `:active` | highlighted state | pressed interaction |
| disabled | `:disabled` | `.disabled(true)` | `enabled = false` |

### Color Modes

The theme supports light and dark color modes. The top-level theme is the **light** (default) mode. A `modes.dark` object provides **sparse overrides** — only the values that change in dark mode. Non-color properties (fonts, spacing, border radii) typically stay the same and don't need to be redefined.

```json
{
  "text": {
    "text": { "fontSize": 14, "color": "#4A4A68", "maxLines": 3 }
  },
  "modes": {
    "dark": {
      "text": {
        "text": { "color": "#B0B0C0" }
      }
    }
  }
}
```

In this example, dark mode only overrides `text.color`. The `fontSize` and `maxLines` are inherited from the base — no duplication needed.

**Dark mode cascade:** Within `modes.dark`, the same base → variant cascade applies. If a dark variant override isn't defined, the dark base value is used. If no dark value exists at all, the light value is used.

Example — secondary button in dark mode:

```json
{
  "button": {
    "background": { "color": "#4F46E5" },
    "secondary": { "background": { "color": "#F4F4F6" } }
  },
  "modes": {
    "dark": {
      "button": {
        "background": { "color": "#6366F1" }
      }
    }
  }
}
```

| Property | Resolution | Value |
|---|---|---|
| secondary `background.color` in light | light variant | `#F4F4F6` |
| secondary `background.color` in dark | dark base (no dark variant defined) | `#6366F1` |
| primary `background.color` in dark | dark base | `#6366F1` |

If the secondary button needs a distinct dark color, define it explicitly in `modes.dark.button.secondary`.

**Mode detection:** Renderers auto-detect the system color mode by default. The consumer can override with an explicit mode:

| Platform | Auto-detection | Manual override |
|---|---|---|
| Web | `prefers-color-scheme` media query | `<jist-template mode="dark">` attribute |
| iOS | `@Environment(\.colorScheme)` | `JistView(mode: .dark)` |
| Android | `isSystemInDarkTheme()` | `JistView(mode = JistMode.Dark)` |

**Web implementation:** The theme flattener sets base custom properties on `:host` and dark overrides inside `@media (prefers-color-scheme: dark)`. The existing `var()` fallback chains handle the cascade naturally:

```css
:host {
  --jist-button-background-color: #4F46E5;
  --jist-button-secondary-background-color: #F4F4F6;
}
@media (prefers-color-scheme: dark) {
  :host {
    --jist-button-background-color: #6366F1;
    /* secondary not overridden — CSS fallback chain resolves to dark base */
  }
}
.jist__button--secondary {
  background: var(--jist-button-secondary-background-color,
              var(--jist-button-background-color));
}
```

When `mode` is set explicitly, the renderer applies the dark properties directly instead of relying on the media query.

---

## Action Model

Interactive components (`button`, `action`) fire events through the `onAction` callback.

### Action Event

| Field | Type | Description |
|---|---|---|
| `component` | `"button"` \| `"action"` | Which component type fired |
| `name` | string | The component's data binding key |
| `data` | any \| null | Bound data from `data[name]` |
| `meta` | object \| null | Static metadata from the template node |

`data` carries message-specific information (button label/URL, action payload). `meta` carries template-level static information (tracking events, routing hints) — it comes from the template definition, not the data.

### Platform Binding

| Platform | Type |
|---|---|
| Web | `(event: JistActionEvent) => void` callback or `CustomEvent` on the element |
| iOS | `(JistActionEvent) -> Void` closure |
| Android | `(JistActionEvent) -> Unit` lambda |

The consumer decides what to do with the action. The renderer does not navigate, open URLs, or perform side effects — it only reports that an action occurred.

---

## Date Formatting

Date components delegate formatting to a consumer-provided callback:

```
formatDate(isoString: string, name: string) → string
```

The renderer passes the raw ISO 8601 string and the component's `name` (data binding key). The consumer returns display text. This gives the consumer full control over locale, relative vs. absolute formatting, and timezone handling — and the ability to format different date fields differently.

| Platform | Type |
|---|---|
| Web | `(isoString: string, name: string) => string` |
| iOS | `(String, String) -> String` |
| Android | `(String, String) -> String` |

**Optional.** If not provided, the renderer falls back to a platform-native locale-aware date format:

| Platform | Default behavior |
|---|---|
| Web | `new Date(iso).toLocaleDateString(navigator.language)` |
| iOS | `DateFormatter.localizedString(from:dateStyle:timeStyle:)` with `.medium` style |
| Android | `DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)` with system locale |

**Example — different formatting per field:**

```js
formatDate: (iso, name) => {
  if (name === "expires_at") return new Date(iso).toLocaleDateString();
  return relativeTime(iso); // "2 hours ago"
}
```

---

## Versioning

Each template declares the spec version it targets:

```json
{ "version": "1", "root": { ... } }
```

### Rules

1. Version is a string (e.g., `"1"`, `"2"`)
2. If the renderer does not support the template's version, it **returns null/nil/empty** — the template is silently skipped
3. The server negotiates versions: it serves templates matching the renderer version the client advertises
4. **Within a version**, the spec is backwards-compatible — new optional properties may be added, but existing behavior is not changed

### Forward Compatibility

When a renderer encounters something it doesn't recognize:
- **Unknown component type** → skipped (not rendered)
- **Unknown property on a known component** → ignored
- **Unknown theme property** → ignored

This allows templates authored for a newer minor revision to degrade gracefully on older renderers.

---

## Accessibility

Each component has accessibility requirements that all platform implementations must satisfy:

| Component | Requirements |
|---|---|
| heading | Semantic heading level (web: appropriate `<h*>` tag; native: heading trait/role) |
| text | Standard text, no special role |
| date | Standard text, no special role |
| button | Button role, accessible label from button text |
| action | Button role, keyboard/switch-control focusable, accessible label derived from children text |
| image | Alt text derived from data (e.g., `data["title"]`) |
| layout | No semantic role (structural only) |

---

## Platform Rendering Reference

### Web

| Component | HTML Element | Notes |
|---|---|---|
| layout (vertical) | `<div>` | `display:flex; flex-direction:column` |
| layout (horizontal) | `<div>` | `display:flex; flex-direction:row` |
| action | `<div>` | `role="button"` `tabindex="0"`, click + key handlers |
| heading h2/h3/h4 | `<h2>` `<h3>` `<h4>` | Tag determined by variant |
| text | `<p>` | |
| date | `<time>` | |
| button | `<button>` | |
| image | `<img>` | `max-width: 100%` base style |

**Custom Element:**

```html
<jist-template
  template='{ "version": "1", "root": { ... } }'
  data='{ "title": "Hello" }'
  theme='{ "heading": { ... } }'
  mode="auto"
></jist-template>
```

The `mode` attribute accepts `"auto"` (default — follows system preference), `"light"`, or `"dark"`.

Programmatic API:

```js
const el = document.createElement("jist-template");
el.template = templateObj;
el.data = dataObj;
el.theme = themeObj;
el.mode = "auto"; // "auto" | "light" | "dark"
el.formatDate = (iso) => "2 hours ago";
el.onAction = (event) => { ... };
```

Or via `CustomEvent`:

```js
el.addEventListener("jist-action", (e) => {
  console.log(e.detail); // { component, name, data, meta }
});
```

**CSS classes** (BEM with `jist` block):

```
jist__<type>              — base type styles
jist__<type>--<variant>   — variant override
jist__<name>              — per-instance hook (when name ≠ type)
```

**CSS custom properties:**

Theme JSON is flattened to `--jist-*` custom properties on the host element. CSS rules use `var()` fallback chains so variant properties inherit from the base when not set:

```css
.jist__button--secondary {
  background: var(--jist-button-secondary-background-color,
              var(--jist-button-background-color, #4F46E5));
}
```

---

### iOS (SwiftUI)

| Component | SwiftUI View | Notes |
|---|---|---|
| layout (vertical) | `VStack(alignment:spacing:)` | |
| layout (horizontal) | `HStack(alignment:spacing:)` | |
| action | `Button { } label: { }` | with accessibility traits |
| heading | `Text` | `.font()` sized by variant |
| text | `Text` | `.lineLimit()` for maxLines |
| date | `Text` | content from `formatDate` closure |
| button | `Button` | styled from theme |
| image | `AsyncImage(url:)` | with phase handling |

**Public API:**

```swift
import Jist

struct ContentView: View {
    var body: some View {
        JistView(
            template: template,
            data: ["title": "Hello", "body": "World"],
            theme: theme,
            formatDate: { iso in "2 hours ago" },
            onAction: { event in
                print("\(event.component) \(event.name)")
            }
        )
    }
}
```

**Layout mapping:**

| `align` | SwiftUI `alignment` |
|---|---|
| `"start"` | `.leading` |
| `"end"` | `.trailing` |
| `"center"` | `.center` |
| `"baseline"` | `.firstTextBaseline` |
| `"stretch"` | children use `.frame(maxWidth: .infinity)` |

| `justify` | SwiftUI approach |
|---|---|
| `"start"` | Default VStack/HStack |
| `"end"` | `Spacer()` before content |
| `"center"` | `Spacer()` on both sides |
| `"space-between"` | `Spacer()` between each child |

| `objectFit` | SwiftUI |
|---|---|
| `"contain"` | `.scaledToFit()` |
| `"cover"` | `.scaledToFill().clipped()` |
| `"fill"` | `.resizable()` in frame |

---

### Android (Jetpack Compose)

| Component | Composable | Notes |
|---|---|---|
| layout (vertical) | `Column` | `verticalArrangement`, `horizontalAlignment` |
| layout (horizontal) | `Row` | `horizontalArrangement`, `verticalAlignment` |
| action | `Box(Modifier.clickable { })` | with `semantics { role = Role.Button }` |
| heading | `Text` | `style` from variant |
| text | `Text` | `maxLines`, `overflow = TextOverflow.Ellipsis` |
| date | `Text` | content from `formatDate` lambda |
| button | `Button` | `ButtonColors` from theme |
| image | `AsyncImage` (Coil) | `contentScale` from objectFit |

**Public API:**

```kotlin
import io.customer.jist.JistView

@Composable
fun NotificationCard(template: JistTemplate, data: Map<String, Any?>) {
    JistView(
        template = template,
        data = data,
        theme = theme,
        formatDate = { iso -> "2 hours ago" },
        onAction = { event ->
            Log.d("Jist", "${event.component} ${event.name}: ${event.data}")
        }
    )
}
```

**Layout mapping:**

| `align` | Compose alignment |
|---|---|
| `"start"` | `Alignment.Start` |
| `"end"` | `Alignment.End` |
| `"center"` | `Alignment.CenterHorizontally` |
| `"stretch"` | children use `Modifier.fillMaxWidth()` |

| `justify` | Compose arrangement |
|---|---|
| `"start"` | `Arrangement.Top` / `Start` |
| `"end"` | `Arrangement.Bottom` / `End` |
| `"center"` | `Arrangement.Center` |
| `"space-between"` | `Arrangement.SpaceBetween` |
| `"space-around"` | `Arrangement.SpaceAround` |
| `"space-evenly"` | `Arrangement.SpaceEvenly` |

| `objectFit` | Compose ContentScale |
|---|---|
| `"contain"` | `ContentScale.Fit` |
| `"cover"` | `ContentScale.Crop` |
| `"fill"` | `ContentScale.FillBounds` |

---

## Complete Example

**Template:**

```json
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
    "text": { "fontSize": 16, "fontWeight": 600, "color": "#1A1A2E" },
    "h4": {
      "text": { "fontSize": 13, "fontWeight": 500 }
    }
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
    },
    "states": {
      "hover": { "background": { "color": "#4338CA" } },
      "active": { "background": { "color": "#3730A3" } }
    }
  },
  "modes": {
    "dark": {
      "heading": {
        "text": { "color": "#F0F0F5" }
      },
      "text": {
        "text": { "color": "#B0B0C0" }
      },
      "date": {
        "text": { "color": "#707088" }
      },
      "button": {
        "background": { "color": "#6366F1" },
        "secondary": {
          "text": { "color": "#C0C0D0" },
          "background": { "color": "#2A2A3C" },
          "border": { "color": "#3A3A4C" }
        },
        "states": {
          "hover": { "background": { "color": "#5558E8" } },
          "active": { "background": { "color": "#4F46E5" } }
        }
      }
    }
  }
}
```

This template renders identically on all three platforms — a vertical card with heading, full-width image, body text, and a bottom row containing a date and secondary button. The theme adapts to light/dark mode automatically, with only color values overridden in dark mode.
