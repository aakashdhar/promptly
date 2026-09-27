#!/bin/bash
# Publishes a built DMG as a GitHub Release, which is what the product site's download
# buttons serve (releases/latest/download/Promptly.dmg). Run after release.sh, once the
# release commit is pushed.
#   bash scripts/publish-release.sh 2.19.0 [notes.md]

REPO="aakashdhar/promptly"
SITE_DMG="Promptly.dmg"   # fixed name: the site's download link never changes
ok()   { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

VERSION="$1"
NOTES="$2"
echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' || fail "Usage: bash scripts/publish-release.sh X.Y.Z [notes.md]"
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

DMG="dist/Promptly-${VERSION}-signed.dmg"
[ -f "$DMG" ] || fail "$DMG not found — run: npm run release -- $VERSION"
command -v gh >/dev/null 2>&1 || fail "GitHub CLI (gh) not found"
grep -q "\"version\": \"$VERSION\"" package.json || fail "package.json isn't v$VERSION"
grep -q "Promptly $VERSION for macOS" index.html || fail "index.html doesn't show v$VERSION — run release.sh"

git fetch -q origin main
[ -z "$(git status --porcelain -- package.json index.html)" ] || fail "Commit package.json and index.html first"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "Push main first, so the release tag and the site match"
gh release view "v$VERSION" --repo "$REPO" >/dev/null 2>&1 && fail "Release v$VERSION already exists"

cp "$DMG" "dist/$SITE_DMG"
if [ -n "$NOTES" ]; then NOTE_ARGS=(--notes-file "$NOTES"); else NOTE_ARGS=(--generate-notes); fi
gh release create "v$VERSION" "$DMG" "dist/$SITE_DMG" --repo "$REPO" --target main \
  --title "Promptly $VERSION" "${NOTE_ARGS[@]}" || fail "gh release create failed"
ok "Released v$VERSION"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -L -r 0-0 "https://github.com/$REPO/releases/latest/download/$SITE_DMG")
[ "$CODE" = "206" ] || [ "$CODE" = "200" ] || fail "Site download link returned $CODE"
ok "Site download link serves v$VERSION"
