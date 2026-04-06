#!/bin/bash
# Copies shared fixtures and schemas into src/lib/shared/ so Turbopack can
# resolve them (it refuses to follow imports outside the project root).
# Run automatically via the predev / prebuild npm scripts.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILDER_DIR="$(dirname "$SCRIPT_DIR")"
JIST_ROOT="$(dirname "$BUILDER_DIR")"
DEST="$BUILDER_DIR/src/lib/shared"

mkdir -p "$DEST"

cp "$JIST_ROOT/shared/templates.json"              "$DEST/templates.json"
cp "$JIST_ROOT/shared/data.json"                   "$DEST/data.json"
cp "$JIST_ROOT/shared/theme.json"                  "$DEST/theme.json"
cp "$JIST_ROOT/spec/jist-template-schema.json"     "$DEST/jist-template-schema.json"
cp "$JIST_ROOT/spec/jist-theme-schema.json"        "$DEST/jist-theme-schema.json"

echo "Synced shared fixtures and schemas into src/lib/shared/"
