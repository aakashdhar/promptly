# FEATURE-013 Tasks

> **Estimated effort:** 8 tasks — S: 6, M: 2 — approx. 2.5 hours total

**Commit format (per task):**
```
feat(path-config): [PCFG-00X] — description
```
Code and doc commits always separate. Lint must pass before every commit.

---

### PCFG-001 · main.js: electron-store + 4 IPC handlers
- **Status**: `[x]`
- **Size**: S
- **Dependencies**: None
- **Touches**: `main.js`, `package.json`

**What to do**:
1. No npm install — zero new runtime dependencies
2. Add `configPath`, `readConfig()`, `writeConfig()` to main.js after existing requires
   — see FEATURE_PLAN.md PCFG-001 detail for exact code
   — `configPath` uses `app.getPath('userData')` — define after `const { app, ... } = require('electron')`
3. In resolveClaudePath(): add `readConfig().claudePath` check as FIRST thing (before commonPaths array)
4. In resolveWhisperPath(): same `readConfig().whisperPath` check pattern
5. Add 4 ipcMain.handle handlers inside app.whenReady(): `get-stored-paths`, `save-paths`, `browse-for-binary`, `recheck-paths`
   - See FEATURE_PLAN.md for exact code
   - browse-for-binary: target = splashWin if active, else win
   - save-paths: reads config, updates fields, calls writeConfig, updates runtime vars

**Acceptance criteria**:
- [ ] No new entries in package.json dependencies (zero runtime deps preserved)
- [ ] `readConfig()` / `writeConfig()` functions present in main.js
- [ ] resolveClaudePath() checks `readConfig().claudePath` before auto-resolution
- [ ] resolveWhisperPath() checks `readConfig().whisperPath` before auto-resolution
- [ ] All 4 IPC handlers registered without lint errors
- [ ] `npm run lint` — 0 errors

**Self-verify**: `npm run lint` passes; `npm start` boots without errors.
**CODEBASE.md update?**: Yes — defer to PCFG-008.

---

### PCFG-002 · preload.js: contextBridge exposures
- **Status**: `[x]`
- **Size**: S
- **Dependencies**: PCFG-001
- **Touches**: `preload.js`

**What to do**:
Add 5 entries to the contextBridge exposeInMainWorld object:
```js
getStoredPaths: () => ipcRenderer.invoke('get-stored-paths'),
savePaths: (paths) => ipcRenderer.invoke('save-paths', paths),
browseForBinary: () => ipcRenderer.invoke('browse-for-binary'),
recheckPaths: () => ipcRenderer.invoke('recheck-paths'),
onOpenSettings: (cb) => ipcRenderer.on('open-settings', (_e) => cb())
```

**Acceptance criteria**:
- [ ] All 5 methods callable as `window.electronAPI.*`
- [ ] `npm run lint` — 0 errors

**Self-verify**: `npm run lint` passes.
**CODEBASE.md update?**: Yes — defer to PCFG-008.

---

### PCFG-003 · splash.html HTML: gear icon + path config panel
- **Status**: `[x]`
- **Size**: M
- **Dependencies**: PCFG-002
- **Touches**: `splash.html`

**What to do**:
1. Inside `.splash` div, add gear icon button as FIRST child:
   - `id="settingsBtn"`, position:absolute top:14px right:16px, 28×28px
   - SVG gear icon with `rgba(255,255,255,0.5)` stroke
   - `style="-webkit-app-region:no-drag"` — must not drag the window
2. Inside `.splash` div, add path config panel as LAST child:
   - `id="pathPanel"`, display:none, position:absolute inset:0, z-index:20
   - Header row: "Path configuration" label + Back button (`id="backBtn"`)
   - Claude CLI section: label, input (`id="claudePathInput"`), status dot (`id="claudeStatusDot"`), Browse button (`id="browseClaudeBtn"`), hint div (`id="claudePathHint"`)
   - Whisper section: same pattern with `whisper` prefix IDs
   - Divider line
   - Save & Recheck button (`id="saveRecheckBtn"`)
   - Status message div (`id="saveStatus"`)
   - See FEATURE_SPEC.md for exact inline styles

**Acceptance criteria**:
- [ ] Gear icon visible in top-right of splash at all times
- [ ] Path panel div present in DOM (hidden by default)
- [ ] All required element IDs present
- [ ] `npm start` — splash renders without visual regressions

**Self-verify**: `npm start`, verify gear icon visible on splash.
**CODEBASE.md update?**: No — no structural JS change.

---

### PCFG-004 · splash.html JavaScript: panel logic
- **Status**: `[x]`
- **Size**: M
- **Dependencies**: PCFG-003
- **Touches**: `splash.html`

**What to do**:
Add to `<script>` block BEFORE `runChecks()`:

1. `setPathStatus(prefix, connected, path)` helper — sets dot colour, border colour, hint text
   - connected: green dot (#30D158 at 90%), green border, "✓ Connected: /path"
   - not connected: red dot (#FF3B30 at 70%), red border, "Not found — paste path manually or use Browse"
2. `openPathPanel()` — shows pathPanel, calls `getStoredPaths`, pre-fills inputs, calls setPathStatus for each
3. `settingsBtn` click → `openPathPanel()`
4. `backBtn` click → `pathPanel.style.display = 'none'`
5. `browseClaudeBtn` click → `browseForBinary()` → fill claudePathInput + setPathStatus
6. `browseWhisperBtn` click → same with whisperPathInput
7. `saveRecheckBtn` click:
   - Show "Saving..." then "Rechecking..." in saveStatus
   - Call `savePaths({ claudePath, whisperPath })`
   - Call `recheckPaths()` → update both setPathStatus calls
   - Both ok: show "✓ All checks passed — launching", 1s delay → hide panel → showReady → splashDone after 800ms
   - One fails: show specific error in saveStatus (Claude or Whisper, not both)

Update `runChecks()`:
- After `setCheck('cli', 'fail')` add label hint: `'tap ⚙ to set path'`
- After `setCheck('whisper', 'fail')` add label hint: same

**Acceptance criteria**:
- [ ] Clicking gear opens panel with stored paths pre-filled
- [ ] Green/red dot + hint correct for each field state
- [ ] Browse fills input field correctly
- [ ] Save & Recheck saves, rechecks, shows result
- [ ] Both pass → auto-launches after 1s
- [ ] One fails → stays on panel with error message
- [ ] Back closes panel without saving
- [ ] Failed check label shows "tap ⚙ to set path"

**Self-verify**: Exercise full panel flow with npm start.
**CODEBASE.md update?**: No.

---

### PCFG-005 · main.js tray: "Path configuration..." menu item
- **Status**: `[x]`
- **Size**: S
- **Dependencies**: PCFG-002
- **Touches**: `main.js`

**What to do**:
In `updateTrayMenu()`, add before the first separator:
```js
{
  label: 'Path configuration...',
  click: () => {
    if (win && !win.isDestroyed()) {
      win.show()
      win.focus()
      win.webContents.send('open-settings')
    }
  }
},
```

**Acceptance criteria**:
- [ ] Tray right-click shows "Path configuration..." item
- [ ] Clicking it shows and focuses the main window and sends open-settings to it
- [ ] Console in main renderer logs the open-settings receipt (stub — full panel is future work)
- [ ] `npm run lint` — 0 errors

**Self-verify**: Right-click tray, verify item present.
**CODEBASE.md update?**: No — defer to PCFG-008.

---

### PCFG-006 · main.js ⌘, shortcut + App.jsx stub listener
- **Status**: `[x]`
- **Size**: S
- **Dependencies**: PCFG-005
- **Touches**: `main.js`, `src/renderer/App.jsx`

**What to do**:
1. In `registerShortcut()` in main.js, add:
   ```js
   globalShortcut.register('CommandOrControl+,', () => {
     if (win && !win.isDestroyed()) {
       win.show()
       win.focus()
       winSend('open-settings')
     }
   })
   ```
2. In App.jsx, in the useEffect that sets up IPC listeners, add:
   ```js
   window.electronAPI.onOpenSettings(() => {
     console.log('open-settings received — settings panel not yet implemented in main app')
   })
   ```
   Note: full SETTINGS state is out of scope — console stub is correct for now.

**Acceptance criteria**:
- [ ] ⌘, fires when main app window is active
- [ ] App.jsx logs message on receiving open-settings
- [ ] `npm run build:renderer` succeeds
- [ ] `npm run lint` — 0 errors

**Self-verify**: `npm start`, press ⌘, → check console.
**CODEBASE.md update?**: No — defer to PCFG-008.

---

### PCFG-007 · ShortcutsPanel.jsx: ⌘, navigation row
- **Status**: `[x]`
- **Size**: S
- **Dependencies**: PCFG-006
- **Touches**: `src/renderer/components/ShortcutsPanel.jsx`

**What to do**:
In the Navigation group items array, add:
```js
{ desc: 'Open path settings', keys: ['⌘', ','] }
```

**Acceptance criteria**:
- [ ] ShortcutsPanel shows "Open path settings ⌘ ," in Navigation group
- [ ] `npm run build:renderer` succeeds

**Self-verify**: Open shortcuts panel (⌘?), verify row visible.
**CODEBASE.md update?**: No — defer to PCFG-008.

---

### PCFG-008 · Docs: CODEBASE.md + DECISIONS.md + TASKS.md
- **Status**: `[x]`
- **Size**: S
- **Dependencies**: PCFG-007
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:
1. CODEBASE.md — add 4 IPC channels to IPC table:
   - `get-stored-paths` → returns stored claude and whisper paths from electron-store
   - `save-paths` → saves paths to electron-store and updates runtime variables
   - `browse-for-binary` → opens macOS file picker dialog
   - `recheck-paths` → reruns path resolution and returns results
2. CODEBASE.md — add `store` (electron-store instance) to module-scope variables table
3. DECISIONS.md — append FEATURE-013 entry:
   > Path configuration panel added to splash screen. Gear icon opens editable path
   > inputs with green/red connected status. Paths saved via electron-store persist
   > across restarts. Tray menu and ⌘, shortcut provide access post-launch.
   > Resolves team onboarding friction for nvm/pyenv installs.
4. TASKS.md — mark FEATURE-013 complete

**Acceptance criteria**:
- [ ] CODEBASE.md IPC table has all 4 new channels
- [ ] CODEBASE.md module vars table has `store`
- [ ] DECISIONS.md has FEATURE-013 entry
- [ ] TASKS.md reflects completion

---

#### Conformance: FEATURE-013 — Path Configuration Panel
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Gear icon always visible in splash top-right
- [ ] Clicking gear opens path config panel
- [ ] Stored paths pre-fill inputs on panel open
- [ ] Green dot + "Connected: /path" when path valid
- [ ] Red dot + "Not found" hint when path missing
- [ ] Browse opens macOS file picker and fills input
- [ ] Save & Recheck saves and reruns checks
- [ ] Both pass → "All checks passed" → auto-launches after 1s
- [ ] One fails → specific error message, stays on panel
- [ ] Failed check labels show "tap ⚙ to set path" hint
- [ ] Back button closes panel without saving
- [ ] Tray menu has "Path configuration..." item — shows window + sends open-settings (console stub)
- [ ] ⌘, shows window + logs open-settings in console (stub)
- [ ] ShortcutsPanel shows "Open path settings ⌘ ,"
- [ ] electron-store paths survive full app quit + relaunch
- [ ] npm run lint — 0 errors
- [ ] npm run build:renderer — succeeds
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md updated
---
