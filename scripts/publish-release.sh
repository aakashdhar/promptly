#!/bin/bash
# Publishes the built DMGs (one per Mac chip) as a GitHub Release, which is what the product
# site's download buttons serve: releases/latest/download/Promptly.dmg (Apple Silicon, the name
# older links already use) and Promptly-Intel.dmg. Run after release.sh, once the release commit
# is pushed. If the installer from the Windows build has been put in dist/
# (Promptly-Setup-X.Y.Z.exe), it goes up too, with its own fixed-name link.
#   bash scripts/publish-release.sh 2.19.0 [notes.md]

set -euo pipefail

REPO="aakashdhar/promptly"
SITE_DMG="Promptly.dmg"               # fixed names: the site's download links never change
SITE_DMG_INTEL="Promptly-Intel.dmg"
SITE_EXE="Promptly-Setup.exe"   # same idea for the Windows installer
ok()   { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

VERSION="${1:-}"
NOTES="${2:-}"
echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "Usage: bash scripts/publish-release.sh X.Y.Z [notes.md]"
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

DMG="dist/Promptly-${VERSION}-arm64-signed.dmg"
DMG_INTEL="dist/Promptly-${VERSION}-x64-signed.dmg"
[ -f "$DMG" ] || fail "$DMG not found — run: npm run release -- $VERSION"
[ -f "$DMG_INTEL" ] || fail "$DMG_INTEL not found — run: npm run release -- $VERSION"
command -v gh >/dev/null 2>&1 || fail "GitHub CLI (gh) not found"
grep -q "\"version\": \"$VERSION\"" package.json || fail "package.json isn't v$VERSION"
grep -q "Promptly $VERSION for macOS" index.html || fail "index.html doesn't show v$VERSION — run release.sh"
[ -z "$NOTES" ] || [ -f "$NOTES" ] || fail "Release notes file not found: $NOTES"

git fetch -q origin main || fail "Couldn't fetch origin/main to check it's pushed"
[ -z "$(git status --porcelain -- package.json index.html)" ] || fail "Commit package.json and index.html first"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "Push main first, so the release tag and the site match"
gh release view "v$VERSION" --repo "$REPO" >/dev/null 2>&1 && fail "Release v$VERSION already exists"

# Only the versioned installer counts: a fixed-name copy left over from an earlier release
# must never go up as this version.
EXE="dist/Promptly-Setup-${VERSION}.exe"
HAS_EXE=0
if [ -f "$EXE" ]; then HAS_EXE=1; fi

cp "$DMG" "dist/$SITE_DMG" || fail "Couldn't copy the DMG to dist/$SITE_DMG"
cp "$DMG_INTEL" "dist/$SITE_DMG_INTEL" || fail "Couldn't copy the Intel DMG to dist/$SITE_DMG_INTEL"
ASSETS=("$DMG" "dist/$SITE_DMG" "$DMG_INTEL" "dist/$SITE_DMG_INTEL")
if [ "$HAS_EXE" = 1 ]; then
  cp "$EXE" "dist/$SITE_EXE" || fail "Couldn't copy the installer to dist/$SITE_EXE"
  ASSETS+=("$EXE" "dist/$SITE_EXE")
fi
if [ -n "$NOTES" ]; then NOTE_ARGS=(--notes-file "$NOTES"); else NOTE_ARGS=(--generate-notes); fi
gh release create "v$VERSION" "${ASSETS[@]}" --repo "$REPO" --target main \
  --title "Promptly $VERSION" "${NOTE_ARGS[@]}" || fail "gh release create failed"
ok "Released v$VERSION"

# "latest" redirects to the newest release's asset; it must be this version's, not the last one's.
# One function for both links so the Windows check can never drift from the DMG's.
#   check_latest <fixed asset name> <label used in messages>
check_latest() {
  local name="$1" label="$2" link target code
  link="https://github.com/$REPO/releases/latest/download/$name"
  target=$(curl -sI "$link" | tr -d '\r' | awk 'tolower($1) == "location:" { print $2; exit }' || true)
  case "$target" in
    */download/v$VERSION/$name) ;;
    *) fail "$label points at '${target:-nothing}', not v$VERSION" ;;
  esac
  code=$(curl -s -o /dev/null -w "%{http_code}" -L -r 0-0 "$link" || true)
  [ "$code" = "206" ] || [ "$code" = "200" ] || fail "$label returned $code"
  ok "$label serves v$VERSION"
}
check_latest "$SITE_DMG" "Site download link"
check_latest "$SITE_DMG_INTEL" "Intel download link"
if [ "$HAS_EXE" = 1 ]; then check_latest "$SITE_EXE" "Windows download link"; fi
