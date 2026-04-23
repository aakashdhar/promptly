#!/bin/bash

APP_NAME="Promptly"
BUNDLE_ID="io.betacraft.promptly"
APP_PATH="/Applications/Promptly.app"
SUPPORT_DIR="$HOME/Library/Application Support/promptly"
LOGS_DIR="$HOME/Library/Logs/promptly"
PREFS_FILE="$HOME/Library/Preferences/$BUNDLE_ID.plist"
SAVED_STATE="$HOME/Library/Saved Application State/$BUNDLE_ID.savedState"

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
pkill -f "Promptly" 2>/dev/null || true
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

echo ""
echo "  ─────────────────────────────────────"
echo "  Promptly has been uninstalled."
echo ""
