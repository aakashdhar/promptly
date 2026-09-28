#!/bin/bash
# Installs (or updates) Promptly on a Mac from the latest GitHub Release.
#
#   curl -fsSL https://aakashdhar.me/promptly/install.sh | bash
#
# Why this exists: Promptly is signed by its author but not notarised by Apple, so a DMG downloaded
# in a browser opens with "Move to Bin" until you choose Open Anyway in System Settings. A file
# downloaded with curl isn't marked as "from the internet", so an app installed this way opens
# straight away. The script only downloads the official release, checks its signature, and copies
# it into Applications — read it first if you like.
#
# PROMPTLY_INSTALL_DIR (default /Applications) and PROMPTLY_NO_OPEN=1 exist for testing.

# Everything is inside main(), so a download cut off halfway runs nothing.
main() {
  set -euo pipefail

  local URL="https://github.com/aakashdhar/promptly/releases/latest/download/Promptly.dmg"
  local DEST_DIR="${PROMPTLY_INSTALL_DIR:-/Applications}"
  local APP="Promptly.app"
  local SIGNER="Promptly Signing"   # the author's signing identity; anything else is refused

  say()  { printf '  %s\n' "$1"; }
  ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
  fail() { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

  echo ""
  echo "  Installing Promptly"
  echo ""

  [ "$(uname -s)" = "Darwin" ] || fail "Promptly runs on macOS only."
  local major; major=$(sw_vers -productVersion | cut -d. -f1)
  [ "$major" -ge 12 ] || fail "Promptly needs macOS 12 or later (this Mac has $(sw_vers -productVersion))."

  # Not local: the EXIT trap runs after main() returns.
  WORK=$(mktemp -d)
  MOUNT="$WORK/mount"
  cleanup() {
    [ -d "$MOUNT" ] && hdiutil detach -quiet "$MOUNT" >/dev/null 2>&1 || true
    rm -rf "$WORK"
  }
  trap cleanup EXIT

  say "Downloading the latest release (about 235 MB)…"
  curl -fL --progress-bar --retry 2 -o "$WORK/Promptly.dmg" "$URL" || fail "The download failed. Check your connection and try again."
  ok "Downloaded"

  mkdir -p "$MOUNT"
  hdiutil attach -quiet -nobrowse -readonly -mountpoint "$MOUNT" "$WORK/Promptly.dmg" || fail "Couldn't open the downloaded disk image."
  [ -d "$MOUNT/$APP" ] || fail "The disk image doesn't contain $APP."

  # Only install what the author signed, and only if it hasn't been altered since.
  codesign --verify --deep --strict "$MOUNT/$APP" 2>/dev/null || fail "The app's signature doesn't verify. Not installing it."
  local SIGNED_BY; SIGNED_BY=$(codesign -dvv "$MOUNT/$APP" 2>&1 || true)
  case "$SIGNED_BY" in *"Authority=$SIGNER"*) ;; *) fail "The app isn't signed by $SIGNER. Not installing it." ;; esac
  ok "Signature checked"

  # The copy being replaced may be running: quit that one (not any other Promptly), and reopen at the end.
  local RUNNING="$DEST_DIR/$APP/Contents/MacOS/"
  if pgrep -qf "$RUNNING"; then
    say "Quitting the running Promptly…"
    osascript -e "quit app \"$DEST_DIR/$APP\"" >/dev/null 2>&1 || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do pgrep -qf "$RUNNING" || break; sleep 0.5; done
    if pgrep -qf "$RUNNING"; then fail "Promptly is still running. Quit it from the menu bar, then run this again."; fi
  fi

  mkdir -p "$DEST_DIR"
  [ -w "$DEST_DIR" ] || fail "Can't write to $DEST_DIR. Run this from an administrator account."
  # Copy next to the old one, then swap, so a failed copy never leaves you without an app.
  local STAGED="$DEST_DIR/.Promptly-installing.app"
  rm -rf "$STAGED"
  ditto "$MOUNT/$APP" "$STAGED" || fail "Couldn't copy Promptly into $DEST_DIR."
  xattr -dr com.apple.quarantine "$STAGED" 2>/dev/null || true
  rm -rf "${DEST_DIR:?}/$APP"
  mv "$STAGED" "$DEST_DIR/$APP"
  local VERSION; VERSION=$(defaults read "$DEST_DIR/$APP/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo "")
  ok "Installed Promptly ${VERSION} in $DEST_DIR"

  if [ "${PROMPTLY_NO_OPEN:-}" != "1" ]; then
    open "$DEST_DIR/$APP"
    ok "Opened Promptly — its setup takes it from here"
  fi
  echo ""
  say "Tip: after an update, macOS may ask for Accessibility again: System Settings ›"
  say "Privacy & Security › Accessibility, remove Promptly with −, then add it back with +."
  echo ""
}

main "$@"
