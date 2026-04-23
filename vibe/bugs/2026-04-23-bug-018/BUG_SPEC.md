# BUG_SPEC.md — BUG-018
> App requires manual quit before relaunch — window destroyed on close, no single-instance lock
> Date: 2026-04-23 | Folder: vibe/bugs/2026-04-23-bug-018/

---

## 1. Bug summary

Closing the app window (red X) silently destroys the BrowserWindow. On macOS the process keeps running (tray present), but clicking the Dock icon or reopening from Applications does nothing — the activate handler's `!win.isDestroyed()` guard fails. Without `requestSingleInstanceLock()`, opening from Applications also launches a second conflicting process.

---

## 2. Files involved

- `main.js` — only file affected

---

## 3. Root cause hypotheses

### Root cause A — no single-instance lock (confirmed, line 363)
`app.whenReady()` is called with no prior `app.requestSingleInstanceLock()`. Opening from Applications while the app is running launches a fresh second process. Both processes fight for the tray, global shortcut, and IPC handlers.

### Root cause B — window destroyed on close (confirmed, lines 332–359)
`createWindow()` registers no `close` event handler on `win`. When the user clicks the red X, Electron destroys the window. The module-scope `win` variable still holds the reference but `win.isDestroyed()` returns `true`. The `activate` handler (line 706–711) has an `!win.isDestroyed()` guard — it silently skips `win.show()`. The window can never be reshown without restarting the process.

### Root cause C — tray Quit would be blocked after fix (line 184)
Tray Quit calls `app.quit()`. Once we add the `win.on('close')` hide-intercept to fix root cause B, `app.quit()` triggers a close event → the handler calls `e.preventDefault()` → the app can never fully exit via the tray. Needs an `isQuitting` flag.

---

## 4. Confidence

**High (95%)** — all three root causes are directly readable in the code. The `win.on('close')` absence is definitive; `requestSingleInstanceLock` absence is definitive. The `isQuitting` issue is a logical consequence of the fix.

---

## 5. Blast radius

- Only `main.js` touched — renderer, preload, and all IPC channels are unaffected
- The fix changes how the window lifecycle interacts with the tray and quit flow
- Regression risk: tray Hide/Show toggle, Dock activate, global shortcut (⌥Space) must still work when window is hidden

---

## 6. Fix approach

Four additive changes to `main.js`, all within the main-process lifecycle:

1. **Single-instance lock** — add `app.requestSingleInstanceLock()` block before `app.whenReady()`. If lock not acquired: `app.quit()` immediately. Else: register `second-instance` handler to show+focus existing window.

2. **`isQuitting` flag** — add module-scope `let isQuitting = false`. Add `app.on('before-quit', () => { isQuitting = true; })` so that `app.quit()` sets the flag before windows are asked to close.

3. **Hide-on-close** — inside `createWindow()` after `win.loadFile()`, add:
   ```js
   win.on('close', (e) => {
     if (!isQuitting) { e.preventDefault(); win.hide(); updateTrayMenu(); }
   });
   ```

4. **Tray label** — rename tray Quit item to `'Quit Promptly'` (cosmetic, matches user expectation). No logic change needed — `app.quit()` already triggers `before-quit` which sets `isQuitting = true`.

---

## 7. What NOT to change

- `app.on('activate')` — already correct
- `app.on('window-all-closed')` — already correct (doesn't quit on macOS with tray)
- `app.on('will-quit')` — already correct (unregisters shortcuts)
- All IPC handlers — untouched
- `preload.js`, `src/renderer/**` — untouched
- `createTray()` / `updateTrayMenu()` structure — only the Quit label changes

---

## 8. Verification plan

Smoke checklist (manual — no automated test possible for OS-level window lifecycle):
- [ ] Open app, use it, close window (red X button)
- [ ] App stays in menu bar tray; no crash
- [ ] Click Dock icon — window reappears immediately
- [ ] Open app from Applications folder again — window reappears, no second instance (check Activity Monitor)
- [ ] ⌥Space global shortcut fires when window is hidden — window shows + focuses
- [ ] Tray menu → Quit Promptly — app exits fully (no lingering process in Activity Monitor)
- [ ] After full quit, opening app again launches fresh with splash screen

---

## 9. Regression test

No automated test possible (Electron window lifecycle is OS-level). The smoke checklist in section 8 is the regression gate. BUG-001 task will document that automated test is N/A and specify the manual checklist instead.
