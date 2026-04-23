# BUG_PLAN.md — BUG-018
> App requires manual quit before relaunch
> Date: 2026-04-23

---

## 1. Exact files to modify

- `main.js`

---

## 2. Files NOT to touch

- `preload.js`
- `src/renderer/**`
- `splash.html`
- `package.json`
- `entitlements.plist`
- Any vibe/ doc file (docs in separate commits)

---

## 3. Change description

### Change A — `isQuitting` module-scope flag (line ~169 area, after `let tray = null`)

Add:
```js
let isQuitting = false;
```

### Change B — `app.on('before-quit')` (add before `app.whenReady()`)

Add:
```js
app.on('before-quit', () => { isQuitting = true; });
```

### Change C — Single-instance lock (add before `app.whenReady()`)

Add before the `app.whenReady().then(...)` block:
```js
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });
}
```

Wrap the entire existing `app.whenReady().then(...)` block inside the `else` branch OR keep it outside and rely on the early `app.quit()` to abort. Simpler: keep `app.whenReady()` outside the else — the early `app.quit()` aborts the second instance before `whenReady` matters. This keeps diff small.

### Change D — Hide-on-close in `createWindow()` (after `win.loadFile(...)`, before `return win`)

Add:
```js
win.on('close', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    win.hide();
    updateTrayMenu();
  }
});
```

### Change E — Tray Quit label (in `updateTrayMenu()`, line ~184)

Change:
```js
{ label: 'Quit', click: () => app.quit() },
```
To:
```js
{ label: 'Quit Promptly', click: () => app.quit() },
```

---

## 4. Conventions to follow

- Module-scope vars declared alongside existing `let claudePath`, `let win`, etc.
- No new IPC channels
- No runtime npm deps
- All new handlers use `isDestroyed()` guard where touching `win`

---

## 5. Side effects check

| Scenario | Expected after fix |
|----------|--------------------|
| Red X click | Window hides, tray updates, process alive |
| Dock icon click | `activate` fires → `win.show()` + `win.focus()` |
| ⌥Space shortcut when hidden | `winSend('shortcut-triggered')` → renderer handles → window already shown or shown by renderer |
| Tray toggle click | hide/show unchanged |
| Tray "Quit Promptly" | `app.quit()` → `before-quit` → `isQuitting=true` → close event allows → window closes → process exits |
| Open from Applications (second instance) | Lock not acquired → second process calls `app.quit()` immediately; first process gets `second-instance` event → shows window |

---

## 6. Test plan

Manual smoke checklist from BUG_SPEC.md section 8. No automated test possible.

Pre-fix verification step (BUG-001): document current broken behaviour before making any code change.

---

## 7. Rollback plan

`git revert <commit>` — single commit, single file. All changes are in `main.js` only.

---

## 8. CODEBASE.md update needed?

**No** — no new functions, no new IPC channels, no new module-scope exports. The `isQuitting` flag is implementation detail. The `win.on('close')` handler is inline in `createWindow()`. CODEBASE.md Module-scope variables table could note `isQuitting` but it's not a key export — skip.

---

## 9. ARCHITECTURE.md update needed?

**Yes** — the "Window lifecycle" section (or equivalent) should document the hide-on-close pattern: that `win.on('close')` intercepts with `e.preventDefault()` + `win.hide()` on macOS when `!isQuitting`, and that `before-quit` sets the flag to allow real exit. This pattern is non-obvious and future agents must know it to avoid reintroducing the bug.
