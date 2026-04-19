# FEATURE_TASKS.md — FEATURE-007: Export Formats

> Feature folder: vibe/features/2026-04-19-export-formats/
> Added: 2026-04-19
> **Estimated effort:** 4 tasks — S: 3 (<2hrs each), M: 1 (2-4hrs) — approx. 4-5 hours total

---

### EXP-001 · ExportPanel.jsx — new component
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria
- **Dependencies**: None
- **Touches**: `src/renderer/components/ExportPanel.jsx` (new)

**What to do**:
Create `src/renderer/components/ExportPanel.jsx` with:

1. FORMATS constant:
```js
const FORMATS = [
  { id: 'txt',  label: 'Text',     ext: '.txt',  icon: '⌄' },
  { id: 'md',   label: 'Markdown', ext: '.md',   icon: '✦' },
  { id: 'json', label: 'JSON',     ext: '.json', icon: '{}' },
]
```

2. Props: `{ prompt, transcript, mode, onExportDone }`
3. State: `selected` (default `'txt'`), `exporting` (boolean)
4. `formatContent(format, prompt, transcript, mode)` pure function:
   - `'txt'`: `` `PROMPT\n\n${prompt}\n\nYOU SAID\n\n${transcript}\n\nMODE: ${mode}` ``
   - `'md'`: `` `# Generated Prompt\n\n${prompt}\n\n---\n\n**You said:** ${transcript}\n\n**Mode:** ${mode}\n\n**Generated:** ${new Date().toISOString()}` ``
   - `'json'`: `JSON.stringify({ prompt, transcript, mode, timestamp: new Date().toISOString() }, null, 2)`
5. `handleExport()` async function:
   - `setExporting(true)`
   - `const content = formatContent(selected, prompt, transcript, mode)`
   - `const filename = \`prompt-\${Date.now()}.\${selected}\``
   - `await window.electronAPI.saveFile({ content, filename, format: selected })`
   - `setExporting(false)`
   - `if (onExportDone) onExportDone()`
6. JSX: wrapper div `px-[22px] pt-[14px] pb-0`, label "Export as", grid of 3 format tiles
7. Tile style (selected): `border: '0.5px solid rgba(10,132,255,0.35)'`, `background: 'rgba(10,132,255,0.08)'`
8. Tile style (unselected): `border: '0.5px solid rgba(255,255,255,0.1)'`, `background: 'rgba(255,255,255,0.04)'`
9. Tile label (selected): `color: 'rgba(100,180,255,0.85)'` | (unselected): `color: 'rgba(255,255,255,0.5)'`
10. No ↓ Export button in this component — it lives in PromptReadyState's button row

**Acceptance criteria**:
- [ ] Component renders without errors
- [ ] Three tiles render with correct label, ext, icon
- [ ] Clicking a tile updates selected state and tile highlights in blue
- [ ] `formatContent('txt', ...)` returns plain text with PROMPT / YOU SAID / MODE sections
- [ ] `formatContent('md', ...)` returns valid Markdown
- [ ] `formatContent('json', ...)` returns valid JSON string parseable with JSON.parse
- [ ] `handleExport()` calls `window.electronAPI.saveFile` with correct content + filename
- [ ] After save, `onExportDone()` is called

**Self-verify**: Re-read FEATURE_SPEC.md#acceptance-criteria. Tick every criterion.
**Test requirement**: Manual — verify all three format outputs by inspecting saved file content
**⚠️ Boundaries**: No `dangerouslySetInnerHTML`; no `innerHTML` with dynamic content; no runtime npm deps
**CODEBASE.md update?**: Yes — add to file map in EXP-004
**Architecture compliance**: JSX text nodes only; useRef if needed for stale closures; no direct DOM mutation

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EXP-002 · save-file IPC handler (main.js + preload.js)
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#7-new-ipc-channels
- **Dependencies**: None (parallel with EXP-001)
- **Touches**: `main.js`, `preload.js`

**What to do**:

**main.js:**
1. Add `dialog` to the existing destructured require at the top of main.js:
   `const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Menu, Tray, nativeImage, nativeTheme, shell, dialog } = require('electron');`
2. Add inside `app.whenReady()` block (after existing ipcMain handlers):
```js
ipcMain.handle('save-file', async (_event, { content, filename }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: filename,
    filters: [
      { name: 'Text',     extensions: ['txt'] },
      { name: 'Markdown', extensions: ['md']  },
      { name: 'JSON',     extensions: ['json'] },
    ],
  })
  if (canceled || !filePath) return { ok: false }
  try {
    fs.writeFileSync(filePath, content, 'utf8')
    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
```

**preload.js:**
Add to the `contextBridge.exposeInMainWorld('electronAPI', {...})` object:
```js
saveFile: (opts) => ipcRenderer.invoke('save-file', opts),
```

**Acceptance criteria**:
- [ ] `dialog` is destructured from `require('electron')` in main.js
- [ ] `save-file` ipcMain.handle is registered
- [ ] Calling `saveFile({content, filename})` opens macOS save dialog
- [ ] Cancelled dialog returns `{ ok: false }`
- [ ] Successful save writes file and returns `{ ok: true, filePath }`
- [ ] `fs.writeFileSync` errors are caught and returned as `{ ok: false, error }`
- [ ] `window.electronAPI.saveFile` is accessible in renderer

**Self-verify**: Re-read FEATURE_SPEC.md#7. Tick every criterion.
**Test requirement**: Manual — trigger save, cancel, verify return; trigger save, confirm path, verify file written
**⚠️ Boundaries**: Only add `dialog` to destructure — do not change any other existing requires; `fs` already required
**CODEBASE.md update?**: Yes — add save-file to IPC table + saveFile to preload methods in EXP-004
**Architecture compliance**: `ipcMain.handle` pattern; `contextBridge` for preload; `fs` already in scope

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EXP-003 · PromptReadyState.jsx integration
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria + FEATURE_PLAN.md#5-frontend-changes
- **Dependencies**: EXP-001, EXP-002
- **Touches**: `src/renderer/components/PromptReadyState.jsx`

**What to do**:

1. **Import ExportPanel**:
```js
import ExportPanel from './ExportPanel.jsx'
```

2. **Add props**: Add `mode` to the destructured props (already passed from App.jsx).
   Current: `{ originalTranscript, generatedPrompt, setGeneratedPrompt, onRegenerate, onReset }`
   Updated: `{ originalTranscript, generatedPrompt, setGeneratedPrompt, onRegenerate, onReset, mode }`

3. **Add showExport state**:
```js
const [showExport, setShowExport] = useState(false)
```

4. **Window resize useEffect** (watches showExport):
```js
useEffect(() => {
  if (window.electronAPI) {
    window.electronAPI.resizeWindow(showExport ? 650 : 560)
  }
}, [showExport])
```

5. **export-prompt custom event listener** (mounted once, cleanup on unmount):
```js
useEffect(() => {
  function onExportPrompt() { setShowExport(s => !s) }
  document.addEventListener('export-prompt', onExportPrompt)
  return () => document.removeEventListener('export-prompt', onExportPrompt)
}, [])
```

6. **Export toggle button in top row** — add alongside Regenerate and Reset:
```jsx
<button
  className="text-[11px] bg-transparent border-none cursor-pointer p-0 tracking-[0.01em] transition-colors duration-150"
  style={{ color: showExport ? 'rgba(100,180,255,0.85)' : 'rgba(255,255,255,0.2)' }}
  onClick={() => setShowExport(s => !s)}
>
  Export
</button>
```

7. **ExportPanel render** — between the last Divider and the button row:
```jsx
{showExport && (
  <ExportPanel
    prompt={generatedPrompt}
    transcript={originalTranscript}
    mode={mode}
    onExportDone={() => setShowExport(false)}
  />
)}
```

8. **↓ Export button in button row** — between Edit and Copy:
```jsx
<button
  onClick={() => setShowExport(true)}
  className="h-[44px] px-[16px] rounded-[10px] flex items-center gap-[6px] text-[12px] font-medium cursor-pointer"
  style={{
    border: '0.5px solid rgba(10,132,255,0.25)',
    background: 'rgba(10,132,255,0.08)',
    color: 'rgba(100,180,255,0.85)',
  }}
>
  ↓ Export
</button>
```

9. **Verify App.jsx** already passes `mode` prop to `PromptReadyState`. If not, add it in App.jsx.

**Acceptance criteria**:
- [ ] Export toggle button renders in top row alongside Regenerate and Reset
- [ ] Clicking Export toggles export panel (open when closed, close when open)
- [ ] ExportPanel renders when showExport=true with correct format tiles
- [ ] ↓ Export button in button row opens export panel (sets showExport=true)
- [ ] ⌘E dispatches export-prompt event → panel toggles
- [ ] Window height is 650px when panel open, 560px when closed
- [ ] `mode` prop is passed through correctly to ExportPanel
- [ ] onExportDone callback closes panel
- [ ] Panel state is independent of copy/edit state

**Self-verify**: Re-read FEATURE_SPEC.md#acceptance-criteria. Tick every item.
**Test requirement**: Manual smoke — exercise all interactions in running app
**⚠️ Boundaries**: Do NOT modify `onRegenerate` or `onReset` logic; do not touch edit/copy flow; useEffect cleanup for event listener
**CODEBASE.md update?**: Yes — update PromptReadyState entry in EXP-004
**Architecture compliance**: useEffect cleanup; resizeWindow via electronAPI; JSX text nodes; useState for UI state

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### EXP-004 · Docs: CODEBASE.md + DECISIONS.md
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#conformance-checklist
- **Dependencies**: EXP-003
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`

**What to do**:

1. **vibe/CODEBASE.md** — add/update:
   - File map: add `src/renderer/components/ExportPanel.jsx` row
   - Update `src/renderer/components/PromptReadyState.jsx` row to mention ExportPanel, showExport, mode prop
   - IPC channels table: add `save-file` row
   - Update preload.js `window.electronAPI` list to include `saveFile`

2. **vibe/DECISIONS.md** — append FEATURE-007 completion entry:
```
### FEATURE-007 — Export formats in PROMPT_READY state
- **Date**: 2026-04-19 · **Type**: scope-change (feature addition)
- **Trigger**: feature: command — user-initiated with full implementation spec
- **What was built**: ExportPanel.jsx (format picker — txt/md/json), save-file IPC (dialog.showSaveDialog + fs.writeFileSync), PromptReadyState integration (Export toggle, ExportPanel render, ↓ Export button, window resize, ⌘E via export-prompt custom event)
- **New IPC channels**: save-file (renderer → main)
- **New preload method**: saveFile
- **Files changed**: src/renderer/components/ExportPanel.jsx (new), src/renderer/components/PromptReadyState.jsx, main.js, preload.js
- **Status**: SHIPPED 2026-04-19
- **Approved by**: human
```

**Acceptance criteria**:
- [ ] CODEBASE.md file map includes ExportPanel.jsx
- [ ] CODEBASE.md IPC table includes save-file
- [ ] CODEBASE.md preload list includes saveFile
- [ ] DECISIONS.md has FEATURE-007 completion entry

**Self-verify**: Re-read CODEBASE.md IPC section. Confirm save-file appears.
**Test requirement**: None — doc-only task
**⚠️ Boundaries**: Append only — do not modify existing DECISIONS.md entries
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task
**Architecture compliance**: Append-only DECISIONS.md rule

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

## Feature Conformance Checklist: FEATURE-007 Export Formats

> Tick after every task. All items ✅ before feature is shippable.

- [ ] ExportPanel renders three format tiles; selected tile highlights in blue
- [ ] Clicking ↓ Export triggers macOS save dialog with correct defaultPath
- [ ] File written correctly in all three formats (txt, md, json)
- [ ] ⌘E opens/closes export panel when in PROMPT_READY
- [ ] Window expands to 650px when open, returns to 560px when closed
- [ ] Cancelled save: no error, panel stays open
- [ ] Successful save: panel auto-closes via onExportDone
- [ ] No new runtime npm dependencies
- [ ] `dialog` added to electron destructure in main.js
- [ ] Lint passes (npm run lint)
- [ ] CODEBASE.md updated for ExportPanel, save-file IPC, saveFile preload
- [ ] No regressions in Copy, Edit, Regenerate, Reset flows
