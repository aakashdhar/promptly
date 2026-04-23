# FEATURE-016 — Promptly Uninstaller

## Problem
Promptly stores data in multiple locations beyond the .app bundle.
Dragging to Trash only removes the app — it leaves behind app data,
preferences, logs, electron-store config, and TCC microphone permissions.
Team members have no clean way to fully uninstall without knowing macOS
internals.

## Solution
Three uninstall surfaces:
1. scripts/uninstall.sh — standalone shell script included in the DMG
2. Tray menu option — "Uninstall Promptly..." from the menu bar icon
3. INSTALL.md — documented terminal commands for manual cleanup

## What gets removed
- /Applications/Promptly.app
- ~/Library/Application Support/promptly/ (electron-store, localStorage)
- ~/Library/Logs/promptly/
- ~/Library/Preferences/io.betacraft.promptly.plist
- ~/Library/Saved Application State/io.betacraft.promptly.savedState/
- TCC microphone permission entry
- Quarantine extended attribute (if DMG still present)

## Acceptance criteria
- [ ] scripts/uninstall.sh exists and is executable
- [ ] Running uninstall.sh removes all Promptly data completely
- [ ] uninstall.sh quits the app gracefully before removing files
- [ ] uninstall.sh prints clear status for each step with ✓ or ✗
- [ ] uninstall.sh confirms before deleting — asks "Are you sure? (y/n)"
- [ ] Tray menu has "Uninstall Promptly..." option
- [ ] Tray uninstall shows a native confirmation dialog before proceeding
- [ ] Tray uninstall removes all data then quits the app
- [ ] INSTALL.md has ## Uninstall section with manual terminal commands
- [ ] uninstall.sh is included in the DMG contents alongside the app

## Files in scope
- scripts/uninstall.sh (new file)
- main.js (tray menu + uninstall IPC handler)
- preload.js (uninstall IPC exposure)
- package.json (add uninstall.sh to DMG contents)
- INSTALL.md (add uninstall section)
