#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXAMPLE_DIR="$SCRIPT_DIR/Example"
SHARED_DIR="$SCRIPT_DIR/../shared"

# ── Preflight ────────────────────────────────

if ! command -v xcodegen &>/dev/null; then
    echo "Installing xcodegen via Homebrew..."
    brew install xcodegen
fi

if ! command -v xcodebuild &>/dev/null; then
    echo "Error: Xcode command-line tools not found. Install Xcode first."
    exit 1
fi

# ── Copy shared fixtures ─────────────────────

echo "Copying shared fixtures..."
cp "$SHARED_DIR/templates.json" "$EXAMPLE_DIR/JistExample/"
cp "$SHARED_DIR/data.json"      "$EXAMPLE_DIR/JistExample/"
cp "$SHARED_DIR/theme.json"     "$EXAMPLE_DIR/JistExample/"

# ── Generate Xcode project ───────────────────

echo "Generating Xcode project..."
cd "$EXAMPLE_DIR"
xcodegen generate --quiet 2>/dev/null || xcodegen generate

# ── Find simulator ───────────────────────────

echo "Finding available iPhone simulator..."
DEVICE=$(xcrun simctl list devices available -j | python3 -c "
import json, sys
data = json.load(sys.stdin)['devices']
for runtime in sorted(data.keys(), reverse=True):
    if 'iOS' in runtime:
        for d in data[runtime]:
            if 'iPhone' in d['name'] and d['isAvailable']:
                print(d['udid'])
                sys.exit(0)
sys.exit(1)
")

DEVICE_NAME=$(xcrun simctl list devices available -j | python3 -c "
import json, sys
data = json.load(sys.stdin)['devices']
for runtime in sorted(data.keys(), reverse=True):
    if 'iOS' in runtime:
        for d in data[runtime]:
            if d['udid'] == '$DEVICE':
                print(d['name'])
                sys.exit(0)
")

echo "Using simulator: $DEVICE_NAME ($DEVICE)"

# ── Boot & open simulator ────────────────────

xcrun simctl boot "$DEVICE" 2>/dev/null || true
open -a Simulator

# ── Build ─────────────────────────────────────

echo "Building JistExample..."
set +o pipefail
xcodebuild \
    -project JistExample.xcodeproj \
    -scheme JistExample \
    -destination "id=$DEVICE" \
    -derivedDataPath "$EXAMPLE_DIR/.build" \
    build 2>&1 | tail -3
BUILD_RESULT=${PIPESTATUS[0]}
set -o pipefail

if [ "$BUILD_RESULT" -ne 0 ]; then
    echo ""
    echo "Build failed. Run with full output:"
    echo "  cd $EXAMPLE_DIR && xcodebuild -project JistExample.xcodeproj -scheme JistExample -destination \"id=$DEVICE\" build"
    exit 1
fi

# ── Install & launch ─────────────────────────

APP=$(find "$EXAMPLE_DIR/.build" -name "JistExample.app" -path "*/Debug-iphonesimulator/*" -maxdepth 8 | head -1)

if [ -z "$APP" ]; then
    echo "Error: Could not find built app."
    exit 1
fi

echo "Installing and launching..."
xcrun simctl terminate "$DEVICE" com.customerio.jist.JistExample 2>/dev/null || true
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl launch "$DEVICE" com.customerio.jist.JistExample

echo ""
echo "JistExample is running in the simulator."
