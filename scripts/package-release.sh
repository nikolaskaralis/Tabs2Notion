#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTENSION_DIR="$ROOT/extension"
DIST_DIR="$ROOT/dist"
VERSION="$(node -p "require('$EXTENSION_DIR/manifest.json').version")"
OUTPUT="$DIST_DIR/Tabs2Notion-$VERSION.zip"

mkdir -p "$DIST_DIR"
rm -f "$OUTPUT"

(
  cd "$EXTENSION_DIR"
  zip -r -q "$OUTPUT" . \
    -x "*.DS_Store" "__MACOSX/*" "*.map" "*.log" "*.tmp"
)

if ! unzip -Z1 "$OUTPUT" | grep -qx "manifest.json"; then
  echo "ERROR: manifest.json is not at ZIP root" >&2
  exit 1
fi

if unzip -Z1 "$OUTPUT" | grep -Eq '^(backend/|tests/|\.git/)|(^|/)\.DS_Store$'; then
  echo "ERROR: development files found in release ZIP" >&2
  exit 1
fi

echo "Created $OUTPUT"
