# FEATURE_PLAN.md — FEATURE-009: History Panel (Split View)
> Folder: vibe/features/2026-04-19-history-panel/
> Created: 2026-04-19

---

## Impact map

### New files
| File | Purpose |
|------|---------|
| `src/renderer/utils/history.js` | All localStorage history operations — extracted from App.jsx + extended |
| `src/renderer/components/HistoryPanel.jsx` | Split-panel history UI component |

### Modified files
| File | Changes |
|------|---------|
| `src/renderer/App.jsx` | Add HISTORY to STATES/STATE_HEIGHTS; import HistoryPanel; ⌘H keydown; onShowHistory IPC; switch saveToHistory import; add prevStateRef usage for HISTORY exit |
| `main.js` | Add resize-window-width ipcMain.handle; add "History ⌘H" item to show-mode-menu context menu; send show-history event from that item |
| `preload.js` | Add resizeWindowWidth(w) and onShowHistory(cb) to contextBridge |

### Files explicitly out of scope (do not touch)
- `src/renderer/components/PromptReadyState.jsx` — no changes needed
- `src/renderer/components/IdleState.jsx` — no history button in IDLE (⌘H shortcut is sufficient)
- `src/renderer/hooks/` — no new hooks needed
- `splash.html`, `entitlements.plist`, `vite.config.js`

---

## Conventions to follow (from CODEBASE.md + ARCHITECTURE.md)

```jsx
// State transitions — always via transition()
transition(STATES.HISTORY)

// Window width — new IPC
window.electronAPI.resizeWindowWidth(680)

// localStorage — only via utils/history.js functions
import { saveToHistory, getHistory } from '../utils/history'

// Dynamic text — JSX text nodes only
<div>{entry.title}</div>   // ✅
// dangerouslySetInnerHTML  // ❌ never

// IPC listeners — register in useEffect with [] dep array
useEffect(() => {
  if (!window.electronAPI) return
  window.electronAPI.onShowHistory(() => { ... })
}, [])

// prevStateRef pattern (already used for SHORTCUTS)
prevStateRef.current = stateRef.current
transition(STATES.HISTORY)
```

---

## Task breakdown

### Layer 1 — Utility (no UI dependencies)
- **HIST-001** — `src/renderer/utils/history.js`

### Layer 2 — Component (depends on utility)
- **HIST-002** — `src/renderer/components/HistoryPanel.jsx`

### Layer 3 — App wiring (depends on both)
- **HIST-003** — `src/renderer/App.jsx` changes
- **HIST-004** — `main.js` + `preload.js` changes

### Layer 4 — Docs
- **HIST-005** — `vibe/CODEBASE.md` update

---

## Rollback plan

All changes are additive:
- Delete `src/renderer/utils/history.js` and `src/renderer/components/HistoryPanel.jsx`
- Revert App.jsx: remove HISTORY from STATES/STATE_HEIGHTS, remove import, remove ⌘H handler, remove onShowHistory, restore inline saveToHistory function
- Revert main.js: remove resize-window-width handler + "History ⌘H" menu item
- Revert preload.js: remove resizeWindowWidth + onShowHistory

No DB migration or destructive schema changes involved.

---

## Testing strategy

Manual smoke checklist (from FEATURE_SPEC.md conformance):
1. ⌘H opens history from IDLE, PROMPT_READY, SHORTCUTS
2. Window is 680px wide, 420px tall
3. First entry auto-selected, right panel populated
4. Click entry → selection changes
5. ✕ on entry → removed from list, next selected
6. Search → filters live
7. Search ✕ → full list restored
8. Copy → green flash, clipboard contains prompt
9. Reuse → PROMPT_READY with entry's transcript + prompt
10. Clear all → empty state
11. Done → prevState, window 520px
12. Escape → prevState, window 520px
13. Context menu "History ⌘H" → opens HISTORY
14. Lint: npm run lint → 0 errors

---

## CODEBASE.md sections to update (HIST-005)

- File map: add `utils/history.js` and `HistoryPanel.jsx`
- IPC channels table: add `resize-window-width` and `show-history`
- State machine table: add HISTORY row (420px)
- localStorage keys: add `promptly_history` (title field note)
- React state + refs: note prevStateRef used for HISTORY (same as SHORTCUTS)
- Preload: add resizeWindowWidth + onShowHistory to the exposed methods list
