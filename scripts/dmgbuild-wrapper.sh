#!/bin/bash
# electron-builder runs this instead of dmgbuild (CUSTOM_DMGBUILD_PATH, set by release.sh).
# It moves the DMG's hidden files (.background.tiff, .VolumeIcon.icns, .fseventsd) below the
# visible window. Normally they're invisible, but anyone who shows hidden files in Finder
# (⌘⇧.) would otherwise see them on top of the first-open instructions. electron-builder's
# config doesn't accept dmgbuild's "position" entries, so they're added to its settings here.
set -euo pipefail

REAL="$(find "$HOME/Library/Caches/electron-builder" -path '*dmgbuild-bundle-*' -name dmgbuild -type f ! -name '._*' 2>/dev/null | head -1)"
[ -n "$REAL" ] || { echo "dmgbuild-wrapper: electron-builder's dmgbuild bundle isn't cached yet; run one plain DMG build first" >&2; exit 1; }

SETTINGS=""
prev=""
for arg in "$@"; do [ "$prev" = "-s" ] && SETTINGS="$arg"; prev="$arg"; done
[ -n "$SETTINGS" ] && python3 - "$SETTINGS" <<'PY'
import json, sys
path = sys.argv[1]
with open(path) as f:
    settings = json.load(f)
contents = settings.setdefault("contents", [])
for x, name in ((150, ".background.tiff"), (300, ".VolumeIcon.icns"), (450, ".fseventsd")):
    if not any(c.get("path") == name for c in contents):
        contents.append({"x": x, "y": 900, "type": "position", "path": name})
with open(path, "w") as f:
    json.dump(settings, f, indent=2)
PY

exec "$REAL" "$@"
