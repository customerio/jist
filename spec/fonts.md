# Font Family Support

Jist supports custom fonts via the `fontFamily` theme property. This document covers how resolution works on each platform, what developers need to do to bundle their fonts, and the naming conventions that make weight variants work automatically.

## Theme usage

Set `fontFamily` in any `text` style group using the **font family name** — the human-readable name, not the PostScript name or filename:

```json
{
  "heading": {
    "text": {
      "fontFamily": "Roboto",
      "fontWeight": 700,
      "fontSize": 16
    }
  },
  "text": {
    "text": {
      "fontFamily": "Roboto",
      "fontWeight": 400,
      "fontSize": 14
    }
  }
}
```

Both entries reference `"Roboto"`. The platform resolves the correct weight variant file (`roboto_bold.ttf`, `roboto_regular.ttf`) automatically based on the accompanying `fontWeight` value.

## Font stack (fallback chain)

`fontFamily` accepts a comma-separated list of names, evaluated left to right — the same as CSS `font-family`:

```json
"fontFamily": "Abril Fatface, Georgia, serif"
```

The first name that resolves to an installed font wins. Generic names like `serif`, `sans-serif`, and `monospace` are not resolved; they fall through to the system font fallback at the end.

## Platform details

### iOS

**How resolution works:**

1. Each name in the stack is tried first as a **font family name** via `UIFont.fontNames(forFamilyName:)`.  
   If the family is registered, all its variants are returned (e.g. `["Roboto-Light", "Roboto-Regular", "Roboto-Bold"]`). Jist picks the variant whose `UIFontDescriptor` weight trait is closest to the requested `fontWeight`.

2. If no family variants are found, the name is tried as a **PostScript name** directly via `UIFont(name:size:)`.  
   This handles single-weight fonts where the PostScript name is the only registered entry (e.g. `"AbrilFatface-Regular"`).

3. If nothing resolves, `.system(size:weight:)` is used.

**Bundling fonts:**

Add every weight variant you intend to use to the Xcode target, then declare all of them in `Info.plist` under `UIAppFonts`. With XcodeGen, add them to `project.yml`:

```yaml
targets:
  YourApp:
    info:
      properties:
        UIAppFonts:
          - Roboto-Light.ttf
          - Roboto-Regular.ttf
          - Roboto-Medium.ttf
          - Roboto-Bold.ttf
          - Roboto-Black.ttf
```

iOS uses the family name embedded in the font file, not the filename — so the exact filenames don't matter as long as they're declared.

**Single-weight fonts:**

Use the PostScript name (found in the font file's name table, e.g. `"AbrilFatface-Regular"`). Jist will find it via the PostScript name fallback path. `fontWeight` will still be passed to the renderer but the system may apply synthetic weight since there is no matching variant.

---

### Android

**How resolution works:**

On Android, fonts are registered once via `JistTheme` — a composable that provides a `Map<String, FontFamily>` to all `JistView` calls within its subtree. Jist resolves each `fontFamily` CSS stack from the theme against this map using case-insensitive name matching (left to right through the stack). The result is cached per unique stack string per theme load.

```kotlin
val dmSans = FontFamily(
    Font(R.font.dm_sans_regular, FontWeight.Normal),
    Font(R.font.dm_sans_medium, FontWeight.Medium),
    Font(R.font.dm_sans_semibold, FontWeight.SemiBold),
    Font(R.font.dm_sans_bold, FontWeight.Bold),
)
val abrilFatface = FontFamily(Font(R.font.abril_fatface, FontWeight.Normal))

JistTheme(fonts = mapOf("DM Sans" to dmSans, "Abril Fatface" to abrilFatface)) {
    // All JistView calls here automatically use the fonts above.
    JistView(name = "inbox", templates = templates, data = data, theme = theme)
}
```

Map keys are the **font family name** as it appears in the theme (e.g. `"DM Sans"`, `"Abril Fatface"`). Matching is case-insensitive. Omitting `JistTheme` — or not including a name — causes the corresponding text to render in the system font.

**Bundling fonts:**

Place font files in `res/font/` of your app module following the `familyname_weight.ttf` naming convention:

```
res/font/
  dm_sans_regular.ttf
  dm_sans_medium.ttf
  dm_sans_semibold.ttf
  dm_sans_bold.ttf
  abril_fatface.ttf
```

Gradle picks up all files in `res/font/` automatically — no manifest or build config changes needed.

**Downloadable fonts:**

XML downloadable font declarations work the same way — reference them via `R.font.*` like any other resource:

```
res/font/
  dm_sans_regular.xml   ← points to Google Fonts provider
  dm_sans_bold.xml
```

```kotlin
val dmSans = FontFamily(
    Font(R.font.dm_sans_regular, FontWeight.Normal),
    Font(R.font.dm_sans_bold, FontWeight.Bold),
)
```

**Single-weight fonts:**

Supply a single-entry `FontFamily`. Compose will apply synthetic weight when `fontWeight` doesn't match:

```kotlin
val abrilFatface = FontFamily(Font(R.font.abril_fatface, FontWeight.Normal))
```

**Snapshot tests (Paparazzi):**

Paparazzi's layoutlib cannot load `ResourceFont` (`Font(resId)`). For snapshot tests, use `Font(path, assetManager, weight)` (AndroidAssetFont) instead, loading from `src/main/assets/fonts/`. Build the map explicitly and pass it to `JistTheme`:

```kotlin
private val fonts: Map<String, FontFamily> by lazy {
    val assets = paparazzi.context.assets
    fun assetFont(path: String, weight: FontWeight): Font? =
        runCatching { assets.open(path).close(); Font(path, assets, weight) }.getOrNull()

    buildMap {
        listOfNotNull(
            assetFont("fonts/dm_sans_regular.ttf", FontWeight.Normal),
            assetFont("fonts/dm_sans_medium.ttf", FontWeight.Medium),
            assetFont("fonts/dm_sans_semibold.ttf", FontWeight.SemiBold),
            assetFont("fonts/dm_sans_bold.ttf", FontWeight.Bold),
        ).takeIf { it.isNotEmpty() }?.let { put("DM Sans", FontFamily(it)) }

        listOfNotNull(
            assetFont("fonts/abril_fatface.ttf", FontWeight.Normal)
        ).takeIf { it.isNotEmpty() }?.let { put("Abril Fatface", FontFamily(it)) }
    }
}

// In your Paparazzi test:
paparazzi.snapshot {
    JistTheme(fonts = fonts) {
        JistView(name = "inbox", templates = allTemplates, data = data, theme = theme)
    }
}
```

Copy the same `.ttf` files used in `res/font/` into `src/main/assets/fonts/` of the app module. The assets directory is visible to Paparazzi; the resource directory is not.

---

## Weight matching behaviour

| Scenario | iOS | Android |
|---|---|---|
| Family with all weights bundled | Picks closest variant by trait distance | Picks exact weight file; Compose interpolates for missing weights |
| Family with partial weights (e.g. only Regular + Bold) | Picks closest available | Compose picks nearest available entry |
| Single-weight font | Uses that PostScript name; synthetic weight applied | One entry at Normal; synthetic weight applied |
| No font found in stack | `.system(size:weight:)` | System font (`fontFamily` returns `null`) |

## Example: Roboto (multi-weight)

Theme:
```json
{
  "heading": { "text": { "fontFamily": "Roboto", "fontWeight": 700 } },
  "text":    { "text": { "fontFamily": "Roboto", "fontWeight": 400 } }
}
```

iOS — bundle and declare in `UIAppFonts`:
```
Roboto-Regular.ttf
Roboto-Bold.ttf
```
`UIFont.fontNames(forFamilyName: "Roboto")` returns both. Heading gets `Roboto-Bold`, body text gets `Roboto-Regular`.

Android — place in `res/font/` and register via `JistTheme`:
```
roboto_regular.ttf
roboto_bold.ttf
```
```kotlin
val roboto = FontFamily(
    Font(R.font.roboto_regular, FontWeight.Normal),
    Font(R.font.roboto_bold, FontWeight.Bold),
)
JistTheme(fonts = mapOf("Roboto" to roboto)) { ... }
```
Compose routes each text element to the correct file based on `fontWeight`.

## Example: Abril Fatface (single-weight)

Theme:
```json
{
  "heading": { "text": { "fontFamily": "Abril Fatface", "fontWeight": 400 } }
}
```

Always use the **family name** in the theme — the same human-readable name shown in font pickers and on Google Fonts. Each platform then finds the right file through its own mechanism.

iOS — bundle and declare in `UIAppFonts`:
```
AbrilFatface-Regular.ttf
```
The filename can be anything (it's just for registration). iOS uses the family name embedded in the font file, so `UIFont.fontNames(forFamilyName: "Abril Fatface")` returns `["AbrilFatface-Regular"]` regardless of what the `.ttf` file is named on disk.

Android — place in `res/font/` and register via `JistTheme`:
```
abril_fatface.ttf
```
```kotlin
val abrilFatface = FontFamily(Font(R.font.abril_fatface, FontWeight.Normal))
JistTheme(fonts = mapOf("Abril Fatface" to abrilFatface)) { ... }
```
A single-entry `FontFamily` is built at `FontWeight.Normal`; Compose applies synthetic weight for other weights.

> **Filename conventions differ by platform.** iOS filenames are arbitrary — use whatever name the font vendor ships (e.g. `AbrilFatface-Regular.ttf`). Android filenames must be lowercase snake_case to match the `R.font.*` resource name convention (e.g. `abril_fatface.ttf`). The theme value is always the family name on both platforms.
