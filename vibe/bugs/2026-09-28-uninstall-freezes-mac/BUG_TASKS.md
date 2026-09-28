# BUG_TASKS — Uninstall freezes the Mac

---
### BUG-001 · Write the regression tests
- **Status**: `[x]` | **Depends on**: None | **Touches**: tests/uninstall.test.js
**What to do**: Tests that fail on current code: (1) `main/uninstall.js` exposes `uninstallCommand` returning an
argument array with `--wait-pid` and the paths; (2) running scripts/uninstall.sh `--yes --wait-pid <live pid>
--app <tmp app> --data <tmp dir>` deletes nothing while the PID lives and everything after it exits; (3) when the
app dir can't be removed, the script calls osascript with the path as an argument (stub osascript on PATH).
**Acceptance criteria**: tests exist, clearly named, fail on current code.
**⚠️ Boundaries**: test files only.
**Decisions**: tests/uninstall.test.js — 4 tests, all fail on current code (module missing; script prompts instead of waiting; no Finder fallback). System tools stubbed on PATH, temp paths only.
---
### BUG-002 · Implement the fix
- **Status**: `[x]` | **Depends on**: BUG-001 | **Touches**: main/uninstall.js, main.js, main/platform/darwin.js, scripts/uninstall.sh
- **CODEBASE.md update**: Yes
**What to do**: per BUG_PLAN.md §1.
**Acceptance criteria**: only BUG_PLAN files changed; helper stopped before anything is deleted; the running app
deletes nothing itself; no second dialog; interactive `npm run uninstall` unchanged.
**Decisions**: main/uninstall.js builds the command; handleUninstall stops the helper, unregisters shortcuts, hides
windows, copies Contents/uninstall.sh to a temp file and spawns it detached, then quits. The script's `--yes` mode
waits for the PID, removes data + app (Finder fallback via `on run argv`), notifies, and removes only its own temp copy
(guard added so the test run can't delete scripts/uninstall.sh). If the script can't start, one dialog tells the user
to drag the app to the Bin — after the helper is already stopped.
---
### BUG-003 · Verify fix and run full suite
- **Status**: `[x]` | **Depends on**: BUG-002 | **Touches**: none
**What to do**: regression tests pass; npm test; lint; e2e. Manual check on the installed DMG is the owner's.
**Decisions**: 204/204 unit, lint 0 errors, preflight --codebase-only green, e2e 47/48 with one unrelated timeout
(mode dropdown) that passed 3/3 on re-run.
---
### BUG-004 · Update docs
- **Status**: `[x]` | **Depends on**: BUG-003 | **Touches**: vibe/CODEBASE.md, vibe/DECISIONS.md
**Decisions**: > None yet.
---
#### Bug Fix Sign-off: Uninstall freezes the Mac
- [x] Regression tests written, named clearly, pass after fix
- [x] Full test suite green — no regressions
- [x] Linter clean
- [x] No files outside BUG_PLAN.md scope modified
- [x] CODEBASE.md updated
- [x] DECISIONS.md updated if any deviation from BUG_PLAN.md (one addition: the script only removes its own temp copy)
- [x] Doc commits separate from code commits
---
