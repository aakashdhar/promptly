# FEATURE_PLAN.md — FEATURE-007: Export Formats

> Feature folder: vibe/features/2026-04-19-export-formats/
> Added: 2026-04-19

---

## 1. Impact map

### New files
| File | Purpose |
|------|---------|
| `src/renderer/components/ExportPanel.jsx` | Format picker panel — FORMATS constant, tile grid, formatContent(), handleExport() |

### Modified files
| File | What changes |
|------|-------------|
| `src/renderer/components/PromptReadyState.jsx` | Add showExport state, Export toggle button in top row, ExportPanel render, ↓ Export button in button row, useEffect for resize, export-prompt event listener |
| `main.js` | Add `save-file` ipcMain.handle with dialog.showSaveDialog + fs.writeFileSync |
| `preload.js` | Add `saveFile` method to contextBridge |

### Doc files
| File | What changes |
|------|-------------|
| `vibe/CODEBASE.md` | Add ExportPanel to file map, add save-file to IPC table, add saveFile to preload methods |
| `vibe/DECISIONS.md` | FEATURE-007 start entry + completion entry |

---

## 2. Files explicitly out of scope

- `src/renderer/App.jsx` — ⌘E dispatch already wired (dispatches `export-prompt` custom event); no change needed
- `src/renderer/hooks/useMode.js` — no change
- `src/renderer/hooks/useWindowResize.js` — no change
- `src/renderer/components/IdleState.jsx` — no change
- `src/renderer/components/RecordingState.jsx` — no change
- `src/renderer/components/ThinkingState.jsx` — no change
- `src/renderer/components/ErrorState.jsx` — no change
- `src/renderer/components/ShortcutsPanel.jsx` — no change
- `splash.html` — no change
- `entitlements.plist` — no change

---

## 3. Backend changes (main.js)

Add `save-file` ipcMain.handle inside the `app.whenReady()` block:

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

`dialog` must be added to the destructured require at the top of main.js.
`fs` is already required.

---

## 4. Preload changes (preload.js)

Add inside `contextBridge.exposeInMainWorld('electronAPI', { ... })`:

```js
saveFile: (opts) => ipcRenderer.invoke('save-file', opts),
```

---

## 5. Frontend changes

### ExportPanel.jsx (new)

```
src/renderer/components/ExportPanel.jsx
```

- FORMATS array: `[{ id, label, ext, icon }]` for txt / md / json
- `selected` useState — default `'txt'`
- `exporting` useState — controls button disabled state
- `formatContent(format, prompt, transcript, mode)` — pure function, returns string
- `handleExport()` — calls `window.electronAPI.saveFile`, then `onExportDone()`
- Grid of 3 format tiles — selected tile: blue border + blue bg; unselected: white/4 bg
- No ↓ Export button here — that lives in PromptReadyState's button row

### PromptReadyState.jsx (modified)

**New state:** `const [showExport, setShowExport] = useState(false)`

**Export ref (for ⌘E custom event):**
```js
const showExportRef = useRef(false)
// keep in sync
useEffect(() => { showExportRef.current = showExport }, [showExport])
```

**Export-prompt custom event listener (useEffect, mounted once):**
```js
useEffect(() => {
  function onExportPrompt() { setShowExport(s => !s) }
  document.addEventListener('export-prompt', onExportPrompt)
  return () => document.removeEventListener('export-prompt', onExportPrompt)
}, [])
```

**Window resize effect:**
```js
useEffect(() => {
  if (window.electronAPI) {
    window.electronAPI.resizeWindow(showExport ? 650 : 560)
  }
}, [showExport])
```
> Note: closed height = 560 (current STATE_HEIGHTS.PROMPT_READY). Open = 560 + 90 = 650.

**Export toggle button in top row** (alongside Regenerate and Reset):
```jsx
<button onClick={() => setShowExport(s => !s)}
  className="text-[11px] cursor-pointer bg-transparent border-none p-0 tracking-[0.01em] transition-colors duration-150"
  style={{ color: showExport ? 'rgba(100,180,255,0.85)' : 'rgba(255,255,255,0.2)' }}>
  Export
</button>
```

**ExportPanel render** (above button row, between Divider and button row):
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

**↓ Export button in button row** (between Edit and Copy buttons):
```jsx
<button
  onClick={() => { /* open panel if not open, or trigger save directly */ setShowExport(true) }}
  className="h-[44px] px-[16px] rounded-[10px] flex items-center gap-[6px] text-[12px] font-medium cursor-pointer"
  style={{
    border: '0.5px solid rgba(10,132,255,0.25)',
    background: 'rgba(10,132,255,0.08)',
    color: 'rgba(100,180,255,0.85)',
  }}>
  ↓ Export
</button>
```

**Reset showExport on unmount / when component transitions away:**
Add `showExport` reset to `onReset` and `onRegenerate` — actually `PromptReadyState` unmounts on state change so useState resets automatically. No explicit reset needed.

---

## 6. Conventions to follow (from ARCHITECTURE.md + CODEBASE.md)

- `transition()` / `resizeWindow()` for state changes — do not call `setState` directly
- `textContent` equivalent in React = JSX text nodes — no `dangerouslySetInnerHTML`
- IPC via `window.electronAPI.*` — never `ipcRenderer` directly
- useEffect cleanup for event listeners
- `useRef` for values needed in callbacks without re-registering listeners
- New IPC channel `save-file` must be added to CODEBASE.md IPC table
- `dialog` must be added to main.js destructured electron require

---

## 7. Task breakdown

| ID | Title | Size | Dep |
|----|-------|------|-----|
| EXP-001 | ExportPanel.jsx — new component | S | None |
| EXP-002 | save-file IPC handler (main.js + preload.js) | S | None |
| EXP-003 | PromptReadyState.jsx integration | M | EXP-001, EXP-002 |
| EXP-004 | Docs: CODEBASE.md + DECISIONS.md | S | EXP-003 |

EXP-001 and EXP-002 can run in parallel.

---

## 8. Rollback plan

- Delete `src/renderer/components/ExportPanel.jsx`
- Revert `src/renderer/components/PromptReadyState.jsx` to previous state
- Remove `save-file` ipcMain.handle from `main.js`
- Remove `saveFile` from `preload.js`
- `dialog` may stay in main.js destructure (not harmful)

---

## 9. Testing strategy

Manual smoke test per ARCHITECTURE.md testing philosophy:
- Export panel toggle (open/close via button + ⌘E)
- All three format tiles selectable
- Save dialog opens with correct defaultPath
- Cancel → no error
- Successful save → file exists with correct content in all three formats
- Window height expands/contracts correctly
