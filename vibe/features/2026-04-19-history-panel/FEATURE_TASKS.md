# FEATURE_TASKS.md — FEATURE-009: History Panel (Split View)
> Folder: vibe/features/2026-04-19-history-panel/
> Created: 2026-04-19

> **Estimated effort:** 5 tasks — S: 3, M: 2 — approx. 7–9 hours total

---

### HIST-001 · history.js utility
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#new-data
- **Dependencies**: None
- **Touches**: `src/renderer/utils/history.js` (new file)

**What to do**:

Create `src/renderer/utils/` directory and write `history.js`.

⚠️ Signature note: App.jsx currently has an inline `saveToHistory(transcript, prompt, mode)` with
positional args. The new utility uses `saveToHistory({ transcript, prompt, mode })` (object arg).
HIST-003 updates all call sites — do not export a positionally-compatible version.

```js
const HISTORY_KEY = 'promptly_history'
const MAX_ENTRIES = 100

export function saveToHistory({ transcript, prompt, mode }) {
  const history = getHistory()
  const words = transcript.split(' ')
  const title = words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '')
  history.unshift({ id: Date.now(), title, transcript, prompt, mode, timestamp: new Date().toISOString() })
  if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
}

export function deleteHistoryItem(id) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(getHistory().filter(h => h.id !== id)))
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

export function searchHistory(query) {
  if (!query.trim()) return getHistory()
  const q = query.toLowerCase()
  return getHistory().filter(h =>
    h.transcript.toLowerCase().includes(q) ||
    h.prompt.toLowerCase().includes(q) ||
    h.mode.toLowerCase().includes(q)
  )
}

export function formatTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}
```

**Acceptance criteria**:
- [ ] File exists at `src/renderer/utils/history.js`
- [ ] All 6 functions exported: saveToHistory, getHistory, deleteHistoryItem, clearHistory, searchHistory, formatTime
- [ ] `getHistory()` catches JSON parse errors, returns `[]`
- [ ] `saveToHistory()` generates `title` from first 5 words + "..." if longer
- [ ] `saveToHistory()` caps at 100 entries
- [ ] `searchHistory('')` returns full list (no filter on empty query)
- [ ] No direct localStorage.* calls elsewhere after App.jsx is updated in HIST-003

**Self-verify**: Open DevTools console → `import` doesn't work in renderer directly, but after HIST-003 wires it in, generate a prompt and check Application → localStorage → promptly_history has a `title` field.
**Test requirement**: Lint passes on this file.
**⚠️ Boundaries**: No IPC, no React imports. Pure JS module only.
**CODEBASE.md update?**: No — wait for HIST-005.
**Architecture compliance**: localStorage only via these wrapper functions (ARCHITECTURE.md §State management).

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HIST-002 · HistoryPanel.jsx component
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria
- **Dependencies**: HIST-001
- **Touches**: `src/renderer/components/HistoryPanel.jsx` (new file)

**What to do**:

Create `src/renderer/components/HistoryPanel.jsx`. Props:
- `onClose` — called by Done button (App.jsx will handle resizeWindowWidth + transition)
- `onReuse(entry)` — called by Reuse button (App.jsx will handle resizeWindowWidth + transition)

The component manages its own local state: `entries`, `selected`, `searchOpen`, `query`, `copied`.

Key implementation points:

1. **Mount effect** — load history, set entries + auto-select first:
```jsx
useEffect(() => {
  const h = getHistory()
  setEntries(h)
  if (h.length > 0) setSelected(h[0])
}, [])
```

2. **Per-entry delete** — ✕ button on each row:
```jsx
function handleDelete(id, e) {
  e.stopPropagation()
  deleteHistoryItem(id)
  const updated = getHistory()
  setEntries(updated)
  if (selected?.id === id) setSelected(updated[0] || null)
}
```

3. **Search** — inline input replaces list header label:
```jsx
function handleSearch(e) {
  setQuery(e.target.value)
  setEntries(searchHistory(e.target.value))
}
function handleClearSearch() {
  setQuery('')
  setSearchOpen(false)
  setEntries(getHistory())
}
```

4. **Prompt section rendering** — parse structured prompt lines:
```jsx
function renderPromptSections(prompt) {
  const lines = prompt.split('\n')
  return lines.filter(l => l.trim()).map((line, i) => {
    const isLabel = /^[A-Z][A-Z\s]+:$/.test(line.trim()) || /^[A-Z][A-Z\s]+ BRIEF:$/.test(line.trim())
    if (isLabel) {
      return <div key={i} style={{ fontSize:'8.5px', fontWeight:700, letterSpacing:'.12em',
        textTransform:'uppercase', color:'rgba(100,170,255,0.42)',
        marginBottom:'5px', marginTop: i > 0 ? '14px' : 0 }}>
        {line.trim().replace(':','')}
      </div>
    }
    return <div key={i} style={{ fontSize:'12.5px', color:'rgba(255,255,255,0.78)', lineHeight:1.75, marginBottom:'4px' }}>
      {line.trim()}
    </div>
  })
}
```

5. **Layout** — flex row: left 220px list + right flex-1 detail. Bottom bar: "Clear all" + "Done".

6. **Entry count** — bottom of left panel: `{query ? `${entries.length} of ${getHistory().length}` : entries.length} prompt(s)`

7. **Copy** — `navigator.clipboard.writeText(selected.prompt)`, set copied true, reset after 1800ms.

Full styling follows the dark glass aesthetic (rgba whites, blue accents for selection). Use only inline styles — no new Tailwind classes for this component (component uses inline styles per the provided spec).

**Acceptance criteria**:
- [ ] Component renders split layout: 220px left + flex-1 right
- [ ] First entry auto-selected on mount
- [ ] Entry rows: title (ellipsis overflow), mode pill, relative timestamp
- [ ] ✕ delete button per entry (stopPropagation so click doesn't select entry)
- [ ] Deleted entry removed from list; if it was selected, next entry selected (or null)
- [ ] Active entry: blue left border + blue-tinted background
- [ ] Search icon → inline input with autoFocus; filters in real time
- [ ] ✕ on search clears and closes search
- [ ] "No results" when search returns empty
- [ ] Right panel: "You said" + transcript, then structured prompt with rendered section labels
- [ ] "Copy prompt" flashes green 1.8s
- [ ] "Reuse" button calls onReuse(selected)
- [ ] "Done" calls onClose()
- [ ] "Clear all" empties localStorage + clears list + nulls selection
- [ ] Empty history: human message in list, "Select a prompt to view" on right
- [ ] No dangerouslySetInnerHTML
- [ ] All localStorage access via imported utils/history functions

**Self-verify**: Re-read FEATURE_SPEC.md acceptance criteria. Tick each item.
**Test requirement**: Lint passes. Manual smoke via HIST-003 wiring.
**⚠️ Boundaries**: No new IPC calls. No localStorage direct access. onClose/onReuse handled by App.jsx — this component only calls the callbacks.
**CODEBASE.md update?**: No — wait for HIST-005.
**Architecture compliance**: JSX text nodes only; useEffect cleanup not needed (no RAF/timers); localStorage via utils.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HIST-003 · App.jsx wiring
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#integration-points
- **Dependencies**: HIST-001, HIST-002
- **Touches**: `src/renderer/App.jsx`

**What to do**:

1. **Import** at top of App.jsx:
```js
import HistoryPanel from './components/HistoryPanel.jsx'
import { saveToHistory } from './utils/history.js'
```
Remove the inline `saveToHistory` function (lines 29–40).

2. **Add HISTORY to STATES and STATE_HEIGHTS**:
```js
const STATES = {
  IDLE: 'IDLE', RECORDING: 'RECORDING', THINKING: 'THINKING',
  PROMPT_READY: 'PROMPT_READY', ERROR: 'ERROR', SHORTCUTS: 'SHORTCUTS',
  HISTORY: 'HISTORY',
}
const STATE_HEIGHTS = {
  IDLE: 118, RECORDING: 89, THINKING: 320, PROMPT_READY: 560,
  ERROR: 101, SHORTCUTS: 380, HISTORY: 420,
}
```

3. **Update saveToHistory calls** — App.jsx currently calls `saveToHistory(text, genResult.prompt, mode)`.
   The new signature is `saveToHistory({ transcript, prompt, mode })`. Update both calls (in stopRecording onstop and in handleRegenerate).

4. **Add HISTORY entry/exit helpers** inside the component:
```js
function openHistory() {
  prevStateRef.current = stateRef.current
  if (window.electronAPI) window.electronAPI.resizeWindowWidth(680)
  transition(STATES.HISTORY)
}
function closeHistory() {
  if (window.electronAPI) window.electronAPI.resizeWindowWidth(520)
  transition(prevStateRef.current || STATES.IDLE)
}
```

5. **Add ⌘H to keydown handler** (in the existing handleKeyDown function):
```js
if (meta && e.key === 'h' &&
    stateRef.current !== STATES.RECORDING &&
    stateRef.current !== STATES.HISTORY) {
  e.preventDefault()
  openHistory()
  return
}
```
The HISTORY guard prevents ⌘H while already in HISTORY from re-calling openHistory(),
which would overwrite prevStateRef with HISTORY and break Done/Escape return navigation.
```

6. **Add Escape case for HISTORY** — in the existing Escape block:
```js
} else if (stateRef.current === STATES.HISTORY) {
  closeHistory()
```
Place this before the generic `else if (stateRef.current !== STATES.IDLE)` catch-all.

7. **Wire onShowHistory IPC** — in the existing IPC useEffect:
```js
window.electronAPI.onShowHistory(() => {
  openHistory()
})
```

8. **Render HistoryPanel** — in the JSX return:
```jsx
{currentState === STATES.HISTORY && (
  <>
    <div className="h-[28px] w-full" style={{WebkitAppRegion:'drag'}} />
    <HistoryPanel
      onClose={closeHistory}
      onReuse={(entry) => {
        originalTranscript.current = entry.transcript
        setGeneratedPrompt(entry.prompt)
        if (window.electronAPI) window.electronAPI.resizeWindowWidth(520)
        transition(STATES.PROMPT_READY)
      }}
    />
  </>
)}
```

**Acceptance criteria**:
- [ ] HISTORY in STATES and STATE_HEIGHTS (420px)
- [ ] Inline saveToHistory removed; imported from utils/history.js
- [ ] Both saveToHistory calls updated to new `{ transcript, prompt, mode }` signature
- [ ] ⌘H opens history from IDLE, PROMPT_READY, SHORTCUTS (any non-RECORDING state)
- [ ] Escape from HISTORY → prevState + resizeWindowWidth(520)
- [ ] onShowHistory IPC listener opens history
- [ ] HistoryPanel rendered with correct onClose and onReuse callbacks
- [ ] onReuse: sets originalTranscript.current + generatedPrompt + resizes + PROMPT_READY
- [ ] openHistory() captures prevState before transitioning
- [ ] `npm run build:renderer` succeeds

**Self-verify**: `npm run build:renderer` passes. Then test manually.
**Test requirement**: Build must succeed. Manual smoke test items 1–13 in FEATURE_PLAN.md.
**⚠️ Boundaries**: Only touches App.jsx. Do not modify other components.
**CODEBASE.md update?**: No — wait for HIST-005.
**Architecture compliance**: Follows prevStateRef pattern established by SHORTCUTS (FCR-002). resizeWindowWidth called before transition() to avoid race.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HIST-004 · main.js + preload.js
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#new-ipc-channel-resize-window-width
- **Dependencies**: None (can run in parallel with HIST-001)
- **Touches**: `main.js`, `preload.js`

**What to do**:

**main.js — fix resize-window handler first** (critical — P0-001):
The existing `resize-window` handler hardcodes `520` as width:
```js
win.setSize(520, height, true)  // ← hardcoded width breaks HISTORY
```
Change it to use the current window width so resize-window becomes height-only:
```js
const [currentWidth] = win.getSize()
win.setSize(currentWidth, height, true)
```
This ensures `resizeWindowWidth(680)` called in `openHistory()` is not immediately
overwritten when `transition(STATES.HISTORY)` triggers `resizeWindow(420)`.

**main.js — add resize-window-width handler** (after the existing `resize-window` handler):
```js
ipcMain.handle('resize-window-width', (_event, { width }) => {
  if (win) {
    win.setResizable(true)
    const [, h] = win.getSize()
    win.setSize(width, h, true)
    win.setResizable(false)
  }
  return { ok: true }
})
```

**main.js — add "History ⌘H" to show-mode-menu context menu** (after the "Keyboard shortcuts ⌘?" item):
```js
{ type: 'separator' },
{
  label: 'History ⌘H',
  click: () => { win.webContents.send('show-history') },
},
```

**preload.js — add to contextBridge.exposeInMainWorld**:
```js
resizeWindowWidth: (width) =>
  ipcRenderer.invoke('resize-window-width', { width }),

onShowHistory: (callback) =>
  ipcRenderer.on('show-history', () => callback()),
```

**Acceptance criteria**:
- [ ] `resize-window` handler updated — uses `win.getSize()[0]` for width, not hardcoded 520
- [ ] `resize-window-width` handler exists in main.js — uses setResizable(true/false) pattern
- [ ] Handler reads current height via `win.getSize()` before calling setSize
- [ ] "History ⌘H" item in context menu (below separator after "Keyboard shortcuts ⌘?")
- [ ] Clicking "History ⌘H" sends `show-history` to renderer
- [ ] `resizeWindowWidth(w)` exposed in preload.js
- [ ] `onShowHistory(cb)` exposed in preload.js
- [ ] `npm run lint` passes on main.js and preload.js

**Self-verify**: `npm run lint` → 0 errors. Right-click the bar → "History ⌘H" visible.
**Test requirement**: Lint must pass.
**⚠️ Boundaries**: Do not touch any other IPC handlers. Do not change window minWidth/maxWidth in createWindow — setResizable(true) before setSize works around those constraints.
**CODEBASE.md update?**: No — wait for HIST-005.
**Architecture compliance**: Follows existing resize-window pattern. contextBridge pattern for preload.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HIST-005 · CODEBASE.md update
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#conformance-checklist
- **Dependencies**: HIST-001, HIST-002, HIST-003, HIST-004
- **Touches**: `vibe/CODEBASE.md`

**What to do**:

Update the following sections:

1. **File map** — add two rows:
   - `src/renderer/utils/history.js` — `saveToHistory, getHistory, deleteHistoryItem, clearHistory, searchHistory, formatTime`
   - `src/renderer/components/HistoryPanel.jsx` — split-panel history UI; props: onClose, onReuse

2. **IPC channels table** — add two rows:
   - `resize-window-width` | renderer → main | ✅ registered — win.setSize(width, h, true) with setResizable guards
   - `show-history` | main → renderer | ✅ registered — sent by "History ⌘H" context menu item

3. **State machine table** — add HISTORY row:
   - `HISTORY` | HistoryPanel | 420px | Split-panel history; window width 680px; prevStateRef used for exit

4. **Preload** — add resizeWindowWidth and onShowHistory to the `window.electronAPI` list in the preload.js file map row.

5. **localStorage keys** — update `promptly_history` row: add note that entries now include `title` field (first 5 words of transcript).

6. **React state + refs** — add note: `prevStateRef` used for HISTORY exit (same pattern as SHORTCUTS).

7. **Last updated** line: update to 2026-04-19.

**Acceptance criteria**:
- [ ] File map has history.js and HistoryPanel.jsx rows
- [ ] IPC table has resize-window-width and show-history rows
- [ ] State machine table has HISTORY row with correct height and notes
- [ ] Preload row updated with new methods
- [ ] localStorage key row updated with title field note
- [ ] "Last updated" updated to 2026-04-19

**Self-verify**: Re-read CODEBASE.md — no missing entries from this feature.
**⚠️ Boundaries**: CODEBASE.md only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-009 History Panel
> Tick after every task. All items ✅ before feature is shippable.
- [ ] ⌘H opens HISTORY from any non-RECORDING state
- [ ] Context menu "History ⌘H" also opens HISTORY
- [ ] Window width 680px on entry, 520px on all exit paths (Done, Reuse, Escape)
- [ ] Left panel list: title, mode pill, timestamp, ✕ delete per entry
- [ ] Per-entry delete removes from localStorage + re-renders; next entry selected if deleted was active
- [ ] Active entry: blue left border + blue-tinted background
- [ ] First entry auto-selected on open
- [ ] Right panel: "You said" transcript + structured prompt with section labels
- [ ] Inline search: filters by transcript/prompt/mode in real time
- [ ] Search ✕ clears and restores full list
- [ ] "No results" when search empty
- [ ] Copy prompt: green flash 1.8s + clipboard write
- [ ] Reuse: originalTranscript + generatedPrompt set → PROMPT_READY → 520px width
- [ ] Clear all: localStorage cleared + empty state shown
- [ ] Done: prevState + 520px width
- [ ] Escape: prevState + 520px width
- [ ] Empty history: human messages in both panels
- [ ] No dangerouslySetInnerHTML
- [ ] No direct localStorage.* outside utils/history.js
- [ ] `npm run lint` clean (0 errors)
- [ ] `npm run build:renderer` succeeds
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md entry for resize-window-width new IPC channel
