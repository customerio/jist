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
