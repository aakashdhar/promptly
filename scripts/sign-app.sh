#!/bin/bash
set -e

CERT_NAME="Promptly Signing"
APP_PATH="dist/mac-universal/Promptly.app"

if [ ! -d "$APP_PATH" ]; then
  echo "Error: $APP_PATH not found — run npm run build:app first"
  exit 1
fi

echo "Signing Promptly.app with '$CERT_NAME'..."

# Sign all dylibs and frameworks first (deep signing order matters)
find "$APP_PATH/Contents/Frameworks" -name "*.dylib" -o -name "*.framework" | while read f; do
  codesign --force --sign "$CERT_NAME" --timestamp=none "$f" 2>/dev/null || true
done

# Sign helper apps
find "$APP_PATH/Contents" -name "*.app" | while read helper; do
  codesign --force --sign "$CERT_NAME" --timestamp=none \
    --entitlements entitlements.plist "$helper" 2>/dev/null || true
done

# Sign the main app bundle
codesign --deep --force --sign "$CERT_NAME" \
  --entitlements entitlements.plist \
  --options runtime \
  --timestamp=none \
  "$APP_PATH"

# Verify
codesign --verify --deep --strict "$APP_PATH" && \
  echo "✓ Signature verified successfully" || \
  echo "⚠ Signature verification failed — check cert name"

echo "✓ App signed"
