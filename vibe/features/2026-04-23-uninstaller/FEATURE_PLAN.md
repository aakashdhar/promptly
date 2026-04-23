# FEATURE-016 — Implementation Plan

## Task breakdown
UNIN-001 (M) — create scripts/uninstall.sh with confirmation prompt,
  graceful app quit, removal of all data locations, TCC reset, status output

UNIN-002 (S) — make uninstall.sh executable, add npm script:
  "uninstall": "bash scripts/uninstall.sh"

UNIN-003 (M) — add uninstall IPC handler to main.js:
  shows native confirmation dialog, removes all data dirs, resets TCC,
  then quits app. Extract handleUninstall() helper used by both IPC and tray.

UNIN-004 (S) — add triggerUninstall to preload.js contextBridge

UNIN-005 (S) — add "Uninstall Promptly..." to tray menu in updateTrayMenu()

UNIN-006 (S) — add uninstall.sh to DMG contents in package.json via dmg.extraFiles

UNIN-007 (S) — add ## Uninstall section to INSTALL.md

UNIN-008 (S) — update CODEBASE.md, DECISIONS.md, TASKS.md

## Order
UNIN-001 → UNIN-002 → UNIN-003 → UNIN-004 → UNIN-005 → UNIN-006 → UNIN-007 → UNIN-008
