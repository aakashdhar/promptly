# BUG_SPEC — Uninstall freezes the Mac and leaves Promptly half-removed

## 1. Bug summary
Tray › "Uninstall Promptly…" → right after clicking Uninstall the whole Mac becomes slow and ignores clicks, and
Promptly shows "Promptly couldn't remove everything"; the app is left installed and half torn down.

## 2. Files involved
- main.js — `handleUninstall()` (line ~398), `before-quit` (helper.stop)
- main/platform/darwin.js — `uninstallDataPaths`, `resetMicrophonePermission`, `appBundlePath`, `removeInstalledApp`
- scripts/uninstall.sh — shipped in the bundle as Contents/uninstall.sh (package.json extraFiles)
- native/helper/main.swift — session-wide CGEventTap (`.defaultTap`, keyboard + mouse-down mask)

## 3. Root cause hypothesis
`handleUninstall` tears the app down from inside the running app:
- the helper keeps its session-wide, active event tap (every key press and click on the Mac goes through it) for
  the whole uninstall — it is only stopped in `before-quit`;
- it deletes `~/Library/Application Support/promptly` while Chromium (GPU, network, renderer processes) uses it;
- it deletes `/Applications/Promptly.app` while running from it; macOS App Management blocks part of that (unsigned
  apps may not modify app bundles), so "couldn't remove everything" appears;
- it then awaits a second modal dialog, so it never reaches `app.quit()` and never stops the helper.
A stalled helper tap is the only part that can block clicks system-wide.

## 4. Confidence
Medium-high on the mechanism (the app deletes itself and its live data with a system-wide tap active; the dialog
blocks the quit), medium on the exact trigger that stalls input (no log survived — the uninstall deletes it; the
system log has no entries). The fix removes every candidate trigger at once rather than betting on one.
What would change my mind: a freeze with the helper already stopped and the app already exited.

## 5. Blast radius
Only the uninstall path. Normal quitting, the helper, data, and `npm run uninstall` are unaffected.

## 6. Fix approach
After confirmation: stop the helper first (tap released), unregister shortcuts, hide windows, stop harness launch
agents (as today); copy Contents/uninstall.sh to a temp folder and start it detached with
`/bin/bash <copy> --yes --wait-pid <pid> [--app <bundle>] --data <path>…` (argument array, no shell string); quit
at once, no second dialog. The script waits for the PID to exit (then stops any leftover process from the bundle),
removes the data paths, resets the microphone permission, removes the app with `rm -rf` or — if macOS refuses —
asks Finder to move it to the Bin (path passed via `on run argv`), and ends with a notification; if anything is
left, it reveals it in Finder and says so.

## 7. What NOT to change
The confirmation dialog text; the data paths list (still from platform.uninstallDataPaths); harness agent removal;
the interactive `npm run uninstall` flow; the helper.

## 8. Verification plan
- Unit tests: the uninstall command is an argument array with the PID, bundle and data paths; nothing deleted in-process.
- Script test: run the script with `--wait-pid` of a live dummy process and temp paths — nothing is deleted until the
  process exits, then everything is; a read-only "app" triggers the Finder fallback path (stubbed osascript).
- Manual: install the DMG in /Applications, Uninstall from the tray — the Mac stays responsive, Promptly quits at
  once, a notification confirms, the app is gone (in the Bin if Finder removed it).

## 9. Regression test
tests/uninstall.test.js — "deletes nothing until Promptly has quit" (script + dummy PID) and "the app never removes
its own bundle or data while running" (handleUninstall's plan comes from main/uninstall.js as a spawn command only).

## 10. Confirmation (owner's screenshot, 2026-09-28, build ≤ 2.19.2)
"Promptly couldn't remove everything — /Applications/Promptly.app: ENOTEMPTY: directory not empty, rmdir
'/Applications/Promptly.app/Contents/Resources'". The in-process delete had already removed most of the running
bundle and failed only on Contents/Resources (app.asar, helper, whisper in use). So macOS App Management did not
block it — the app dismantled itself while running, with the helper's tap active, then blocked on this dialog.
Consistent with the root cause; the 2.19.3 fix (quit first, script removes afterwards) removes exactly this path.
The Finder fallback in uninstall.sh stays as a safety net.
