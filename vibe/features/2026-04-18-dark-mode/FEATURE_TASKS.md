# FEATURE_TASKS.md — F-DARKMODE: Dark / Light Mode
> Folder: vibe/features/2026-04-18-dark-mode/
> Created: 2026-04-18

> **Estimated effort:** 3 tasks — S: 2, M: 1 — approx. 3-4 hours total

Follow the macOS appearance setting. Current app is always dark glass. This feature adds a
light glass palette that activates when macOS is in Light Mode. Dark Mode keeps the existing
look. Both are frosted glass — only the tint colours and text opacity change.

---

### FDM-001 · Light mode CSS tokens + body.light overrides
- **Status**: `[ ]`
- **Size**: M
- **Dependencies**: None
- **Touches**: `index.html`

**What to do**:

The current `:root` defines the dark palette. Add a `body.light` override block that changes
only what needs to change. Everything not overridden inherits from `:root`.

Add after the `:root` block:

```css
body.light {
  --bg-bar: rgba(0,0,0,0.02);
  --border-top: 0.5px solid rgba(0,0,0,0.12);
  --border-left: 0.5px solid rgba(0,0,0,0.08);
  --border-right: 0.5px solid rgba(0,0,0,0.05);
  --border-bottom: 0.5px solid rgba(0,0,0,0.03);
  --bar-shadow: 0 0 0 0.5px rgba(0,0,0,0.06) inset, 0 16px 48px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1);
  --highlight-top: linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent);
  --accent-bottom: linear-gradient(90deg, transparent, rgba(10,132,255,0.1), transparent);
  --divider: linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent);
  --blue: #007AFF;
  --red: #FF3B30;
  --green: #34C759;
}

body.light .bar::before {
  background: rgba(255,255,255,0.7);
}

body.light .ready-title  { color: rgba(0,0,0,0.7); }
body.light .ready-sub    { color: rgba(0,0,0,0.35); }
body.light .think-title  { color: rgba(0,0,0,0.5); }
body.light .mode-pill    {
  background: rgba(0,122,255,0.1);
  border-color: rgba(0,122,255,0.2);
  color: rgba(0,100,200,0.8);
}
body.light .pr-status    { color: rgba(0,0,0,0.45); }
body.light .pr-btn       { color: rgba(0,0,0,0.3); }
body.light .pr-btn:hover { color: #007AFF; }
body.light .ys-label     { color: rgba(0,0,0,0.25); }
body.light .ys-text      { color: rgba(0,0,0,0.6); }
body.light .ys-label-s   { color: rgba(0,0,0,0.2); }
body.light .ys-text-s    { color: rgba(0,0,0,0.55); }
body.light .prompt-out   { color: rgba(0,0,0,0.8); }
body.light .pt-sl        { color: rgba(0,100,200,0.5); }
body.light .btn-edit     {
  border-color: rgba(0,0,0,0.1);
  background: rgba(0,0,0,0.03);
  color: rgba(0,0,0,0.5);
}
body.light .btn-edit:hover {
  background: rgba(0,0,0,0.06);
  border-color: rgba(0,0,0,0.15);
}
body.light .ready-title#error-message { color: rgba(0,0,0,0.7); }
body.light .transcript-text { color: rgba(0,0,0,0.45); }
body.light .rec-dur      { color: rgba(0,0,0,0.35); }
body.light .dismiss-btn  {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.1);
}
body.light .dismiss-btn:hover { background: rgba(0,0,0,0.08); }
```

Also update the two hardcoded hex values that bypass tokens (detected in final review):
- `.pr-check { color: var(--green); }` (was `#30D158`)
- `.pr-btn:hover { color: var(--blue); }` (was `#0A84FF`)
- `.stop-btn { background: var(--red); }` (was `#FF3B30`)

These need to use CSS variables so light mode overrides work correctly.

**Acceptance criteria**:
- [ ] `body.light` override block present with all colour tokens redefined
- [ ] All affected components readable in light mode (no white-on-white or black-on-black)
- [ ] `.pr-check`, `.pr-btn:hover`, `.stop-btn` use CSS var tokens
- [ ] Dark mode (no `.light` class) unchanged — all existing styles still pass visual check
- [ ] `vibrancy: 'fullscreen-ui'` in main.js remains — macOS vibrancy handles background correctly in both modes

**Self-verify**: Open DevTools → Console → `document.body.classList.add('light')` → visually verify all 5 states are readable. Then `document.body.classList.remove('light')` → dark mode restored.
**⚠️ Boundaries**: CSS only in this task. Do not touch main.js or preload.js yet.
**CODEBASE.md update?**: No — wait for FDM-003.

---

### FDM-002 · main.js nativeTheme listener → theme-changed IPC
- **Status**: `[ ]`
- **Size**: S
- **Dependencies**: None (parallel with FDM-001)
- **Touches**: `main.js`, `preload.js`

**What to do**:

1. Add `nativeTheme` to Electron imports in main.js:
```js
const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu, Tray, shell, nativeTheme } = require('electron');
```

2. In `createWindow()`, after `win.loadFile('index.html')`, add the theme listener:
```js
nativeTheme.on('updated', () => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('theme-changed', { dark: nativeTheme.shouldUseDarkColors });
  }
});
```

3. Add a handler for the renderer to query the current theme at boot:
```js
ipcMain.handle('get-theme', () => {
  return { dark: nativeTheme.shouldUseDarkColors };
});
```

4. Add to preload.js:
```js
getTheme: () => ipcRenderer.invoke('get-theme'),
onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, data) => callback(data)),
```

**Acceptance criteria**:
- [ ] `nativeTheme` imported in main.js
- [ ] `theme-changed` event sent to renderer when macOS appearance changes
- [ ] `get-theme` IPC returns current `{ dark: boolean }` immediately
- [ ] Both methods exposed in preload.js via contextBridge
- [ ] No theme logic in main.js — that lives in the renderer

**Self-verify**: `npm run lint` passes. In renderer DevTools: `window.electronAPI.getTheme()` returns `{ dark: true/false }` matching current macOS setting.
**⚠️ Boundaries**: No renderer changes in this task. Add `get-theme` and `theme-changed` to ARCHITECTURE.md IPC table after this task.
**CODEBASE.md update?**: No — wait for FDM-003.

---

### FDM-003 · Renderer theme wiring + CODEBASE.md
- **Status**: `[ ]`
- **Size**: S
- **Dependencies**: FDM-001, FDM-002
- **Touches**: `index.html`, `vibe/CODEBASE.md`, `vibe/ARCHITECTURE.md`

**What to do**:

1. In `index.html`, after `setState(STATES.IDLE)` (the boot call at end of script), add:

```js
// Apply initial theme
window.electronAPI.getTheme().then(({ dark }) => {
  document.body.classList.toggle('light', !dark);
});

// React to macOS appearance changes
window.electronAPI.onThemeChanged(({ dark }) => {
  document.body.classList.toggle('light', !dark);
});
```

2. Update ARCHITECTURE.md IPC surface table — add two new rows:
   - `get-theme` (renderer → main): returns `{ dark: boolean }`
   - `theme-changed` (main → renderer): sends `{ dark: boolean }` on appearance change

3. Update CODEBASE.md:
   - Add `getTheme`, `onThemeChanged` to preload.js exports
   - Add `get-theme`, `theme-changed` to IPC channels table
   - Add `body.light` CSS note
   - Update "Last updated" line

**Acceptance criteria**:
- [ ] On launch: `body.light` class applied if macOS is in Light Mode; absent in Dark Mode
- [ ] Switching macOS appearance (System Settings → Appearance) updates app in real time
- [ ] ARCHITECTURE.md IPC table includes `get-theme` and `theme-changed`
- [ ] CODEBASE.md updated
- [ ] `npm run lint` passes

**Self-verify**: Set macOS to Light Mode → launch app → light palette renders. Switch to Dark Mode → app updates to dark glass in real time without relaunch.
**⚠️ Boundaries**: `classList.toggle('light', !dark)` is the only DOM mutation — not routed through setState because theme is orthogonal to app state.

---

#### Conformance: F-DARKMODE
- [ ] Light Mode: all 5 states readable (no contrast failures)
- [ ] Dark Mode: existing dark glass look unchanged
- [ ] Real-time switch: appearance change reflects immediately without relaunch
- [ ] CSS variables (not hardcoded hex) used for all colour properties
- [ ] No flicker on launch — theme applied before first paint (within `getTheme()` promise)
- [ ] `npm run lint` passes
- [ ] CODEBASE.md + ARCHITECTURE.md updated
