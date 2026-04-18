# FEATURE_TASKS.md — F-TRAY: Menu Bar / Tray Icon
> Folder: vibe/features/2026-04-18-tray-icon/
> Created: 2026-04-18

> **Estimated effort:** 3 tasks — S: 2, M: 1 — approx. 3-4 hours total

Add a macOS menu bar (system tray) icon. Clicking the icon shows/hides the floating bar.
Context menu: Show/Hide, Quit. App stays alive when all windows are closed (macOS convention).

---

### FTR-001 · Create tray icon in main.js
- **Status**: `[ ]`
- **Size**: M
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**:

1. Add `Tray` to the Electron imports at the top of main.js:
```js
const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu, Tray, shell } = require('electron');
```

2. Add a module-scope tray variable after `let splashWin`:
```js
let tray = null;
```

3. Create a helper function `createTray()` that builds a NativeImage from a data URI and
   creates the Tray. Call it from `splash-done` handler (after `registerShortcut()`).

The tray icon should be a 16×16 template image (black, macOS will invert for dark menu bar).
Use a simple microphone shape as a PNG data URI — encode a minimal 16×16 PNG inline:

```js
function createTray() {
  const { nativeImage } = require('electron');
  // 16x16 microphone icon — template image (macOS auto-inverts for dark/light menu bar)
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAV0lEQVQ4y2NgGAWkgf9QmhjNgJj+fxjNQIxmYjQTo5kYzcRoJkYzMZqJ0YzPTIxmYjQTo5mIaWZE86hhoBqwYRioAWwYBioAWwYBuoAG4aBCsBgBgCW0AkCQ4DJEQAAAABJRU5ErkJggg==');
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Promptly');
  updateTrayMenu();
}
```

NOTE: The base64 above is a placeholder — generate an actual 16×16 black microphone PNG
and encode it, OR use a simpler approach: write a tiny PNG file `assets/tray-icon.png`
and load it with `nativeImage.createFromPath(path.join(__dirname, 'assets/tray-icon.png'))`.
The asset approach is cleaner — do that instead.

**Preferred implementation**: 
- Create `assets/` directory
- Add `assets/tray-icon.png` (16×16 black silhouette, PNG, template-compatible)
- Load via `nativeImage.createFromPath`

For the icon image: use a simple circle (record button) or mic shape.
You can generate a minimal 16×16 PNG programmatically:

```js
// In createTray(), load from assets folder
const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
icon.setTemplateImage(true);
tray = new Tray(icon);
```

Create `assets/tray-icon.png` as a 16×16 white-on-transparent PNG circle
(macOS template images should be black-on-transparent; macOS handles inversion).

4. Add `updateTrayMenu()`:
```js
function updateTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    {
      label: win && win.isVisible() ? 'Hide Promptly' : 'Show Promptly',
      click: () => {
        if (!win || win.isDestroyed()) return;
        if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (!win || win.isDestroyed()) return;
    if (win.isVisible()) { win.hide(); } else { win.show(); win.focus(); }
    updateTrayMenu();
  });
}
```

5. In `splash-done` handler, after `registerShortcut()`, add: `createTray();`

**Acceptance criteria**:
- [ ] Tray icon appears in macOS menu bar after splash completes
- [ ] Clicking tray icon toggles show/hide of main window
- [ ] Context menu shows "Hide Promptly" when visible, "Show Promptly" when hidden
- [ ] Context menu "Quit" terminates app
- [ ] Icon is a template image (inverts correctly on dark/light menu bar)
- [ ] `tray` variable is module-scope (not inside a handler)
- [ ] `createTray()` only called once (from splash-done)

**Self-verify**: `npm start` → splash completes → tray icon appears in menu bar → click to hide bar → click to show → right-click → menu shows correct label.
**⚠️ Boundaries**: `main.js` only. No renderer changes. tray.on('click') must call `updateTrayMenu()` after toggle to keep label in sync.
**CODEBASE.md update?**: No — wait for FTR-003.

---

### FTR-002 · Keep app alive when window closed + dock behaviour
- **Status**: `[ ]`
- **Size**: S
- **Dependencies**: FTR-001
- **Touches**: `main.js`

**What to do**:

1. The current `window-all-closed` handler quits on non-macOS. On macOS with a tray, we want
   the app to stay alive when the window is closed (standard macOS tray app behaviour).
   Update the handler:

```js
app.on('window-all-closed', () => {
  // On macOS: stay alive in tray. On other platforms: quit.
  if (process.platform !== 'darwin' || !tray) {
    app.quit();
  }
});
```

2. Hide the Dock icon when the tray is active — menu bar apps conventionally don't show in Dock:
   In `createTray()`, after creating the tray:
```js
if (app.dock) app.dock.hide();
```

3. Update `activate` handler — if the user clicks the Dock icon (it may still appear briefly),
   show the window:
```js
app.on('activate', () => {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    updateTrayMenu();
  }
});
```

**Acceptance criteria**:
- [ ] Closing the main window (⌘W or traffic light close) does NOT quit the app
- [ ] App remains alive in tray after window close
- [ ] Dock icon hidden after splash completes
- [ ] Tray icon still functional after window close + reopen cycle
- [ ] Quitting via tray "Quit" or ⌘Q terminates app fully

**Self-verify**: `npm start` → splash → close window with traffic lights → app stays in menu bar → click tray → window reappears → right-click → Quit → app gone.
**⚠️ Boundaries**: `main.js` only. `app.dock.hide()` is macOS-only — it's already gated by `createTray()` which only runs on the splash-done path. No renderer changes.
**CODEBASE.md update?**: No — wait for FTR-003.

---

### FTR-003 · CODEBASE.md update
- **Status**: `[ ]`
- **Size**: S
- **Dependencies**: FTR-001, FTR-002
- **Touches**: `vibe/CODEBASE.md`

**What to do**:

Update CODEBASE.md to reflect:
- `Tray` added to Electron imports in main.js
- New module-scope var `tray` in main.js vars table
- New functions: `createTray()`, `updateTrayMenu()` in main.js key exports
- New file: `assets/tray-icon.png`
- Updated `window-all-closed` behaviour note
- Update "Last updated" line

**Acceptance criteria**:
- [ ] `tray` var listed in main.js module-scope vars
- [ ] `createTray()` and `updateTrayMenu()` listed in main.js key exports
- [ ] `assets/tray-icon.png` in file map
- [ ] "Last updated" updated

---

#### Conformance: F-TRAY
- [ ] Tray icon visible in macOS menu bar after app launch
- [ ] Click tray → toggles window visibility
- [ ] Right-click tray → context menu with Show/Hide + Quit
- [ ] Context menu label reflects current visibility state
- [ ] Dock icon hidden (app is a tray-only app)
- [ ] Window close does NOT quit the app
- [ ] Quit via tray menu fully terminates
- [ ] Template image inverts correctly for dark/light menu bar
- [ ] `npm run lint` passes
- [ ] CODEBASE.md updated
