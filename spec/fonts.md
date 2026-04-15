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

For each name in the stack, Jist normalises it to a resource name (`"Roboto"` → `"roboto"`, `"Open Sans"` → `"open_sans"`) and probes `res/font/` for each standard weight suffix in order:

| FontWeight | Suffixes probed |
|---|---|
| Thin (100) | `_thin` |
| ExtraLight (200) | `_extralight`, `_extra_light` |
| Light (300) | `_light` |
| Normal (400) | `_regular`, `_normal`, *(no suffix)* |
| Medium (500) | `_medium` |
| SemiBold (600) | `_semibold`, `_semi_bold` |
| Bold (700) | `_bold` |
| ExtraBold (800) | `_extrabold`, `_extra_bold` |
| Black (900) | `_black` |

Every variant found is added to a Compose `FontFamily` as `Font(resId, weight)`. Compose then selects the correct file automatically when `fontWeight` changes — no extra code needed at the call site.

**Bundling fonts:**

Place font files in `res/font/` following the `familyname_weight.ttf` naming convention:

```
res/font/
  roboto_light.ttf
  roboto_regular.ttf
  roboto_medium.ttf
  roboto_bold.ttf
  roboto_black.ttf
```

Gradle picks up all files in `res/font/` automatically — no manifest or build config changes needed.

**Downloadable fonts:**

XML downloadable font declarations in `res/font/` (added via Android Studio's font picker) are resolved transparently by the same lookup — `getIdentifier` finds the XML resource and Compose handles the provider fetch. The same naming convention applies:

```
res/font/
  roboto_regular.xml   ← points to Google Fonts provider
  roboto_bold.xml
```

**Single-weight fonts:**

Place the file as `familyname.ttf` (no weight suffix, e.g. `abril_fatface.ttf`). It is found by the Normal/400 probe (the bare name fallback). `fontWeight` will be passed but Compose will apply synthetic weight since only one variant is registered.

---

## Weight matching behaviour

| Scenario | iOS | Android |
|---|---|---|
| Family with all weights bundled | Picks closest variant by trait distance | Picks exact weight file; Compose interpolates for missing weights |
| Family with partial weights (e.g. only Regular + Bold) | Picks closest available | Compose picks nearest available entry |
| Single-weight font | Uses that PostScript name; synthetic weight applied | One entry at Normal; synthetic weight applied |
| No font found in stack | `.system(size:weight:)` | Default system font |

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

Android — place in `res/font/`:
```
roboto_regular.ttf
roboto_bold.ttf
```
`FontFamily(Font(R.font.roboto_regular, Normal), Font(R.font.roboto_bold, Bold))` is built automatically. Compose routes each text element to the correct file.

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

Android — place in `res/font/`:
```
abril_fatface.ttf
```
The filename must follow the snake_case convention. The Normal probe tries `abril_fatface_regular` (not found), then `abril_fatface_normal` (not found), then `abril_fatface` (found). A single-entry `FontFamily` is built at `FontWeight.Normal`.

> **Filename conventions differ by platform.** iOS filenames are arbitrary — use whatever name the font vendor ships (e.g. `AbrilFatface-Regular.ttf`). Android filenames must be lowercase snake_case matching the probe pattern (e.g. `abril_fatface.ttf`). The theme value is always the family name on both platforms.
