#!/bin/bash

APP_NAME="Promptly"
BUNDLE_ID="io.betacraft.promptly"
APP_PATH="/Applications/Promptly.app"
SUPPORT_DIR="$HOME/Library/Application Support/promptly"
LOGS_DIR="$HOME/Library/Logs/promptly"
PREFS_FILE="$HOME/Library/Preferences/$BUNDLE_ID.plist"
SAVED_STATE="$HOME/Library/Saved Application State/$BUNDLE_ID.savedState"

# ── Run by the app (tray › Uninstall Promptly…) ─────────────────────────────────
#   uninstall.sh --yes --wait-pid PID [--app PATH] [--data PATH]...
# Promptly starts this from a temp copy and quits. Everything is removed only after that process
# has exited: removing the app from inside itself, with its system-wide key hook still active,
# froze the Mac (vibe/bugs/2026-09-28-uninstall-freezes-mac).
if [ "${1:-}" = "--yes" ]; then
  shift
  WAIT_PID=""; APP=""; DATA=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --wait-pid) WAIT_PID="${2:-}"; shift ;;
      --app) APP="${2:-}"; shift ;;
      --data) DATA+=("${2:-}"); shift ;;
      *) echo "uninstall.sh: unknown option $1" >&2; exit 2 ;;
    esac
    shift
  done

  # Wait for Promptly to exit (up to 20 s), then stop anything still running from its bundle.
  if [ -n "$WAIT_PID" ]; then
    for _ in $(seq 1 40); do kill -0 "$WAIT_PID" 2>/dev/null || break; sleep 0.5; done
  fi
  if [ -n "$APP" ]; then
    pkill -f "$APP/Contents/" 2>/dev/null || true
    sleep 0.5
  fi

  LEFT=()
  for d in "${DATA[@]+"${DATA[@]}"}"; do
    rm -rf "$d" 2>/dev/null
    [ -e "$d" ] && LEFT+=("$d")
  done
  tccutil reset Microphone "$BUNDLE_ID" >/dev/null 2>&1 || true
  # The Keychain entry that encrypts saved API keys (only there if a key was ever saved). Electron
  # names it after the app's package name ("promptly"); Keychain names are case-sensitive.
  for service in "promptly Safe Storage" "Promptly Safe Storage"; do
    security delete-generic-password -s "$service" >/dev/null 2>&1 || true
  done

  if [ -n "$APP" ] && [ -e "$APP" ]; then
    rm -rf "$APP" 2>/dev/null
    # macOS App Management may refuse: Finder is allowed to move the app to the Bin. The path is an
    # argument to the AppleScript (on run argv), never part of its text.
    if [ -e "$APP" ]; then
      osascript -e 'on run argv' -e 'tell application "Finder" to delete (POSIX file (item 1 of argv) as alias)' -e 'end run' "$APP" >/dev/null 2>&1 || true
    fi
    [ -e "$APP" ] && LEFT+=("$APP")
  fi

  if [ ${#LEFT[@]} -eq 0 ]; then
    osascript -e 'display notification "Promptly has been uninstalled." with title "Promptly"' >/dev/null 2>&1 || true
  else
    open -R "${LEFT[0]}" >/dev/null 2>&1 || true
    osascript -e 'on run argv' -e 'display alert "Promptly couldn’t remove everything" message ("Drag these to the Bin:" & return & return & (item 1 of argv))' -e 'end run' "$(printf '%s\n' "${LEFT[@]}")" >/dev/null 2>&1 || true
  fi
  # The app runs a temp copy named promptly-uninstall-<pid>.sh; remove only that, never the original.
  case "$(basename "$0")" in promptly-uninstall-*.sh) rm -f "$0" 2>/dev/null ;; esac
  exit 0
fi

echo ""
echo "  Promptly Uninstaller"
echo "  ─────────────────────────────────────"
echo ""
echo "  This will remove Promptly and all its data:"
echo "  • $APP_PATH"
echo "  • $SUPPORT_DIR"
echo "  • $LOGS_DIR"
echo "  • $PREFS_FILE"
echo "  • Microphone permission entry"
echo ""
read -r -p "  Are you sure you want to uninstall Promptly? (y/n): " confirm
echo ""

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "  Cancelled."
  exit 0
fi

echo "  Uninstalling Promptly..."
echo ""

# Step 1 — quit the app
echo -n "  Quitting Promptly... "
osascript -e "quit app \"$APP_NAME\"" 2>/dev/null || true
sleep 1
# Only processes running from the app bundle (not, say, an editor with a "Promptly" folder open).
pkill -f "$APP_PATH/" 2>/dev/null || true
echo "✓"

# Step 2 — remove app bundle
echo -n "  Removing app... "
if [ -d "$APP_PATH" ]; then
  rm -rf "$APP_PATH" && echo "✓" || echo "✗ (run with sudo if needed)"
else
  echo "✓ (not found)"
fi

# Step 3 — remove app support data
echo -n "  Removing app data... "
if [ -d "$SUPPORT_DIR" ]; then
  rm -rf "$SUPPORT_DIR" && echo "✓" || echo "✗"
else
  echo "✓ (not found)"
fi

# Step 4 — remove logs
echo -n "  Removing logs... "
if [ -d "$LOGS_DIR" ]; then
  rm -rf "$LOGS_DIR" && echo "✓" || echo "✗"
else
  echo "✓ (not found)"
fi

# Step 5 — remove preferences
echo -n "  Removing preferences... "
if [ -f "$PREFS_FILE" ]; then
  rm -f "$PREFS_FILE" && echo "✓" || echo "✗"
else
  echo "✓ (not found)"
fi

# Step 6 — remove saved state
echo -n "  Removing saved state... "
if [ -d "$SAVED_STATE" ]; then
  rm -rf "$SAVED_STATE" && echo "✓" || echo "✗"
else
  echo "✓ (not found)"
fi

# Step 7 — reset TCC microphone permission
echo -n "  Removing microphone permission... "
tccutil reset Microphone "$BUNDLE_ID" 2>/dev/null && echo "✓" || echo "✓ (not needed)"

# Step 8 — the Keychain entry that encrypts saved API keys (only there if a key was ever saved)
echo -n "  Removing saved API key encryption... "
KEYCHAIN_GONE=""
for service in "promptly Safe Storage" "Promptly Safe Storage"; do
  security delete-generic-password -s "$service" >/dev/null 2>&1 && KEYCHAIN_GONE=1
done
[ -n "$KEYCHAIN_GONE" ] && echo "✓" || echo "✓ (not found)"

echo ""
echo "  ─────────────────────────────────────"
echo "  Promptly has been uninstalled."
echo ""
