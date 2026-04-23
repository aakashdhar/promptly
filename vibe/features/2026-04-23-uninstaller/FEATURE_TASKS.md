# FEATURE-016 Tasks

- [x] UNIN-001 — create scripts/uninstall.sh
- [x] UNIN-002 — make executable + add npm script
- [x] UNIN-003 — uninstall IPC handler in main.js
- [x] UNIN-004 — preload.js triggerUninstall exposure
- [x] UNIN-005 — tray menu uninstall option
- [x] UNIN-006 — add uninstall.sh to DMG contents
- [x] UNIN-007 — INSTALL.md uninstall section
- [x] UNIN-008 — CODEBASE.md + DECISIONS.md + TASKS.md updates

#### Conformance: FEATURE-016 Uninstaller
- [x] scripts/uninstall.sh exists and is executable
- [x] Running uninstall.sh removes all Promptly data completely
- [x] uninstall.sh quits the app gracefully before removing files
- [x] uninstall.sh prints clear status for each step with ✓ or ✗
- [x] uninstall.sh confirms before deleting — asks "Are you sure? (y/n)"
- [x] Tray menu has "Uninstall Promptly..." option
- [x] Tray uninstall shows a native confirmation dialog before proceeding
- [x] Tray uninstall removes all data then quits the app
- [x] INSTALL.md has ## Uninstall section with manual terminal commands
- [x] uninstall.sh is included in the DMG contents alongside the app
- [x] Lint clean (eslint main.js preload.js)
- [x] CODEBASE.md updated for new IPC channel and helper function
