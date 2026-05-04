# Jist Spec Implementation Gaps

Audit of spec v1 against all three platform implementations.

**Legend:** :white_check_mark: implemented | :x: missing

---

## Open gaps

### Button interaction states

| State | Web | iOS | Android |
|---|---|---|---|
| `hover` | :white_check_mark: `:hover` | :x: | :x: |
| `active` | :white_check_mark: `:active` | :white_check_mark: `isPressed` | :x: |
| `disabled` | :white_check_mark: `:disabled` | :x: | :x: |

**iOS:** No hover (iPadOS/macOS pointer) or disabled state handling.

**Android:** `JistButtonView` in `Renderer.kt:464-549` has no state-dependent styling at all.

### Image variant support

Variant support via theme needs verification on native.

---

## Summary

| Platform | Open gaps |
|---|---|
| Web | None |
| iOS | Button hover and disabled states |
| Android | Button hover, active, and disabled states |

---

## Resolved

| Gap | Platforms | Resolution |
|---|---|---|
| Layout `justify: space-around` / `space-evenly` | iOS | Spacer-based layout in `Renderer.swift` |
| DynamicLayout `justify` (all values) | iOS | Same Spacer patterns as Layout |
| Layout `align: baseline` on horizontal | Android | `Modifier.alignByBaseline()` applied to each child in Row |
| Theme padding & margin for heading/text/date | iOS, Android | Theme resolver calls added |
| Button shadow | iOS, Android | Shadow modifiers added |
| Button margin | iOS, Android | Margin modifiers added |
| Image theme properties (border, padding, margin) | iOS, Android | Theme resolver calls added |
