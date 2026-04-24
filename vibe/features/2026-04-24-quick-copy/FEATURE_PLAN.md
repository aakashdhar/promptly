# FEATURE_PLAN.md — Quick Copy from Menu Bar (FEATURE-018)
> Folder: vibe/features/2026-04-24-quick-copy/
> Added: 2026-04-24

---

## 1. Impact map

### Files to modify
| File | Change |
|------|--------|
| `main.js` | Add `lastGeneratedPrompt` var; add `set-last-prompt` IPC handler; refactor `createMenuBarIcon` right-click to call a helper; update `updateTrayMenu()` for parity; track `lastIconState` via `currentIconState` (already exists) |
| `preload.js` | Add `setLastPrompt: (prompt) => ipcRenderer.invoke('set-last-prompt', prompt)` to contextBridge |
| `src/renderer/App.jsx` | Add `window.electronAPI?.setLastPrompt?.(prompt)` in `handleGenerateResult` after `setGeneratedPrompt(prompt)` |

### New files
None.

---

## 2. Files explicitly out of scope

- `src/renderer/components/**` — no UI component changes needed
- `splash.html` — no changes
- `vite.config.js`, `package.json`, `entitlements.plist` — no changes
- `src/renderer/hooks/**` — no hook changes needed
- `src/renderer/utils/**` — no utility changes needed

---

## 3. Backend / main process changes

### main.js

**Add module var (after existing module-scope vars):**
```js
let lastGeneratedPrompt = null;
```

**Add IPC handler (inside app.whenReady()):**
```js
ipcMain.handle('set-last-prompt', (_event, prompt) => {
  lastGeneratedPrompt = prompt || null;
  // Rebuild the right-click menu so the item appears/disappears immediately
  // (no-op — menu is built fresh on each right-click; stored for next open)
});
```

**Refactor `createMenuBarIcon` right-click handler:**
Replace inline menu build with a call to a shared `buildTrayMenu()` helper, so both `menuBarTray` and `updateTrayMenu()` use identical logic.

```js
function buildTrayMenu() {
  const template = [];

  if (lastGeneratedPrompt) {
    template.push({
      label: 'Copy last prompt',
      click: () => {
        clipboard.writeText(lastGeneratedPrompt);
        // Flash green dot for 1200ms, then revert to previous state
        updateMenuBarIcon('ready');
        setTimeout(() => {
          if (!menuBarTray || menuBarTray.isDestroyed()) return;
          updateMenuBarIcon(currentIconState === 'ready' ? 'idle' : currentIconState);
        }, 1200);
      },
    });
    template.push({ type: 'separator' });
  }

  template.push(
    {
      label: win && win.isVisible() ? 'Hide Promptly' : 'Show Promptly',
      click: () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: 'Path configuration...',
      click: () => {
        if (win && !win.isDestroyed()) { win.show(); win.focus(); win.webContents.send('open-settings'); }
      },
    },
    { type: 'separator' },
    { label: 'Uninstall Promptly...', click: () => { handleUninstall(); } },
    { type: 'separator' },
    { label: 'Quit Promptly', click: () => { isQuitting = true; app.removeAllListeners('window-all-closed'); app.quit(); } }
  );

  return Menu.buildFromTemplate(template);
}
```

**Update `createMenuBarIcon` right-click:**
```js
menuBarTray.on('right-click', () => {
  menuBarTray.popUpContextMenu(buildTrayMenu());
});
```

**Update `updateTrayMenu()`:**
```js
function updateTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(buildTrayMenu());
}
```

---

## 4. Frontend changes

### preload.js
Add to `contextBridge.exposeInMainWorld('electronAPI', { ... })`:
```js
setLastPrompt: (prompt) => ipcRenderer.invoke('set-last-prompt', prompt),
```

### src/renderer/App.jsx
In `handleGenerateResult` useCallback, after `setGeneratedPrompt(prompt)`:
```js
window.electronAPI?.setLastPrompt?.(prompt);
```

Note: `handleGenerateResult` is called for both polish and non-polish successful generations, so one call point covers all modes.

---

## 5. Conventions to follow

- `clipboard.writeText()` — already imported in main.js (from FEATURE-017/BUG-018 era)
- `currentIconState` — module-scope var tracking last set icon state (set in `updateMenuBarIcon`)
- No `dangerouslySetInnerHTML` anywhere in renderer changes
- No direct `localStorage` access
- All IPC via `window.electronAPI` in renderer

---

## 6. Task breakdown

| ID | Size | Description |
|----|------|-------------|
| QCPY-001 | S | main.js: `lastGeneratedPrompt` var + `set-last-prompt` IPC handler + `buildTrayMenu()` helper + wire into `createMenuBarIcon` right-click |
| QCPY-002 | S | main.js: update `updateTrayMenu()` to use `buildTrayMenu()` |
| QCPY-003 | S | preload.js: expose `setLastPrompt` via contextBridge |
| QCPY-004 | S | App.jsx: call `setLastPrompt` in `handleGenerateResult` |
| QCPY-005 | S | Docs: CODEBASE.md, DECISIONS.md, TASKS.md |

---

## 7. Rollback plan

1. Remove `lastGeneratedPrompt` var from main.js
2. Revert `createMenuBarIcon` right-click to inline menu (remove `buildTrayMenu()`)
3. Revert `updateTrayMenu()` to inline menu
4. Remove `set-last-prompt` IPC handler
5. Remove `setLastPrompt` from preload.js contextBridge
6. Remove `setLastPrompt` call from App.jsx `handleGenerateResult`

---

## 8. Testing strategy

Manual smoke test (QCPY-004 complete):
- [ ] Generate a prompt → right-click menu bar icon → "Copy last prompt" appears at top
- [ ] Click it → prompt copied to clipboard silently → no window opens
- [ ] Paste confirms correct prompt text
- [ ] Menu bar icon briefly shows green dot (~1200ms) then reverts
- [ ] Before any prompt generated → "Copy last prompt" absent from menu
- [ ] After IDLE reset → "Copy last prompt" still shows last prompt (session persists until next generation or quit)
- [ ] Works from menuBarTray right-click

---

## 9. CODEBASE.md sections to update

After QCPY-001/002: Update `Module-scope variables (in main.js)` table — add `lastGeneratedPrompt`.
After QCPY-001/002: Update `IPC channels` table — add `set-last-prompt`.
After QCPY-003: Update `preload.js` row — add `setLastPrompt` to exposed methods.
