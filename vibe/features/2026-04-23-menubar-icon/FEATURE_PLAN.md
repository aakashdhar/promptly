# FEATURE-017 — Implementation Plan

## Impact map

### Files modified
- `main.js` — add CRC_TABLE, crc32(), pngEncode(), createMicIcon(), createMenuBarIcon();
  add `menuBarTray` module var; add win.on('hide'/'show') handlers in createWindow();
  call createMenuBarIcon() in splash-done; add update-menubar-state IPC handler
- `preload.js` — add updateMenuBarState to contextBridge
- `src/renderer/App.jsx` — add updateMenuBarState call in transition()

### Files not modified
- All renderer components (only App.jsx)
- splash.html, entitlements.plist, vite.config.js, package.json
- All vibe docs except DECISIONS.md, CODEBASE.md, TASKS.md

## PNG icon approach (zero runtime deps)

### Why no `canvas` npm package
ARCHITECTURE.md hard rule: zero runtime npm deps. `canvas` is a native npm module.
Node.js built-in `zlib.deflateSync` provides compression. CRC-32 is implemented
inline as ~40 lines of pure JS. Together these allow PNG generation at runtime
with zero external deps.

### Icon drawing pipeline
1. `createMicIcon(state)` allocates a 44×44 RGBA Uint8Array
2. `paintDisk(cx, cy, r, ...)` — anti-aliased filled circle (used for dots + arc steps)
3. `strokeArc(cx, cy, radius, lw, a0, a1, ...)` — stroke an arc by stepping and calling paintDisk
4. `strokeLine(x0, y0, x1, y1, lw, ...)` — stroke a line segment by stepping and calling paintDisk
5. Mic shape: top semicircle cap + bottom semicircle cap + left/right straight sides + arm arc + stem + base
6. State dot in upper-right corner (dotX=34, dotY=10, dotR=5px)
7. `pngEncode(w, h, rgba)` — produces valid PNG buffer using zlib.deflateSync + CRC chunks
8. `nativeImage.createFromBuffer(buf, { scaleFactor: 2 })` → Tray icon

### Icon states
| state arg   | template? | mic color          | dot               | pulse?  |
|-------------|-----------|---------------------|-------------------|---------|
| 'idle'      | yes       | auto (template)     | none              | no      |
| 'hidden'    | yes (45% α)| auto (template)   | none              | no      |
| 'recording' | no        | white/black by theme| red #FF3B30       | yes     |
| 'thinking'  | no        | white/black by theme| blue #0A84FF      | yes     |
| 'ready'     | no        | white/black by theme| green #30D158     | no      |

`createMicIcon(state, isDark, showDot)` — `isDark` only used for non-template dot states.
`showDot` defaults true; pulsing alternates it false at 600 ms intervals.
`nativeTheme.on('updated')` fires → regenerate current dot-state icon with new `isDark` value.
Track current icon state in `currentMenuBarState` + `let pulseInterval = null` module vars.

### Pulsing implementation
- On entering 'recording' or 'thinking': `clearInterval(pulseInterval)` first, then
  start new `setInterval(600)` that alternates `showDot` true/false via `menuBarTray.setImage()`
- On any state change (including to 'ready', 'idle', 'hidden'): `clearInterval(pulseInterval); pulseInterval = null`
- HIDDEN: `createMicIcon('hidden')` draws same mic silhouette but all pixels at 45% alpha, then `setTemplateImage(true)`

## Task breakdown

### MBAR-001 (M) — main.js: PNG helpers + createMicIcon + createMenuBarIcon
- Add `const { deflateSync } = require('zlib')` at top
- Add `let menuBarTray = null` module var
- Add CRC_TABLE constant + crc32() + pngEncode() functions
- Add createMicIcon(state) function
- Add createMenuBarIcon() function
- In createWindow(): add win.on('hide') and win.on('show') handlers
- In splash-done: call createMenuBarIcon() after createTray()

### MBAR-002 (M) — main.js: update-menubar-state IPC handler
- ipcMain.handle('update-menubar-state', ...) — maps state strings to icon states
- Updates menuBarTray image + tooltip on every state transition

### MBAR-003 (S) — preload.js: contextBridge exposure
- Add updateMenuBarState: (state) => ipcRenderer.invoke('update-menubar-state', state)

### MBAR-004 (S) — App.jsx: state transition calls
- Inside transition() function, add updateMenuBarState call within the
  existing `if (window.electronAPI)` block

### MBAR-005 (S) — docs: CODEBASE.md + DECISIONS.md + TASKS.md

## Order
MBAR-001 → MBAR-002 → MBAR-003 → MBAR-004 → MBAR-005

## Rollback plan
- Delete createMicIcon, pngEncode, crc32, createMenuBarIcon, menuBarTray from main.js
- Remove win.on('hide'/'show') handlers
- Remove createMenuBarIcon() call from splash-done
- Remove update-menubar-state ipcMain.handle
- Remove updateMenuBarState from preload.js
- Remove updateMenuBarState call from App.jsx transition()
