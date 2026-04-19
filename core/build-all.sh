#!/usr/bin/env bash
# Builds jist-core for every supported target and reports artifact sizes.
# Fails fast on any target failure.
#
# Requirements:
#   - rustup with iOS + Android + wasm32 targets (installed via rust-toolchain.toml on first run)
#   - cargo-ndk (cargo install cargo-ndk)
#   - wasm-pack (cargo install wasm-pack)
#   - ANDROID_NDK_HOME or ANDROID_NDK_ROOT pointing at a valid NDK install
#
# Usage: bash core/build-all.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

: "${ANDROID_NDK_HOME:=${ANDROID_NDK_ROOT:-}}"
export ANDROID_NDK_HOME

say() { printf '\n▶ %s\n' "$*"; }
size() { ls -l "$1" 2>/dev/null | awk '{print $5}' | numfmt --to=iec --suffix=B 2>/dev/null || ls -lh "$1" 2>/dev/null | awk '{print $5}'; }

say "Host build + tests"
cargo test --release --quiet

say "iOS (device: aarch64-apple-ios)"
cargo build --target aarch64-apple-ios --release --quiet
echo "  libjist_core.a → $(size target/aarch64-apple-ios/release/libjist_core.a)"

say "iOS (simulator: aarch64-apple-ios-sim)"
cargo build --target aarch64-apple-ios-sim --release --quiet
echo "  libjist_core.a → $(size target/aarch64-apple-ios-sim/release/libjist_core.a)"

if [[ -z "${ANDROID_NDK_HOME:-}" ]]; then
    say "Android (skipped — ANDROID_NDK_HOME not set)"
else
    say "Android (arm64-v8a + x86_64) via cargo-ndk"
    cargo ndk -t arm64-v8a -t x86_64 -o target/android build --release 2>&1 | tail -3
    echo "  arm64-v8a → $(size target/android/arm64-v8a/libjist_core.so)"
    echo "  x86_64    → $(size target/android/x86_64/libjist_core.so)"
fi

say "Web (wasm32 via wasm-pack)"
( cd jist-core && wasm-pack build --target web --release 2>&1 | tail -3 )
echo "  .wasm → $(size jist-core/pkg/jist_core_bg.wasm)"
echo "  .js   → $(size jist-core/pkg/jist_core.js)"

say "All targets built successfully."
