# FEATURE-013 — Implementation Plan

## Task breakdown
8 tasks, estimated 2.5 hours total.

PCFG-001 (S) — main.js: install electron-store, add Store instance at top,
  update resolveClaudePath and resolveWhisperPath to check store first,
  add get-stored-paths, save-paths, browse-for-binary, recheck-paths IPC handlers

PCFG-002 (S) — preload.js: add to contextBridge:
  getStoredPaths, savePaths, browseForBinary, recheckPaths

PCFG-003 (M) — splash.html HTML: add gear icon button top-right,
  add path config panel div (hidden by default) with inputs, status dots,
  browse buttons, save & recheck button, status message div

PCFG-004 (M) — splash.html JavaScript: add openPathPanel(), back button handler,
  browse handlers, setPathStatus() helper, saveRecheckBtn click handler,
  update runChecks() to add "tap ⚙ to set path" hint on failed checks

PCFG-005 (S) — main.js tray: add "Path configuration..." menu item to
  updateTrayMenu() that sends open-settings to renderer

PCFG-006 (S) — main.js shortcuts + App.jsx: register CommandOrControl+,
  global shortcut in registerShortcut(), add onOpenSettings to preload.js,
  listen in App.jsx and handle appropriately

PCFG-007 (S) — ShortcutsPanel.jsx: add { desc: 'Open path settings', keys: ['⌘', ','] }
  to Navigation group

PCFG-008 (S) — docs: update CODEBASE.md with new IPC channels,
  add DECISION to DECISIONS.md, mark FEATURE-013 complete in TASKS.md

## Order of execution
PCFG-001 → PCFG-002 → PCFG-003 → PCFG-004 → PCFG-005 → PCFG-006 → PCFG-007 → PCFG-008

## Implementation notes

### PCFG-001 detail
No new npm dependencies. Use `fs` (already required) and `app.getPath('userData')` (Electron built-in).

Add after existing module-level requires in main.js:
```js
const configPath = path.join(app.getPath('userData'), 'config.json')
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { return {} }
}
function writeConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2))
}
```

Note: `app.getPath('userData')` is only available after the `app` module is imported —
`configPath` must be defined after `const { app, ... } = require('electron')`, not at the
very top of the file. Define it just before `readConfig`/`writeConfig`.

Update resolveClaudePath() — add stored path check as FIRST thing before commonPaths:
```js
async function resolveClaudePath() {
  const stored = readConfig().claudePath
  if (stored && stored.trim()) {
    try { if (fs.existsSync(stored.trim())) return stored.trim() } catch {}
  }
  // ... rest of existing resolution logic unchanged
}
```

Update resolveWhisperPath() same pattern:
```js
async function resolveWhisperPath() {
  const stored = readConfig().whisperPath
  if (stored && stored.trim()) {
    try { if (fs.existsSync(stored.trim())) return stored.trim() } catch {}
  }
  // ... rest of existing resolution logic unchanged
}
```

IPC handlers inside app.whenReady():
```js
ipcMain.handle('get-stored-paths', () => {
  const config = readConfig()
  return {
    claudePath: claudePath || config.claudePath || '',
    whisperPath: whisperPath || config.whisperPath || ''
  }
})

ipcMain.handle('save-paths', async (event, { claudePath: cp, whisperPath: wp }) => {
  const config = readConfig()
  if (cp && cp.trim()) { config.claudePath = cp.trim(); claudePath = cp.trim() }
  if (wp && wp.trim()) { config.whisperPath = wp.trim(); whisperPath = wp.trim() }
  writeConfig(config)
  return { ok: true }
})

ipcMain.handle('browse-for-binary', async () => {
  const target = (splashWin && !splashWin.isDestroyed()) ? splashWin : win
  const { canceled, filePaths } = await dialog.showOpenDialog(target, {
    properties: ['openFile'],
    message: 'Select the binary file'
  })
  if (canceled || !filePaths.length) return { path: null }
  return { path: filePaths[0] }
})

ipcMain.handle('recheck-paths', async () => {
  claudePath = await resolveClaudePath()
  whisperPath = await resolveWhisperPath()
  return {
    claude: { ok: !!claudePath, path: claudePath },
    whisper: { ok: !!whisperPath, path: whisperPath }
  }
})
```

### PCFG-002 detail
Add to preload.js contextBridge exposeInMainWorld:
```js
getStoredPaths: () => ipcRenderer.invoke('get-stored-paths'),
savePaths: (paths) => ipcRenderer.invoke('save-paths', paths),
browseForBinary: () => ipcRenderer.invoke('browse-for-binary'),
recheckPaths: () => ipcRenderer.invoke('recheck-paths'),
onOpenSettings: (cb) => ipcRenderer.on('open-settings', (_e) => cb())
```

### PCFG-003 detail — exact HTML
Add as FIRST child of `.splash` div (gear icon button):
```html
<button id="settingsBtn" style="position:absolute;top:14px;right:16px;width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;outline:none;-webkit-app-region:no-drag">
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="2" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
    <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.6 2.6l1.1 1.1M10.3 10.3l1.1 1.1M2.6 11.4l1.1-1.1M10.3 3.7l1.1-1.1" stroke="rgba(255,255,255,0.5)" stroke-width="1.2" stroke-linecap="round"/>
  </svg>
</button>
```

Add as LAST child of `.splash` div (path config panel):
```html
<div id="pathPanel" style="display:none;position:absolute;inset:0;background:linear-gradient(135deg,#0A0A14,#0D0A18);border-radius:inherit;padding:18px 22px 22px;z-index:20;flex-direction:column">

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <span style="font-size:13px;font-weight:500;color:rgba(255,255,255,0.65);font-family:-apple-system,sans-serif">Path configuration</span>
    <button id="backBtn" style="font-size:11px;color:rgba(255,255,255,0.35);background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:7px;padding:4px 10px;cursor:pointer;font-family:-apple-system,sans-serif;outline:none">← Back</button>
  </div>

  <div style="margin-bottom:16px">
    <div style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-bottom:6px;font-family:-apple-system,sans-serif">Claude CLI path</div>
    <div style="display:flex;gap:8px;align-items:center">
      <div style="position:relative;flex:1">
        <input id="claudePathInput" type="text" placeholder="/usr/local/bin/claude"
          style="width:100%;height:36px;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.12);border-radius:8px;padding:0 36px 0 10px;font-size:11px;color:rgba(255,255,255,0.75);font-family:monospace;outline:none;box-sizing:border-box"/>
        <div id="claudeStatusDot" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.15)"></div>
      </div>
      <button id="browseClaudeBtn" style="height:36px;padding:0 12px;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;font-size:11px;color:rgba(255,255,255,0.4);cursor:pointer;font-family:-apple-system,sans-serif;white-space:nowrap;flex-shrink:0;outline:none">Browse</button>
    </div>
    <div id="claudePathHint" style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:5px;font-family:-apple-system,sans-serif;min-height:14px"></div>
  </div>

  <div style="margin-bottom:20px">
    <div style="font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,0.28);margin-bottom:6px;font-family:-apple-system,sans-serif">Whisper path</div>
    <div style="display:flex;gap:8px;align-items:center">
      <div style="position:relative;flex:1">
        <input id="whisperPathInput" type="text" placeholder="/usr/local/bin/whisper"
          style="width:100%;height:36px;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.12);border-radius:8px;padding:0 36px 0 10px;font-size:11px;color:rgba(255,255,255,0.75);font-family:monospace;outline:none;box-sizing:border-box"/>
        <div id="whisperStatusDot" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,0.15)"></div>
      </div>
      <button id="browseWhisperBtn" style="height:36px;padding:0 12px;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.1);border-radius:8px;font-size:11px;color:rgba(255,255,255,0.4);cursor:pointer;font-family:-apple-system,sans-serif;white-space:nowrap;flex-shrink:0;outline:none">Browse</button>
    </div>
    <div id="whisperPathHint" style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:5px;font-family:-apple-system,sans-serif;min-height:14px">Paste full path or use Browse to locate the binary</div>
  </div>

  <div style="height:0.5px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent);margin-bottom:16px"></div>

  <button id="saveRecheckBtn" style="width:100%;height:38px;background:linear-gradient(135deg,rgba(10,132,255,0.85),rgba(10,100,220,0.85));color:white;border:none;border-radius:10px;font-size:13px;font-weight:500;font-family:-apple-system,sans-serif;cursor:pointer;outline:none">
    Save &amp; Recheck
  </button>

  <div id="saveStatus" style="font-size:11px;text-align:center;margin-top:10px;min-height:16px;font-family:-apple-system,sans-serif"></div>
</div>
```

Element IDs used in PCFG-004 JS (must all be present): `pathPanel`, `backBtn`, `claudePathInput`, `claudeStatusDot`, `claudePathHint`, `browseClaudeBtn`, `whisperPathInput`, `whisperStatusDot`, `whisperPathHint`, `browseWhisperBtn`, `saveRecheckBtn`, `saveStatus`.

### PCFG-004 detail — runChecks() hint additions
After setCheck('cli', 'fail') add:
```js
const cliLabel = document.getElementById('label-cli')
if (cliLabel) cliLabel.innerHTML = 'Claude CLI <span style="font-size:10px;opacity:0.5;margin-left:4px">tap ⚙ to set path</span>'
```

After setCheck('whisper', 'fail') add:
```js
const whisperLabel = document.getElementById('label-whisper')
if (whisperLabel) whisperLabel.innerHTML = 'Whisper <span style="font-size:10px;opacity:0.5;margin-left:4px">tap ⚙ to set path</span>'
```

### PCFG-005 detail
In updateTrayMenu() in main.js, add before the first separator:
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

### PCFG-006 detail
In registerShortcut() in main.js add:
```js
globalShortcut.register('CommandOrControl+,', () => {
  if (win && !win.isDestroyed()) {
    win.show()
    win.focus()
    winSend('open-settings')
  }
})
```

In App.jsx, in the useEffect that sets up IPC listeners, add:
```js
window.electronAPI.onOpenSettings(() => {
  console.log('open-settings received — settings panel not yet implemented in main app')
})
```
Note: full SETTINGS state is out of scope for this feature — console log is the correct stub.

## Rollback plan
- Remove `configPath`, `readConfig()`, `writeConfig()` from main.js
- Remove stored path checks from resolveClaudePath / resolveWhisperPath
- Remove 4 IPC handlers from app.whenReady()
- Remove 5 entries from preload.js contextBridge
- Remove gear icon + pathPanel div from splash.html
- Remove JS additions from splash.html script block
- Remove Path configuration tray menu item
- Remove CommandOrControl+, shortcut
- Remove onOpenSettings listener from App.jsx
- Remove ⌘, row from ShortcutsPanel.jsx
