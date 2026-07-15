#!/usr/bin/env bash
# Builds JistCore.xcframework — the distributable Apple binary artifact for
# jist-core — plus the zip + checksum used by SwiftPM binary targets.
#
# Slices:
#   ios-arm64                       (device)
#   ios-arm64_x86_64-simulator      (Apple Silicon + Intel simulators, lipo'd)
#   macos-arm64_x86_64              (macOS, lipo'd — used by swift test on Macs)
#
# Output:
#   core/target/xcframework/JistCore.xcframework
#   core/target/xcframework/JistCore.xcframework.zip  (+ SHA-256 checksum)
#   ios/Libs/JistCore.xcframework                     (staged for the local
#                                                      path-based binaryTarget)
#
# Release flow: upload the zip to the GitHub release and point Package.swift's
# binaryTarget at its URL + checksum. Local dev uses the staged path instead.
#
# Requirements: rustup targets aarch64/x86_64-apple-ios(+sim) and
# x86_64-apple-darwin; full Xcode selected (or DEVELOPER_DIR set).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

OUT="$ROOT/target/xcframework"
HEADERS="$OUT/headers"
NAME="JistCore"

say() { printf '\n▶ %s\n' "$*"; }

say "Building Rust slices (release)"
cargo build -p jist-core --release --target aarch64-apple-ios
cargo build -p jist-core --release --target aarch64-apple-ios-sim
cargo build -p jist-core --release --target x86_64-apple-ios
cargo build -p jist-core --release --target aarch64-apple-darwin
cargo build -p jist-core --release --target x86_64-apple-darwin

say "Generating FFI header + modulemap"
rm -rf "$OUT" && mkdir -p "$HEADERS" "$OUT/sim" "$OUT/macos"
cargo run -p jist-core --bin uniffi-bindgen -- generate \
    --library target/aarch64-apple-ios/release/libjist_core.dylib \
    --language swift --out-dir "$HEADERS" >/dev/null 2>&1 || \
cargo run -p jist-core --bin uniffi-bindgen -- generate \
    --library target/aarch64-apple-darwin/release/libjist_core.dylib \
    --language swift --out-dir "$HEADERS"
# XCFramework headers use module.modulemap; drop the generated Swift file
# (it ships as source in ios/Sources/Jist/Generated, not in the framework).
mv "$HEADERS/jist_coreFFI.modulemap" "$HEADERS/module.modulemap"
rm -f "$HEADERS/jist_core.swift"

say "Lipo: universal simulator + macOS libraries"
lipo -create \
    target/aarch64-apple-ios-sim/release/libjist_core.a \
    target/x86_64-apple-ios/release/libjist_core.a \
    -output "$OUT/sim/libjist_core.a"
lipo -create \
    target/aarch64-apple-darwin/release/libjist_core.a \
    target/x86_64-apple-darwin/release/libjist_core.a \
    -output "$OUT/macos/libjist_core.a"

say "Assembling $NAME.xcframework"
xcodebuild -create-xcframework \
    -library target/aarch64-apple-ios/release/libjist_core.a -headers "$HEADERS" \
    -library "$OUT/sim/libjist_core.a" -headers "$HEADERS" \
    -library "$OUT/macos/libjist_core.a" -headers "$HEADERS" \
    -output "$OUT/$NAME.xcframework"

say "Zipping + checksum (for the SwiftPM url-based binaryTarget)"
(cd "$OUT" && ditto -c -k --keepParent "$NAME.xcframework" "$NAME.xcframework.zip")
CHECKSUM=$(swift package compute-checksum "$OUT/$NAME.xcframework.zip" 2>/dev/null \
    || shasum -a 256 "$OUT/$NAME.xcframework.zip" | cut -d' ' -f1)

say "Staging for local development (ios/Libs)"
rm -rf "$ROOT/../ios/Libs/$NAME.xcframework"
mkdir -p "$ROOT/../ios/Libs"
cp -R "$OUT/$NAME.xcframework" "$ROOT/../ios/Libs/$NAME.xcframework"

say "Done"
echo "  xcframework : $OUT/$NAME.xcframework"
echo "  zip         : $OUT/$NAME.xcframework.zip ($(du -h "$OUT/$NAME.xcframework.zip" | cut -f1))"
echo "  checksum    : $CHECKSUM"
