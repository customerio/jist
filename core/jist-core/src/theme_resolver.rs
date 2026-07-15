// Theme resolution — the single implementation of Jist's theme cascade.
//
// Before this module, the cascade lived twice, line-for-line identical:
//   - ios/Sources/Jist/ThemeResolver.swift   (~135 LOC)
//   - android/.../ThemeResolver.kt           (~127 LOC)
// along with duplicated hex-color parsing and font-weight bucket tables that
// had already begun to drift (`ultraLight` vs `Thin` for weight <200 — they
// correspond only by convention).
//
// The cascade, for a lookup of (type, variant, group, property, state):
//   state paths first (if a state is given), then non-state paths.
//   Within each: dark variant → dark base → light variant → light base.
// Dark-mode overrides live under `modes.dark.*` in the theme document.

use crate::models::JistValue;
use std::collections::HashMap;
use std::sync::Arc;

/// An RGBA color parsed from a hex string, each channel in `0.0..=1.0`.
/// Hosts map this onto their native color type (SwiftUI `Color`,
/// Compose `Color`, CSS `rgba()`).
#[derive(Debug, Clone, Copy, PartialEq)]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Record))]
pub struct Rgba {
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

/// Parse a `#RRGGBB` or `#RRGGBBAA` hex color (leading `#` optional,
/// surrounding whitespace ignored, case-insensitive).
pub fn parse_hex_color(hex: &str) -> Option<Rgba> {
    let h = hex.trim().trim_start_matches('#');
    let byte = |i: usize| u8::from_str_radix(&h[i..i + 2], 16).ok();
    match h.len() {
        6 => Some(Rgba {
            r: byte(0)? as f64 / 255.0,
            g: byte(2)? as f64 / 255.0,
            b: byte(4)? as f64 / 255.0,
            a: 1.0,
        }),
        8 => Some(Rgba {
            r: byte(0)? as f64 / 255.0,
            g: byte(2)? as f64 / 255.0,
            b: byte(4)? as f64 / 255.0,
            a: byte(6)? as f64 / 255.0,
        }),
        _ => None,
    }
}

/// Bucket a numeric font weight into the standard 100–900 steps. Hosts map
/// the bucket onto their platform weight enum (100 → `.ultraLight` /
/// `FontWeight.Thin` / `font-weight: 100`), which keeps the *thresholds* —
/// the part that was silently drifting — in one place.
pub fn font_weight_bucket(value: f64) -> u16 {
    match value {
        v if v < 200.0 => 100,
        v if v < 300.0 => 200,
        v if v < 400.0 => 300,
        v if v < 500.0 => 400,
        v if v < 600.0 => 500,
        v if v < 700.0 => 600,
        v if v < 800.0 => 700,
        v if v < 900.0 => 800,
        _ => 900,
    }
}

/// Resolves theme properties through the Jist cascade. Construct once per
/// (theme, color-mode) pair and query per property.
#[derive(Debug)]
#[cfg_attr(not(target_arch = "wasm32"), derive(uniffi::Object))]
pub struct ThemeResolver {
    theme: JistValue,
    is_dark: bool,
}

#[cfg_attr(not(target_arch = "wasm32"), uniffi::export)]
impl ThemeResolver {
    #[cfg_attr(not(target_arch = "wasm32"), uniffi::constructor)]
    pub fn new(theme: HashMap<String, JistValue>, is_dark: bool) -> Arc<Self> {
        Arc::new(Self {
            theme: JistValue::Object(theme),
            is_dark,
        })
    }

    /// Resolve a theme property through the cascade. Returns the raw value;
    /// use the typed variants below when a specific type is expected.
    pub fn resolve(
        &self,
        type_name: String,
        variant: Option<String>,
        group: String,
        property: String,
        state: Option<String>,
    ) -> Option<JistValue> {
        let t = type_name.as_str();
        let g = group.as_str();
        let p = property.as_str();
        let v = variant.as_deref();

        if let Some(s) = state.as_deref() {
            if self.is_dark {
                if let Some(var) = v {
                    if let Some(val) = self.dig(&["modes", "dark", t, var, "states", s, g, p]) {
                        return Some(val);
                    }
                }
                if let Some(val) = self.dig(&["modes", "dark", t, "states", s, g, p]) {
                    return Some(val);
                }
            }
            if let Some(var) = v {
                if let Some(val) = self.dig(&[t, var, "states", s, g, p]) {
                    return Some(val);
                }
            }
            if let Some(val) = self.dig(&[t, "states", s, g, p]) {
                return Some(val);
            }
        }

        if self.is_dark {
            if let Some(var) = v {
                if let Some(val) = self.dig(&["modes", "dark", t, var, g, p]) {
                    return Some(val);
                }
            }
            if let Some(val) = self.dig(&["modes", "dark", t, g, p]) {
                return Some(val);
            }
        }
        if let Some(var) = v {
            if let Some(val) = self.dig(&[t, var, g, p]) {
                return Some(val);
            }
        }
        self.dig(&[t, g, p])
    }

    /// Resolve a string-valued property (e.g. a hex color literal).
    pub fn resolve_string(
        &self,
        type_name: String,
        variant: Option<String>,
        group: String,
        property: String,
        state: Option<String>,
    ) -> Option<String> {
        self.resolve(type_name, variant, group, property, state)
            .and_then(|v| v.as_str().map(str::to_owned))
    }

    /// Resolve a numeric property, falling back when absent or non-numeric.
    pub fn resolve_number(
        &self,
        type_name: String,
        variant: Option<String>,
        group: String,
        property: String,
        state: Option<String>,
        fallback: f64,
    ) -> f64 {
        self.resolve(type_name, variant, group, property, state)
            .and_then(|v| v.as_f64())
            .unwrap_or(fallback)
    }

    /// Resolve an integral property (e.g. `maxLines`).
    pub fn resolve_int(
        &self,
        type_name: String,
        variant: Option<String>,
        group: String,
        property: String,
    ) -> Option<i64> {
        self.resolve(type_name, variant, group, property, None)
            .and_then(|v| v.as_f64())
            .map(|n| n as i64)
    }

    /// Resolve a color property to RGBA components; `None` when the property
    /// is absent or not a parseable hex string (hosts then use their fallback).
    pub fn resolve_color(
        &self,
        type_name: String,
        variant: Option<String>,
        group: String,
        property: String,
        state: Option<String>,
    ) -> Option<Rgba> {
        self.resolve_string(type_name, variant, group, property, state)
            .and_then(|hex| parse_hex_color(&hex))
    }
}

impl ThemeResolver {
    fn dig(&self, path: &[&str]) -> Option<JistValue> {
        let mut current = &self.theme;
        for key in path {
            current = current.get(key)?;
        }
        Some(current.clone())
    }
}

// Free-function FFI surface for the stateless helpers.

/// See [`font_weight_bucket`].
#[cfg_attr(not(target_arch = "wasm32"), uniffi::export)]
pub fn font_weight_bucket_ffi(value: f64) -> u16 {
    font_weight_bucket(value)
}

/// See [`parse_hex_color`].
#[cfg_attr(not(target_arch = "wasm32"), uniffi::export)]
pub fn parse_hex_color_ffi(hex: String) -> Option<Rgba> {
    parse_hex_color(&hex)
}

// ── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::parse_data;

    const THEME: &str = include_str!("../../../shared/theme.json");

    fn resolver(is_dark: bool) -> Arc<ThemeResolver> {
        ThemeResolver::new(parse_data(THEME).expect("theme.json parses"), is_dark)
    }

    fn resolve_str(r: &ThemeResolver, t: &str, v: Option<&str>, g: &str, p: &str) -> Option<String> {
        r.resolve_string(t.into(), v.map(Into::into), g.into(), p.into(), None)
    }

    #[test]
    fn hex_parsing_6_and_8_digit() {
        assert_eq!(
            parse_hex_color("#4F46E5"),
            Some(Rgba { r: 0x4F as f64 / 255.0, g: 0x46 as f64 / 255.0, b: 0xE5 as f64 / 255.0, a: 1.0 })
        );
        assert_eq!(parse_hex_color("4f46e5").map(|c| (c.a * 255.0) as u8), Some(255));
        assert_eq!(
            parse_hex_color("#11223344"),
            Some(Rgba { r: 0x11 as f64 / 255.0, g: 0x22 as f64 / 255.0, b: 0x33 as f64 / 255.0, a: 0x44 as f64 / 255.0 })
        );
        assert_eq!(parse_hex_color("#123"), None);
        assert_eq!(parse_hex_color("not-a-color"), None);
        assert_eq!(parse_hex_color("  #FFFFFF  ").map(|c| c.r), Some(1.0));
    }

    #[test]
    fn font_weight_buckets_match_the_platform_tables() {
        // Mirrors the (previously duplicated) Swift/Kotlin threshold tables.
        assert_eq!(font_weight_bucket(100.0), 100);
        assert_eq!(font_weight_bucket(199.9), 100);
        assert_eq!(font_weight_bucket(200.0), 200);
        assert_eq!(font_weight_bucket(400.0), 400);
        assert_eq!(font_weight_bucket(450.0), 400);
        assert_eq!(font_weight_bucket(600.0), 600);
        assert_eq!(font_weight_bucket(899.0), 800);
        assert_eq!(font_weight_bucket(900.0), 900);
        assert_eq!(font_weight_bucket(1000.0), 900);
    }

    #[test]
    fn resolves_base_properties_from_the_real_theme() {
        let r = resolver(false);
        // heading text color exists in the real theme
        let color = resolve_str(&r, "heading", None, "text", "color");
        assert!(color.is_some(), "heading/text/color should resolve from shared/theme.json");
    }

    #[test]
    fn dark_mode_overrides_win_when_dark() {
        let light = resolver(false);
        let dark = resolver(true);
        // The real theme defines modes.dark overrides for text colors; the two
        // modes must therefore disagree somewhere.
        let l = resolve_str(&light, "heading", None, "text", "color");
        let d = resolve_str(&dark, "heading", None, "text", "color");
        assert!(l.is_some() && d.is_some());
        assert_ne!(l, d, "dark mode should override the heading text color");
    }

    #[test]
    fn variant_beats_base_and_missing_variant_falls_back() {
        let theme: HashMap<String, JistValue> = parse_data(
            r##"{
                "button": {
                    "background": {"color": "#111111"},
                    "primary": {"background": {"color": "#222222"}}
                }
            }"##,
        )
        .unwrap();
        let r = ThemeResolver::new(theme, false);
        assert_eq!(
            r.resolve_string("button".into(), Some("primary".into()), "background".into(), "color".into(), None),
            Some("#222222".into())
        );
        // Unknown variant → base value.
        assert_eq!(
            r.resolve_string("button".into(), Some("ghost".into()), "background".into(), "color".into(), None),
            Some("#111111".into())
        );
    }

    #[test]
    fn state_paths_take_precedence() {
        let theme: HashMap<String, JistValue> = parse_data(
            r##"{
                "button": {
                    "background": {"color": "#111111"},
                    "states": {"active": {"background": {"color": "#333333"}}}
                },
                "modes": {"dark": {"button": {"states": {"active": {"background": {"color": "#444444"}}}}}}
            }"##,
        )
        .unwrap();
        let light = ThemeResolver::new(theme.clone(), false);
        let dark = ThemeResolver::new(theme, true);
        assert_eq!(
            light.resolve_string("button".into(), None, "background".into(), "color".into(), Some("active".into())),
            Some("#333333".into())
        );
        assert_eq!(
            dark.resolve_string("button".into(), None, "background".into(), "color".into(), Some("active".into())),
            Some("#444444".into())
        );
        // No state → base.
        assert_eq!(
            light.resolve_string("button".into(), None, "background".into(), "color".into(), None),
            Some("#111111".into())
        );
    }

    #[test]
    fn resolve_number_and_int_fall_back_correctly() {
        let r = resolver(false);
        // Absent property → fallback.
        let n = r.resolve_number("nonexistent".into(), None, "text".into(), "fontSize".into(), None, 42.0);
        assert_eq!(n, 42.0);
        // maxLines may or may not exist; must not panic either way.
        let _ = r.resolve_int("text".into(), None, "text".into(), "maxLines".into());
    }
}
