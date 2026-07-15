// Small helper binary for generating UniFFI bindings via the CLI.
// Run: `cargo run --bin uniffi-bindgen -- ...`
//
// UniFFI is a native-only dependency (excluded from wasm builds), so this
// binary is a no-op stub when the workspace is compiled for wasm32.
#[cfg(not(target_arch = "wasm32"))]
fn main() {
    uniffi::uniffi_bindgen_main()
}

#[cfg(target_arch = "wasm32")]
fn main() {}
