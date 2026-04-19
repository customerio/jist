# jist-core

Shared non-rendering logic for Jist: models, theme resolution, font resolution, and template validation. Written once in Rust, consumed by iOS (Swift via UniFFI), Android (Kotlin via UniFFI + JNI), and Web (TypeScript via WASM).

**Status: scaffolding only.** The crate currently exposes a single `jist_version()` function as a smoke test for the binding pipeline. Real logic ports are follow-up work — see [`docs/jist-core-migration.md`](../docs/jist-core-migration.md).

---

## Prerequisites

- Rust 1.93+ (managed via `rust-toolchain.toml` — `rustup` will auto-install on first build)
- For iOS: Xcode 15+ and the iOS targets (installed automatically by rustup)
- For Android: the Android NDK (r25+). Set `ANDROID_NDK_HOME` or `ANDROID_NDK_ROOT` before running Android builds.
- For Web: [`wasm-pack`](https://rustwasm.github.io/wasm-pack/) (`cargo install wasm-pack`)
- For cross-compile convenience: [`cargo-ndk`](https://github.com/bbqsrc/cargo-ndk) (`cargo install cargo-ndk`)

## Quick verification

```bash
# From this directory (core/):
cargo test                                                  # Host unit tests
cargo build --target aarch64-apple-ios --release            # iOS device
cargo build --target aarch64-apple-ios-sim --release        # iOS simulator (Apple silicon)
cargo ndk -t arm64-v8a -t x86_64 build --release            # Android (arm64 + x86_64)
( cd jist-core && wasm-pack build --target web --release )  # Web (WASM)
```

## Generating bindings

UniFFI bindings (Swift, Kotlin) are regenerated from `src/jist_core.udl`:

```bash
cd jist-core
cargo run --bin uniffi-bindgen -- generate src/jist_core.udl --language swift  --out-dir ../out-bindings/swift
cargo run --bin uniffi-bindgen -- generate src/jist_core.udl --language kotlin --out-dir ../out-bindings/kotlin
```

Web bindings are produced directly by `wasm-pack` alongside the `.wasm` artifact (see `jist-core/pkg/` after a WASM build).

## Verified build targets

The scaffolding has been smoke-tested on the following targets during setup:

| Target | Status | Artifact | Unstripped size |
|---|---|---|---|
| `x86_64-apple-darwin` / `aarch64-apple-darwin` (host) | ✅ Build + test | rlib | n/a |
| `aarch64-apple-ios` (device) | ✅ Cross-compile | `libjist_core.a` | ~37 MB (archive — shrinks to KB after link) |
| `aarch64-apple-ios-sim` (M-series Sim) | ✅ Cross-compile | `libjist_core.a` | ~37 MB (archive) |
| `arm64-v8a` (Android) | ✅ Cross-compile via cargo-ndk | `libjist_core.so` | ~316 KB stripped |
| `x86_64` (Android) | ✅ Cross-compile via cargo-ndk | `libjist_core.so` | ~348 KB stripped |
| `wasm32-unknown-unknown` | ✅ `wasm-pack build --target web` | `jist_core_bg.wasm` + JS loader | ~36 KB WASM + ~5 KB JS |

The hello-world numbers are unrepresentative of final sizes — they'll grow as real logic lands. Each port PR should re-measure.

## Layout

```
core/
├── Cargo.toml              # Cargo workspace root
├── rust-toolchain.toml     # Pinned Rust + targets
├── jist-core/              # The library crate
│   ├── Cargo.toml
│   ├── build.rs            # UniFFI scaffolding generator
│   ├── uniffi-bindgen.rs   # CLI entry point for binding generation
│   └── src/
│       ├── lib.rs          # Rust implementation
│       └── jist_core.udl   # UniFFI interface definition (source of truth for public API)
└── README.md               # This file
```

## Design notes

- **Static linking**: iOS consumes the static `.a` via an XCFramework; Android consumes the shared `.so` loaded via `System.loadLibrary()`; Web consumes the `.wasm` directly. No dynamic runtime sits between Rust and the host beyond UniFFI's generated binding code.
- **Panic = abort**: release builds abort on panic. Every public function that can fail must return `Result<T, Error>`; panics are programmer errors, not recoverable conditions.
- **Size budget**: target ≤500 KB added per platform (stripped, LTO, `opt-level = "z"`). Reassess if exceeded.
- **Wire stability**: models will mirror the `x-jist-tag` IDs declared in `spec/*.json`. Field tags are forever; names are renameable.

## Adding a new function to the public API

1. Add the declaration to `jist-core/src/jist_core.udl`.
2. Implement in `jist-core/src/lib.rs`. Use `Result<T, YourError>` for anything that can fail.
3. Add a unit test in the same file.
4. Regenerate bindings: `cd jist-core && cargo run --bin uniffi-bindgen -- generate src/jist_core.udl --language swift --out-dir ...` (and similarly for kotlin).
5. Update the host platform integration (iOS / Android / Web) to consume the new function.
