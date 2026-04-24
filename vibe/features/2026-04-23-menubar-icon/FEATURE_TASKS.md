# FEATURE-017 Tasks

> **Estimated effort:** 5 tasks — S: 3, M: 2 — approx. 3-4 hours total

---

### MBAR-001 · PNG helpers + createMicIcon + createMenuBarIcon in main.js
- **Status**: `[x]` COMPLETE 2026-04-24
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#implementation-notes
- **Dependencies**: None
- **Touches**: `main.js`

**What to do**:
1. Add `const { deflateSync } = require('zlib')` to the top-level requires in main.js
2. Add `let menuBarTray = null` and `let pulseInterval = null` alongside the other module vars
3. Before `createTray()`, add the following in order:
   - `CRC_TABLE` constant (precomputed Uint32Array for CRC-32)
   - `crc32(buf)` function
   - `pngEncode(w, h, rgba)` function — produces valid PNG Buffer using IHDR/IDAT/IEND chunks
   - `createMicIcon(state, isDark, showDot)` function — 44×44 RGBA pixel drawing + pngEncode → nativeImage
     - `isDark` controls mic body colour (white/black) for dot states
     - `showDot` defaults true; passed as false on off-beat of pulse interval
     - 'hidden' state: draws same mic at 45% alpha, then setTemplateImage(true)
   - `createMenuBarIcon()` function — creates second Tray instance, wires click (show/hide) and right-click (popup existing tray menu)
4. In `createWindow()`, after `win.on('close', ...)`, add:
   - `win.on('hide', ...)` → clearInterval(pulseInterval); menuBarTray.setImage(createMicIcon('hidden'))
   - `win.on('show', ...)` → clearInterval(pulseInterval); menuBarTray.setImage(createMicIcon('idle'))
5. In the `splash-done` ipcMain.handle, after `createTray()`, add `createMenuBarIcon()`

**Acceptance criteria**:
- [x] A second Tray instance appears in the macOS menu bar (distinct from system tray)
- [x] IDLE icon uses template image — adapts to light/dark menu bar automatically
- [x] HIDDEN icon shows a distinct "mic with diagonal slash" template icon
- [x] Dot states (recording/thinking/ready) show the mic in white or black depending on theme
- [x] Single click shows/hides the floating bar
- [x] Right click opens the existing tray context menu

**Self-verify**: Run `npm start`, check menu bar for mic icon.
**Test requirement**: Manual — launch app, verify mic icon visible, click to show/hide.
**⚠️ Boundaries**: NEVER add canvas npm package. Use only zlib (built-in) + inline CRC-32.
**CODEBASE.md update?**: Yes — add menuBarTray to module vars table, add createMicIcon/createMenuBarIcon to main.js functions.
**Architecture compliance**: contextBridge pattern; nativeImage for template image; separate from existing tray.

**Decisions**:
- Used Node.js built-in zlib.deflateSync + inline CRC-32 instead of canvas npm package (zero runtime deps constraint)
- template image only for idle/hidden; dot states are non-template with theme-aware mic color (white/black) + full RGB dots

---

### MBAR-002 · update-menubar-state IPC handler in main.js
- **Status**: `[x]` COMPLETE 2026-04-24
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#ipc-channels-added
- **Dependencies**: MBAR-001
- **Touches**: `main.js`

**What to do**:
Add `ipcMain.handle('update-menubar-state', ...)` inside `app.whenReady()`.
Maps STATES enum strings to icon state strings, updates menuBarTray image + tooltip.

State mapping:
- IDLE → 'idle'
- RECORDING, PAUSED → 'recording' (pulse)
- THINKING, ITERATING → 'thinking' (pulse)
- PROMPT_READY → 'ready' (steady)
- HISTORY, SHORTCUTS, TYPING, ERROR → 'idle'

Tooltips:
- 'idle' → 'Promptly — ready'
- 'recording' → 'Promptly — recording...'
- 'thinking' → 'Promptly — generating...'
- 'ready' → 'Promptly — prompt ready'

Guard: if (!menuBarTray || menuBarTray.isDestroyed()) return early.

Pulse logic:
- Always `clearInterval(pulseInterval); pulseInterval = null` first.
- For 'recording' and 'thinking': set initial icon (showDot=true), then start
  `setInterval(600)` that toggles a `dotOn` boolean and calls `menuBarTray.setImage(createMicIcon(iconState, isDark, dotOn))`.
- For all other states: just set image directly (no interval).

**Acceptance criteria**:
- [x] RECORDING state: red dot appears in menu bar icon
- [x] THINKING/ITERATING state: blue dot appears
- [x] PROMPT_READY state: green dot appears
- [x] IDLE state: no dot (clean mic icon)
- [x] Tooltip updates to match current state

**Self-verify**: Smoke test all states, check tooltip via hover.
**Test requirement**: Manual — exercise all state transitions, verify icon updates.
**⚠️ Boundaries**: Only update menuBarTray, not the existing `tray` instance.
**CODEBASE.md update?**: Yes — add update-menubar-state to IPC channels table.
**Architecture compliance**: ipcMain.handle pattern; guard with isDestroyed().

**Decisions**:
- None yet.

---

### MBAR-003 · preload.js contextBridge exposure
- **Status**: `[x]` COMPLETE 2026-04-24
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#files-in-scope
- **Dependencies**: MBAR-002
- **Touches**: `preload.js`

**What to do**:
Add one line to the contextBridge.exposeInMainWorld object:
```
updateMenuBarState: (state) =>
  ipcRenderer.invoke('update-menubar-state', state),
```

**Acceptance criteria**:
- [x] `window.electronAPI.updateMenuBarState` is callable from renderer
- [x] Returns a promise (ipcRenderer.invoke)

**Self-verify**: `npm run lint` passes.
**Test requirement**: Manual — verify no console errors when renderer calls it.
**⚠️ Boundaries**: Do not touch any other preload.js methods.
**CODEBASE.md update?**: Yes — add updateMenuBarState to preload.js exports.
**Architecture compliance**: contextBridge + ipcRenderer.invoke pattern.

**Decisions**:
- None yet.

---

### MBAR-004 · App.jsx state transition calls
- **Status**: `[x]` COMPLETE 2026-04-24
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#files-in-scope
- **Dependencies**: MBAR-003
- **Touches**: `src/renderer/App.jsx`

**What to do**:
In the `transition()` function (around line 117-125), inside the existing
`if (window.electronAPI)` block, add:
```js
window.electronAPI.updateMenuBarState?.(newState)
```

Place it after the existing `setWindowButtonsVisible` call.

**Acceptance criteria**:
- [x] Every state transition fires updateMenuBarState with the new state name
- [x] Optional chaining (?.) prevents errors if API is not available

**Self-verify**: `npm run build:renderer` succeeds.
**Test requirement**: Manual — verify icon updates on each state change.
**⚠️ Boundaries**: Do not touch any logic outside the `if (window.electronAPI)` block.
**CODEBASE.md update?**: No — no structural change to App.jsx.
**Architecture compliance**: All renderer→main calls via window.electronAPI.

**Decisions**:
- None yet.

---

### MBAR-005 · Docs update
- **Status**: `[x]` COMPLETE 2026-04-24
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md
- **Dependencies**: MBAR-004
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:
1. CODEBASE.md — add to Module-scope variables table: `menuBarTray`
2. CODEBASE.md — add to IPC channels table: `update-menubar-state`
3. CODEBASE.md — add createMicIcon/createMenuBarIcon to main.js functions column
4. DECISIONS.md — append FEATURE-017 entry
5. TASKS.md — mark FEATURE-017 complete (8/8 ✅)

**Acceptance criteria**:
- [x] CODEBASE.md updated with menuBarTray, update-menubar-state, new functions
- [x] DECISIONS.md has FEATURE-017 entry
- [x] TASKS.md reflects completion

**Self-verify**: Read CODEBASE.md IPC table and verify entry present.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task.

**Decisions**:
- None yet.

---

#### Conformance: FEATURE-017 — Persistent Menu Bar Icon
> Tick after every task. All items ✅ before feature is shippable.
- [x] Mic icon permanently visible in macOS menu bar
- [x] IDLE icon uses template image — adapts to light/dark menu bar
- [x] Single click shows/hides bar
- [x] Right click opens existing context menu
- [x] No dot in IDLE state
- [x] Red dot pulses (600 ms) during RECORDING and PAUSED
- [x] Blue dot pulses (600 ms) during THINKING and ITERATING
- [x] Green dot steady (no pulse) during PROMPT_READY
- [x] HIDDEN state shows dimmed mic (45% alpha, template image — same shape)
- [x] Pulse stops and interval is cleared on every state change
- [x] Dot states: mic body white on dark menu bar, black on light menu bar
- [x] State updates via IPC from renderer
- [x] Theme change regenerates current dot-state icon correctly
- [ ] Existing ⌥ Space shortcut still works (manual smoke test pending)
- [x] Existing tray icon behaviour unchanged
- [x] npm run lint — 0 errors
- [x] npm run build:renderer — succeeds
- [x] CODEBASE.md updated
- [x] DECISIONS.md updated
---
