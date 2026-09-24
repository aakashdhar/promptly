#!/bin/bash
# Builds native/helper/main.swift into a universal (arm64 + x86_64) binary at
# vendor/helper/promptly-helper. electron-builder ships it in Contents/Resources/helper.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT_DIR/native/helper/main.swift"
OUT_DIR="$ROOT_DIR/vendor/helper"
OUT="$OUT_DIR/promptly-helper"
TMP="$ROOT_DIR/.cache/helper-build"

if [ -x "$OUT" ] && [ "$OUT" -nt "$SRC" ]; then
  echo "  ✓ promptly-helper up to date"
  exit 0
fi

mkdir -p "$OUT_DIR" "$TMP"
SDK="$(xcrun --show-sdk-path)"
for arch in arm64 x86_64; do
  xcrun swiftc -O -sdk "$SDK" -target "$arch-apple-macos12.0" "$SRC" -o "$TMP/promptly-helper-$arch"
done
lipo -create "$TMP/promptly-helper-arm64" "$TMP/promptly-helper-x86_64" -output "$OUT"
echo "  ✓ promptly-helper built ($(lipo -archs "$OUT"))"
