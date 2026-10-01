#!/bin/bash

CERT_NAME="Promptly Signing"
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

# Every step below already ends in `|| fail`; this also stops on any step added without one.
# (Not -u: nvm.sh, sourced above, isn't safe under it.)
set -eo pipefail

# Use the Node version the project pins (.nvmrc). electron-builder 26 require()s ES modules, which
# needs Node 20.19+ or 22.12+; an older Node in the current shell failed the 2.19.3 build.
if command -v nvm >/dev/null 2>&1 && [ -f "$ROOT_DIR/.nvmrc" ]; then
  nvm use --silent "$(cat "$ROOT_DIR/.nvmrc")" >/dev/null 2>&1 || true
fi

# ── preflight ──────────────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || fail "node not found — install Node.js or ensure nvm is configured"
node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 12) || (a === 20 && b >= 19) ? 0 : 1)' \
  || fail "Node $(node -v) is too old to package the app. Run: nvm install 22 && nvm use 22"
command -v npx  >/dev/null 2>&1 || fail "npx not found — ensure npm is installed alongside node"

# ── arg check ──────────────────────────────────────────────────────────────────
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  echo "Usage: bash scripts/release.sh <version>"
  echo "       e.g.  bash scripts/release.sh 1.3.0"
  exit 1
fi

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  fail "Version must be semver (e.g. 1.3.0), got: $VERSION"
fi

# The checks below use paths relative to the repo, so run from there wherever this was started.
cd "$ROOT_DIR"

# ── health checks ─────────────────────────────────────────────────────────────
echo "Running preflight checks..."
bash scripts/preflight.sh || exit 1
echo "Running splash assertions..."
node scripts/assert-splash.js || exit 1
# A signed DMG is only built from code that passes lint and the unit tests.
echo "Running lint..."
npm run lint --silent > /tmp/promptly-lint.log 2>&1 || { cat /tmp/promptly-lint.log; fail "Lint failed"; }
echo "Running unit tests..."
npx vitest run > /tmp/promptly-test.log 2>&1 || { tail -40 /tmp/promptly-test.log; fail "Unit tests failed"; }
echo "All checks passed. Proceeding with build."

echo ""
echo "═══════════════════════════════════════════"
echo "  Promptly release — v$VERSION"
echo "═══════════════════════════════════════════"

# ── 1. Bump version in package.json ───────────────────────────────────────────
# If any later step fails, package.json and index.html go back to how they were, so a failed
# release can't leave the app and the site on different versions.
BACKUP_DIR="$(mktemp -d)"
cp package.json index.html "$BACKUP_DIR/"
RELEASED=0
restore_on_failure() {
  if [ "$RELEASED" != 1 ]; then
    cp "$BACKUP_DIR/package.json" "$BACKUP_DIR/index.html" "$ROOT_DIR/" 2>/dev/null \
      && echo "  ↺ Restored package.json and index.html"
  fi
  rm -rf "$BACKUP_DIR"
}
trap restore_on_failure EXIT

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

step "Building the hold-to-talk helper"
bash scripts/build-helper.sh || fail "Could not build promptly-helper"
ok "Helper ready"

# ── 3. Build renderer ─────────────────────────────────────────────────────────
step "Building renderer (Vite)"
npm run build:renderer > /tmp/promptly-renderer.log 2>&1 \
  || { cat /tmp/promptly-renderer.log; fail "Renderer build failed"; }
ok "Renderer built"

# ── 4–7. One signed DMG per Mac chip ──────────────────────────────────────────
# Separate Apple Silicon and Intel builds instead of one universal app: the universal Electron
# carries both chips' copies of Chromium, which doubled the download (234 MB → ~120 MB each).
#   arm64 → dist/mac-arm64/Promptly.app → Promptly-X.Y.Z-arm64-signed.dmg
#   x64   → dist/mac/Promptly.app       → Promptly-X.Y.Z-x64-signed.dmg
dmg_path() { echo "dist/Promptly-${VERSION}-$1-signed.dmg"; }
app_path() { if [ "$1" = arm64 ]; then echo "dist/mac-arm64/Promptly.app"; else echo "dist/mac/Promptly.app"; fi; }

# vendor/ holds universal builds of the speech engine and helper (the dev app runs on either
# chip); each app keeps only its own chip's half.
thin_binary() {
  local file="$1" arch="$2"
  lipo "$file" -thin "$arch" -output "$file.thin" || fail "Couldn't thin $(basename "$file") to $arch"
  mv "$file.thin" "$file"
}

sign_app() {
  local APP_PATH="$1"
  [ -d "$APP_PATH" ] || fail "$APP_PATH not found"

  # Frameworks + dylibs first (order matters for deep signing)
  find "$APP_PATH/Contents/Frameworks" -name "*.dylib" -o -name "*.framework" \
    | while read -r f; do
        codesign --force --sign "$CERT_NAME" --timestamp=none "$f" 2>/dev/null || true
      done

  # Built-in speech engine (a plain executable under Resources, which --deep does not cover)
  local WHISPER_CLI="$APP_PATH/Contents/Resources/whisper/whisper-cli"
  [ -f "$WHISPER_CLI" ] || fail "Speech engine missing from the app bundle"
  codesign --force --sign "$CERT_NAME" --timestamp=none --options runtime "$WHISPER_CLI" \
    || fail "codesign failed for whisper-cli"

  # Hold-to-talk helper (same identity, so the Accessibility grant stays valid across updates)
  local HELPER_BIN="$APP_PATH/Contents/Resources/helper/promptly-helper"
  [ -f "$HELPER_BIN" ] || fail "promptly-helper missing from the app bundle"
  codesign --force --sign "$CERT_NAME" --timestamp=none --options runtime "$HELPER_BIN" \
    || fail "codesign failed for promptly-helper"

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
}

# electron-builder lays out the DMG window (Applications shortcut + first-open instructions
# background from build/dmg-background.png) around the already-signed app.
# scripts/dmgbuild-wrapper.sh moves the DMG's hidden files below the window, so people who show
# hidden files in Finder don't see them over the instructions. It uses electron-builder's own
# cached dmgbuild, so on a machine that has never built a DMG, one plain build fetches it first.
build_dmg() {
  local arch="$1" app="$2" name="$3"
  npx electron-builder --mac dmg "--$arch" --prepackaged "$app" \
    --config.mac.identity=null \
    --config.dmg.artifactName="$name" \
    > /tmp/promptly-dmg.log 2>&1
}

for ARCH in arm64 x64; do
  LIPO_ARCH=$([ "$ARCH" = arm64 ] && echo arm64 || echo x86_64)
  APP_PATH="$(app_path "$ARCH")"
  DMG_PATH="$(dmg_path "$ARCH")"
  DMG_NAME="$(basename "$DMG_PATH")"

  step "Packaging for $ARCH with electron-builder (unsigned)"
  npx electron-builder --mac dir "--$ARCH" --config.mac.identity=null \
    > /tmp/promptly-builder.log 2>&1 \
    || { cat /tmp/promptly-builder.log; fail "electron-builder failed ($ARCH)"; }
  [ -d "$APP_PATH" ] || fail "$APP_PATH not found after packaging"
  thin_binary "$APP_PATH/Contents/Resources/whisper/whisper-cli" "$LIPO_ARCH"
  thin_binary "$APP_PATH/Contents/Resources/helper/promptly-helper" "$LIPO_ARCH"
  ok "App packaged → $APP_PATH"

  step "Signing the $ARCH app with \"$CERT_NAME\""
  sign_app "$APP_PATH"
  ok "App signed"

  step "Verifying the $ARCH signature"
  codesign --verify --deep --strict "$APP_PATH" \
    || fail "Signature verification failed — check cert name: \"$CERT_NAME\""
  # Every executable in the app must be this chip's only: a stray other-chip binary would mean
  # the wrong half was shipped.
  [ "$(lipo -archs "$APP_PATH/Contents/MacOS/Promptly")" = "$LIPO_ARCH" ] || fail "Promptly isn't a $LIPO_ARCH binary"
  [ "$(lipo -archs "$APP_PATH/Contents/Resources/whisper/whisper-cli")" = "$LIPO_ARCH" ] || fail "whisper-cli isn't $LIPO_ARCH"
  ok "Signature verified ($LIPO_ARCH only)"

  step "Creating $DMG_NAME"
  if ! ls "$HOME"/Library/Caches/electron-builder/dmg-builder@*/dmgbuild-bundle-*/dmgbuild >/dev/null 2>&1; then
    build_dmg "$ARCH" "$APP_PATH" "$DMG_NAME" || { cat /tmp/promptly-dmg.log; fail "DMG build failed ($ARCH)"; }
  fi
  CUSTOM_DMGBUILD_PATH="$ROOT_DIR/scripts/dmgbuild-wrapper.sh" build_dmg "$ARCH" "$APP_PATH" "$DMG_NAME" \
    || { cat /tmp/promptly-dmg.log; fail "DMG build failed ($ARCH)"; }
  [ -f "$DMG_PATH" ] || fail "DMG not found at $DMG_PATH"
  ok "DMG created → $DMG_PATH"
done

# ── 8. Product site: version and download size ────────────────────────────────
# The download buttons point at releases/latest/download/Promptly.dmg (Apple Silicon) and
# Promptly-Intel.dmg, which never change; only the version and sizes shown on the page do.
# scripts/publish-release.sh uploads the DMGs.
step "Updating the product site (index.html)"
mb() { echo $(( ($(stat -f%z "$1") + 500000) / 1000000 )); }  # decimal MB, as Finder shows
ARM_MB=$(mb "$(dmg_path arm64)")
INTEL_MB=$(mb "$(dmg_path x64)")
sed -i '' -E \
  -e "s/Promptly [0-9]+\.[0-9]+\.[0-9]+ for macOS/Promptly $VERSION for macOS/" \
  -e "s/Download for Mac \([0-9]+ MB\)/Download for Mac ($ARM_MB MB)/" \
  -e "s/Intel version \([0-9]+ MB\)/Intel version ($INTEL_MB MB)/" \
  -e "s/Promptly [0-9.]+ for Windows 10/Promptly $VERSION for Windows 10/" \
  index.html || fail "Could not update index.html"
grep -q "Promptly $VERSION for macOS" index.html || fail "index.html doesn't show v$VERSION"
grep -q "Download for Mac ($ARM_MB MB)" index.html || fail "index.html doesn't show the Apple Silicon size ($ARM_MB MB)"
grep -q "Intel version ($INTEL_MB MB)" index.html || fail "index.html doesn't show the Intel size ($INTEL_MB MB)"
# The Windows installer is built by CI after this push; publish-release.sh sets its size.
grep -q "Promptly $VERSION for Windows 10" index.html || fail "index.html doesn't show v$VERSION for Windows"
ok "Site shows v$VERSION: Apple Silicon $ARM_MB MB, Intel $INTEL_MB MB"
# "Built with the vibe skills": commits, specs, reviews, bugs, tests and releases, recounted.
node scripts/site-stats.js || fail "Could not update the site's numbers"
RELEASED=1

# ── done ──────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  ✓ Release complete — v$VERSION"
echo "  Output: $(dmg_path arm64)"
echo "          $(dmg_path x64)"
echo "═══════════════════════════════════════════"
echo ""
echo "Next: commit package.json + index.html, push, then publish the download:"
echo "  bash scripts/publish-release.sh $VERSION [notes.md]"
echo ""
