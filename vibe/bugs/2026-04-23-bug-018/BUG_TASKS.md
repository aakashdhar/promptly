# BUG_TASKS.md — BUG-018
> App requires manual quit before relaunch — window lifecycle fixes
> Date: 2026-04-23

---

### BUG-018-001 · Document current broken behaviour (regression baseline)
- **Status**: `[x]` | **Depends on**: None | **Touches**: this file only

**What to do**: No code changes in this task. Record the current broken behaviour as the regression baseline:
1. Confirm `app.requestSingleInstanceLock()` is absent in `main.js` (check lines ~360–365)
2. Confirm `win.on('close')` handler is absent in `createWindow()` (check lines ~332–359)
3. Note current tray Quit label is `'Quit'` (line ~184)
4. Update **Decisions** field below with confirmation

**Acceptance criteria**:
- [ ] Absence of single-instance lock confirmed in main.js
- [ ] Absence of win.on('close') handler confirmed in main.js
- [ ] Decisions field updated below

**⚠️ Boundaries**: Do not touch main.js or any source file in this task.
**Decisions**: Confirmed 2026-04-23 — (A) `app.requestSingleInstanceLock()` absent — `app.whenReady()` at line 363 called directly with no lock. (B) `win.on('close')` absent from `createWindow()` (lines 332–359). (C) Tray Quit label is `'Quit'` at line 184.

---

### BUG-018-002 · Implement all lifecycle fixes in main.js
- **Status**: `[x]` | **Depends on**: BUG-018-001 | **Touches**: `main.js`
- **CODEBASE.md update**: No

**What to do**: Apply all five changes from BUG_PLAN.md section 3 in a single pass:

**A** — Add `let isQuitting = false;` after `let tray = null;` (line ~170)

**B** — Add `app.on('before-quit', () => { isQuitting = true; });` before `app.commandLine.appendSwitch(...)` line (currently line ~361)

**C** — Add single-instance lock block before `app.whenReady().then(...)`:
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

**D** — Add hide-on-close handler inside `createWindow()`, after `win.loadFile(...)`, before `return win`:
```js
win.on('close', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    win.hide();
    updateTrayMenu();
  }
});
```

**E** — Change tray Quit label from `'Quit'` to `'Quit Promptly'` in `updateTrayMenu()`

**Acceptance criteria**:
- [ ] `isQuitting` flag declared at module scope alongside other let vars
- [ ] `app.on('before-quit')` sets `isQuitting = true`
- [ ] `app.requestSingleInstanceLock()` called before `app.whenReady()`
- [ ] Second-instance handler shows + focuses existing window
- [ ] `win.on('close')` in `createWindow()` hides instead of destroys when `!isQuitting`
- [ ] Tray Quit label is `'Quit Promptly'`
- [ ] No other code changed
- [ ] `npm run lint` passes

**⚠️ Boundaries**: Only `main.js` modified. No other files touched. No new IPC channels. No runtime deps.
**Decisions**: Implemented 2026-04-23 — all 5 changes applied: `isQuitting` flag at line 171, `before-quit` handler at line 369, `requestSingleInstanceLock()` block at lines 371–382, `win.on('close')` hide-intercept at lines 356–362, tray label 'Quit Promptly' at line 185. Lint: 0 errors. Committed db51894.

---

### BUG-018-003 · Verify fix with smoke checklist
- **Status**: `[ ]` | **Depends on**: BUG-018-002 | **Touches**: none

**What to do**:
Run `npm start` and exercise every item in the smoke checklist:

1. Open app (splash → IDLE)
2. Use the app (speak something, generate a prompt)
3. Click red X to close window → confirm app stays in tray, no crash
4. Click Dock icon → confirm window reappears immediately
5. In Terminal: `open /Applications/Promptly.app` or re-run `npm start` → confirm second instance does NOT open (first window focuses)
6. ⌥Space when window hidden → confirm shortcut still works
7. Tray → Quit Promptly → confirm process fully exits (check Activity Monitor or `pgrep Electron`)
8. After full quit, `npm start` again → confirm fresh splash screen appears

**Acceptance criteria**:
- [ ] Red X hides window, app stays in tray
- [ ] Dock click shows window
- [ ] Second launch focuses existing window (no duplicate)
- [ ] ⌥Space works when window hidden
- [ ] Tray "Quit Promptly" fully exits the process
- [ ] Fresh launch after quit works normally
- [ ] `npm run lint` clean (re-confirm)

**Decisions**: > Filled in by agent. None yet.

---

### BUG-018-004 · Update docs — ARCHITECTURE.md + DECISIONS.md
- **Status**: `[ ]` | **Depends on**: BUG-018-003 | **Touches**: `vibe/ARCHITECTURE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:
1. Append to `vibe/ARCHITECTURE.md` — add a "Window lifecycle" section (or extend existing) documenting:
   - `win.on('close')` intercepts with `e.preventDefault()` + `win.hide()` when `!isQuitting`
   - `app.on('before-quit')` sets `isQuitting = true` to allow real exit
   - `app.requestSingleInstanceLock()` must be called before `app.whenReady()`
   - Second-instance handler shows existing window instead of launching new one

2. Append to `vibe/DECISIONS.md`:
```
---
### D-BUG-018 — Bug fix: window destroyed on close + no single-instance lock
- **Date**: 2026-04-23 · **Type**: drift
- **Folder**: vibe/bugs/2026-04-23-bug-018/
- **Root cause**: (A) No app.requestSingleInstanceLock() — second DMG launch conflicts with running instance. (B) No win.on('close') intercept — red X destroyed win; activate handler's !isDestroyed() guard failed silently.
- **Files in scope**: main.js
- **Fix approach**: isQuitting flag + before-quit event + requestSingleInstanceLock() + win.on('close') hide intercept + Quit Promptly tray label
- **CODEBASE.md update**: No
- **ARCHITECTURE.md update**: Yes — window lifecycle section added (hide-on-close pattern, isQuitting flag, single-instance lock requirement)
- **Deviations from BUG_PLAN.md**: [logged below / none]
---
```

3. Update `vibe/TASKS.md` — mark BUG-018 complete (4/4 ✅)

**Acceptance criteria**:
- [ ] ARCHITECTURE.md documents hide-on-close pattern
- [ ] DECISIONS.md D-BUG-018 entry appended
- [ ] TASKS.md BUG-018 collapsed to ✅ with date

**Decisions**: > Filled in by agent. None yet.

---

#### Bug Fix Sign-off: BUG-018 — window destroyed on close + no single-instance lock
- [ ] Smoke checklist fully exercised and all items pass
- [ ] No files outside BUG_PLAN.md scope modified (main.js only for code)
- [ ] `npm run lint` clean
- [ ] ARCHITECTURE.md documents window lifecycle pattern
- [ ] DECISIONS.md D-BUG-018 entry appended
- [ ] TASKS.md BUG-018 collapsed to ✅
- [ ] Code commit and doc commit are separate
---
