# BUG_PLAN — Uninstall freezes the Mac

## 1. Files to modify
- main/uninstall.js (new, no Electron): `uninstallCommand({ scriptPath, pid, bundlePath, dataPaths })` → `['/bin/bash', [scriptPath, '--yes', '--wait-pid', pid, ...(bundlePath ? ['--app', bundlePath] : []), ...dataPaths.flatMap((p) => ['--data', p])]]`.
- main.js — `handleUninstall()`: after confirm → `helper.stop()`, `globalShortcut.unregisterAll()`, hide windows, stop harness agents (unchanged code), copy the bundled script to a temp file, `spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()`, `isQuitting = true; app.quit()`. Remove the in-process deletes and the second dialog. Dev (unpackaged) runs use scripts/uninstall.sh and pass no `--app`.
- main/platform/darwin.js — `uninstallScriptPath(resourcesPath)` (→ `<bundle>/Contents/uninstall.sh`); `removeInstalledApp` and `resetMicrophonePermission` stay (unused by the tray path now, still exported for parity/tests).
- scripts/uninstall.sh — non-interactive mode: `--yes`, `--wait-pid PID`, `--app PATH`, `--data PATH` (repeatable). Waits up to 20 s for the PID, then stops leftover processes whose path is inside the app; removes data; `tccutil reset Microphone`; removes the app with `rm -rf`, else Finder "delete" via `osascript` with `on run argv`; notification at the end, or reveal leftovers in Finder. Interactive mode unchanged.
- tests/uninstall.test.js (new) — regression tests.

## 2. Files NOT to touch
native/helper/*, preload.js, renderer, release scripts, the list in `uninstallDataPaths`.

## 3. Conventions
Rule 2: spawn with an argument array; paths reach the script and AppleScript as arguments, never inside a command
string. Logic in main/ (Electron-free, unit-tested); main.js wires. Comments say why.

## 4. Side effects check
- The confirmation dialog stays; the result dialog goes (a notification replaces it).
- If the script can't start (missing), log it and show the old guidance dialog telling the user to drag Promptly to
  the Bin — still after stopping the helper.
- Finder may ask the user for permission/password to move an app — expected macOS behaviour.

## 5. Test plan
- New: uninstallCommand shape; script waits for the PID before deleting; script removes data paths and the app dir;
  Finder fallback invoked when rm fails (osascript stubbed on PATH).
- Existing: npm test, lint, e2e (unaffected paths).

## 6. Rollback
Revert the commit; the old in-process uninstall returns.

## 7. CODEBASE.md update
Yes — main/uninstall.js row; uninstall.sh description; main.js handleUninstall note.

## 8. ARCHITECTURE.md update
No — follows existing rules.
