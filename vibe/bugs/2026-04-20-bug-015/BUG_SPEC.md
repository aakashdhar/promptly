# BUG_SPEC — BUG-015: TypeError Object destroyed + mic dialog repeating

## Bug summary
Three related issues: (1) `TypeError: Object has been destroyed` crash when splashWin internal Chromium IPC fires after the 400ms destroy timeout, (2) microphone permission dialog repeats on every launch because `hardenedRuntime: false` prevents TCC from creating a persistent entry, (3) redundant `requestMic()` IPC call in `startRecording` can trigger a second dialog.

## Files involved
- `main.js` — `splash-done` IPC handler, `splashWin`/`win` access after async
- `package.json` — mac build config `hardenedRuntime` flag
- `entitlements.plist` — missing `com.apple.security.network.client` key
- `src/renderer/App.jsx` — `startRecording` + `handleIterate` call `requestMic()` redundantly

## Root cause hypotheses

### Root cause 1 — Object destroyed (CONFIRMED)
`splashWin.destroy()` fires 400ms after `splash-done`. The splash renderer's `getUserMedia()` call triggers internal Chromium IPC that routes back through `splashWin.webContents` after destroy. By the time this IPC arrives, the webContents object is gone → TypeError.

Fix: extend timeout to 1200ms + add `isDestroyed()` guards before all post-async `splashWin`/`win` access.

### Root cause 2 — Mic dialog repeating (CONFIRMED)
`hardenedRuntime: false` means the packaged app bundle has no code signature that TCC can persist. macOS re-prompts every launch.

Fix: `hardenedRuntime: true` + `entitlements`/`entitlementsInherit` wired to `entitlements.plist`.

### Root cause 3 — Double mic request (CONFIRMED)
`startRecording` calls `window.electronAPI.requestMic()` (which calls `askForMediaAccess` in main.js) AND then immediately calls `getUserMedia`. With `hardenedRuntime` on and the session permission handlers in place, the extra `askForMediaAccess` call is unnecessary and can race.

Fix: remove `await window.electronAPI.requestMic()` from `startRecording` and `handleIterate`.

## Confidence: HIGH — all three root causes diagnosed by human, exact lines identified.

## Blast radius
- `splash-done` timeout change: only affects app startup sequence
- `hardenedRuntime` change: affects DMG build output only, dev mode unaffected
- Removing `requestMic()` calls: `request-mic` IPC handler stays in main.js (still used by splash)

## Fix approach
1. main.js: 400→1200ms + isDestroyed() guards
2. package.json: hardenedRuntime true + gatekeeperAssess false + entitlements fields + minimumSystemVersion
3. entitlements.plist: add network.client key
4. App.jsx: remove requestMic() from startRecording + handleIterate

## What NOT to change
- `request-mic` IPC handler in main.js — still called by splash.html
- `check-mic-status` IPC handler — still used
- session permission handlers (setPermissionCheckHandler / setPermissionRequestHandler) — these stay
- Any other IPC channels or state machine logic
