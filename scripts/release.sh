#!/bin/bash

CERT_NAME="Promptly Signing"
APP_PATH="dist/mac-universal/Promptly.app"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── helpers ────────────────────────────────────────────────────────────────────
ok()   { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }
step() { echo ""; echo "▸ $1"; }

# ── nvm init ───────────────────────────────────────────────────────────────────
# nvm installs node into a versioned shim dir that only loads in login shells.
# Running `bash release.sh` skips .zshrc, so node/npx are invisible to PATH.
# Source nvm explicitly — same pattern as main.js resolveClaudePath().
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# ── preflight ──────────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || fail "node not found — install Node.js or ensure nvm is configured"
command -v npx  >/dev/null 2>&1 || fail "npx not found — ensure npm is installed alongside node"

# ── health checks ─────────────────────────────────────────────────────────────
echo "Running preflight checks..."
bash scripts/preflight.sh || exit 1
echo "Running splash assertions..."
node scripts/assert-splash.js || exit 1
echo "All checks passed. Proceeding with build."

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

# ── 2b. Built-in speech engine ────────────────────────────────────────────────
step "Preparing built-in speech-to-text (whisper.cpp)"
bash scripts/fetch-whisper.sh || fail "Could not build or download the speech engine"
ok "Speech engine ready"

# ── 3. Build renderer ─────────────────────────────────────────────────────────
step "Building renderer (Vite)"
npm run build:renderer > /tmp/promptly-renderer.log 2>&1 \
  || { cat /tmp/promptly-renderer.log; fail "Renderer build failed"; }
ok "Renderer built"

# ── 4. Package with electron-builder (unsigned) ───────────────────────────────
step "Packaging with electron-builder (unsigned)"
npx electron-builder --mac dir --universal --config.mac.identity=null \
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

# Built-in speech engine (a plain executable under Resources, which --deep does not cover)
WHISPER_CLI="$APP_PATH/Contents/Resources/whisper/whisper-cli"
[ -f "$WHISPER_CLI" ] || fail "Speech engine missing from the app bundle"
codesign --force --sign "$CERT_NAME" --timestamp=none --options runtime "$WHISPER_CLI" \
  || fail "codesign failed for whisper-cli"

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
# electron-builder lays out the DMG window (Applications shortcut + first-open instructions
# background from build/dmg-background.png) around the already-signed app.
npx electron-builder --mac dmg --universal --prepackaged "$APP_PATH" \
  --config.mac.identity=null \
  --config.dmg.artifactName="$DMG_NAME" \
  > /tmp/promptly-dmg.log 2>&1 \
  || { cat /tmp/promptly-dmg.log; fail "DMG build failed"; }
[ -f "$DMG_PATH" ] || fail "DMG not found at $DMG_PATH"
ok "DMG created → $DMG_PATH"

# ── done ──────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  ✓ Release complete — v$VERSION"
echo "  Output: $DMG_PATH"
echo "═══════════════════════════════════════════"
echo ""
