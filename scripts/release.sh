#!/bin/bash

CERT_NAME="Promptly Signing"
APP_PATH="dist/mac-universal/Promptly.app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── helpers ────────────────────────────────────────────────────────────────────
ok()   { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }
step() { echo ""; echo "▸ $1"; }

# ── arg check ──────────────────────────────────────────────────────────────────
VERSION="$1"
if [ -z "$VERSION" ]; then
  echo "Usage: bash scripts/release.sh <version>"
  echo "       e.g.  bash scripts/release.sh 1.3.0"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  fail "Version must be semver (e.g. 1.3.0), got: $VERSION"
fi

cd "$ROOT_DIR"

echo ""
echo "═══════════════════════════════════════════"
echo "  Promptly release — v$VERSION"
echo "═══════════════════════════════════════════"

# ── 1. Bump version in package.json ───────────────────────────────────────────
step "Updating package.json to v$VERSION"
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
" || fail "Failed to update package.json"
ok "package.json → v$VERSION"

# ── 2. Clean previous build artefacts ─────────────────────────────────────────
step "Cleaning dist/"
rm -rf dist/
ok "dist/ removed"

# ── 3. Build renderer ─────────────────────────────────────────────────────────
step "Building renderer (Vite)"
npm run build:renderer > /tmp/promptly-renderer.log 2>&1 \
  || { cat /tmp/promptly-renderer.log; fail "Renderer build failed"; }
ok "Renderer built"

# ── 4. Package with electron-builder (unsigned) ───────────────────────────────
step "Packaging with electron-builder (unsigned)"
npx electron-builder --mac --universal --config.mac.identity=null \
  > /tmp/promptly-builder.log 2>&1 \
  || { cat /tmp/promptly-builder.log; fail "electron-builder failed"; }
ok "App packaged → $APP_PATH"

# ── 5. Sign ───────────────────────────────────────────────────────────────────
step "Signing with \"$CERT_NAME\""

[ -d "$APP_PATH" ] || fail "$APP_PATH not found"

# Frameworks + dylibs first (order matters for deep signing)
find "$APP_PATH/Contents/Frameworks" -name "*.dylib" -o -name "*.framework" \
  | while read -r f; do
      codesign --force --sign "$CERT_NAME" --timestamp=none "$f" 2>/dev/null || true
    done

# Helper .app bundles
find "$APP_PATH/Contents" -name "*.app" \
  | while read -r helper; do
      codesign --force --sign "$CERT_NAME" --timestamp=none \
        --entitlements entitlements.plist "$helper" 2>/dev/null || true
    done

# Main bundle
codesign --deep --force --sign "$CERT_NAME" \
  --entitlements entitlements.plist \
  --options runtime \
  --timestamp=none \
  "$APP_PATH" \
  || fail "codesign failed"
ok "App signed"

# ── 6. Verify signature ───────────────────────────────────────────────────────
step "Verifying signature"
codesign --verify --deep --strict "$APP_PATH" \
  || fail "Signature verification failed — check cert name: \"$CERT_NAME\""
ok "Signature verified"

# ── 7. Create versioned DMG ───────────────────────────────────────────────────
DMG_NAME="Promptly-${VERSION}-signed.dmg"
DMG_PATH="dist/$DMG_NAME"

step "Creating $DMG_NAME"
hdiutil create \
  -volname "Promptly" \
  -srcfolder "$APP_PATH" \
  -ov -format UDZO \
  "$DMG_PATH" \
  > /tmp/promptly-dmg.log 2>&1 \
  || { cat /tmp/promptly-dmg.log; fail "hdiutil failed"; }
ok "DMG created → $DMG_PATH"

# ── done ──────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  ✓ Release complete — v$VERSION"
echo "  Output: $DMG_PATH"
echo "═══════════════════════════════════════════"
echo ""
