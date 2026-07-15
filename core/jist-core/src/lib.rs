// jist-core — shared non-rendering logic for Jist.
//
// This crate is the source of truth for models, theme resolution, font
// resolution, and template validation across iOS, Android, and Web. It
// exposes an idiomatic host-language API via UniFFI (Swift, Kotlin) and
// wasm-bindgen (TypeScript/Web).
//
// Current status: scaffolding only. Only `jist_version()` is exposed as a
// smoke test for the binding pipeline. Real logic ports are follow-up PRs.

uniffi::include_scaffolding!("jist_core");

/// Canonical template model + parsing. The single source of truth for the
/// node tree that iOS/Android/Web hand-wrote three times. FFI exposure of
/// these types is the follow-on step (PR 3b — see docs/jist-core-migration.md).
pub mod models;

/// Theme cascade + hex color parsing + font-weight bucketing — previously
/// duplicated line-for-line in ThemeResolver.swift / ThemeResolver.kt.
pub mod theme_resolver;

/// Web entry point. Parses a template JSON string into a normalized template
/// tree and returns it as a plain JS object (throws on invalid input). The
/// browser renderer consumes this directly, so parsing + normalization —
/// unknown-node handling, the width union, forward-compat — live here in Rust
/// instead of hand-written TypeScript.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn parse_template(json: &str) -> Result<models::JistTemplate, wasm_bindgen::JsValue> {
    models::parse_template(json).map_err(|e| wasm_bindgen::JsValue::from_str(&e.to_string()))
}

// ── Native (UniFFI) entry points — Swift / Kotlin ───────────────────────────
//
// These are the same parse functions exposed to the web above, surfaced to
// iOS/Android through UniFFI-generated bindings. Hosts hand JSON strings in
// and get the canonical typed tree back; the hand-written per-platform model
// decoders (Models.swift / Models.kt / JistValue.swift) are deleted in favor
// of these.

#[cfg(not(target_arch = "wasm32"))]
#[uniffi::export]
pub fn parse_template_json(
    json: String,
) -> Result<models::JistTemplate, models::ParseError> {
    models::parse_template(&json)
}

#[cfg(not(target_arch = "wasm32"))]
#[uniffi::export]
pub fn parse_registry_json(
    json: String,
) -> Result<std::collections::HashMap<String, Vec<models::JistTemplate>>, models::ParseError> {
    models::parse_registry(&json)
}

#[cfg(not(target_arch = "wasm32"))]
#[uniffi::export]
pub fn parse_data_json(
    json: String,
) -> Result<std::collections::HashMap<String, models::JistValue>, models::ParseError> {
    models::parse_data(&json)
}

/// Returns the semver version of jist-core. Used as a smoke test across
/// all three UniFFI consumers (Swift, Kotlin, TS/WASM).
#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
pub fn jist_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_non_empty() {
        let v = jist_version();
        assert!(!v.is_empty());
        assert!(v.chars().any(|c| c.is_ascii_digit()));
    }
}
