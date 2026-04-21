#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$SCRIPT_DIR/../shared"

# ── Preflight ────────────────────────────────

ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$ANDROID_HOME" ]; then
    # Common locations
    for dir in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "/usr/local/share/android-sdk"; do
        if [ -d "$dir" ]; then
            ANDROID_HOME="$dir"
            break
        fi
    done
fi

if [ -z "$ANDROID_HOME" ] || [ ! -d "$ANDROID_HOME" ]; then
    echo "Error: Android SDK not found."
    echo "Set ANDROID_HOME or install Android Studio."
    exit 1
fi

export ANDROID_HOME
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

echo "Android SDK: $ANDROID_HOME"

# ── Copy shared fixtures ─────────────────────

echo "Copying shared fixtures..."
mkdir -p "$SCRIPT_DIR/example/src/main/res/raw"
cp "$SHARED_DIR/templates.json" "$SCRIPT_DIR/example/src/main/res/raw/"
cp "$SHARED_DIR/data.json"      "$SCRIPT_DIR/example/src/main/res/raw/"
cp "$SHARED_DIR/theme.json"     "$SCRIPT_DIR/example/src/main/res/raw/"

# ── Gradle wrapper ───────────────────────────

cd "$SCRIPT_DIR"
if [ ! -f "gradlew" ]; then
    echo "Setting up Gradle wrapper..."
    if command -v gradle &>/dev/null; then
        gradle wrapper --gradle-version 8.11.1
    else
        echo "Error: Gradle not found. Install via: brew install gradle"
        exit 1
    fi
fi
chmod +x gradlew

# ── Find or start device ─────────────────────

DEVICE=""

# Check for running device/emulator
if command -v adb &>/dev/null; then
    DEVICE=$(adb devices 2>/dev/null | grep -E "emulator|device$" | head -1 | awk '{print $1}') || true
fi

if [ -z "$DEVICE" ]; then
    echo "No running device found. Starting emulator..."

    # Find available AVD
    AVD=$(emulator -list-avds 2>/dev/null | head -1)
    if [ -z "$AVD" ]; then
        echo "No AVD found. Create one in Android Studio or run:"
        echo "  sdkmanager 'system-images;android-35;google_apis;arm64-v8a'"
        echo "  avdmanager create avd -n Pixel6 -k 'system-images;android-35;google_apis;arm64-v8a' -d pixel_6"
        exit 1
    fi

    echo "Booting AVD: $AVD"
    emulator -avd "$AVD" -no-snapshot-load &
    EMULATOR_PID=$!

    # Wait for device to come online
    echo "Waiting for emulator to boot..."
    adb wait-for-device
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null)" != "1" ]; do
        sleep 2
    done
    echo "Emulator ready."

    DEVICE=$(adb devices | grep emulator | head -1 | awk '{print $1}') || true
fi

echo "Using device: $DEVICE"

# ── Build & install ──────────────────────────

echo "Building JistExample..."
./gradlew :example:installDebug 2>&1 | tail -5

echo "Launching app..."
adb -s "$DEVICE" shell am start -n io.customer.jist.example/.MainActivity

echo ""
echo "JistExample is running on $DEVICE."
