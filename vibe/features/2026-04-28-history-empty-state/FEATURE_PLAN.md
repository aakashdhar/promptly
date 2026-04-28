# FEATURE_PLAN.md — History Empty State
> Feature folder: vibe/features/2026-04-28-history-empty-state/
> Added: 2026-04-28

---

## 1. Impact map

### Files to modify

| File | What changes |
|------|-------------|
| `src/renderer/components/ExpandedView.jsx` | Change initial `selected` useState from `h[0]` to `null` |
| `src/renderer/components/ExpandedDetailPanel.jsx` | Add empty state block for IDLE + no selection |

### New files

None.

---

## 2. Files explicitly out of scope

All files not listed above. Specifically:
- `src/renderer/App.jsx` — no state changes
- `src/renderer/components/ExpandedHistoryList.jsx` — no changes
- `src/renderer/components/ExpandedTransportBar.jsx` — no changes
- All hooks, main.js, preload.js, index.css

---

## 3. No DB / storage changes.

---

## 4. Detailed changes per file

### `src/renderer/components/ExpandedView.jsx`

Line 39 — change initial state:
```js
// Before
const [selected, setSelected] = useState(() => { const h = getHistory(); return h.length > 0 ? h[0] : null })

// After
const [selected, setSelected] = useState(null)
```

The `getHistory()` call on init was the only reason the import was needed here for initialisation — it is still used indirectly via `handleSelect`, so the import stays.

### `src/renderer/components/ExpandedDetailPanel.jsx`

After the `showEntryDetail` const (line 78), add an empty state block. The right place in the JSX is inside the outer div, as a sibling to the existing `{showEntryDetail && (...)}` block and the per-state content blocks.

Add this block:
```jsx
{currentState === 'IDLE' && !selected && (
  <div style={{
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: '12px',
    opacity: 0.35,
  }}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2"/>
      <path d="M12 7v5l3 3" stroke="rgba(255,255,255,0.8)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
      Select a history to view details
    </span>
  </div>
)}
```

Icon: clock face (circle + hands) — universally understood as "history".

---

## 5. Conventions to follow

From `vibe/ARCHITECTURE.md`:
- Inline styles for dynamic/stateful values ✓ (empty state visibility is conditional on state + selected)
- Functional React components, one per file ✓
- No `innerHTML` with user content ✓ — text via JSX text node
- `WebkitAppRegion: 'no-drag'` not needed — no clickable element in empty state

---

## 6. Task breakdown

| ID | Title | Size | Dependencies |
|----|-------|------|-------------|
| HEMPTY-001 | Remove auto-selection in ExpandedView | S | None |
| HEMPTY-002 | Add empty state JSX in ExpandedDetailPanel | S | HEMPTY-001 |

---

## 7. Rollback plan

Both changes are minimal and additive:
- HEMPTY-001: revert one line in ExpandedView.jsx
- HEMPTY-002: remove the empty state block from ExpandedDetailPanel.jsx

---

## 8. Testing strategy

Manual smoke test:
- Launch app with history present → confirm right panel shows empty state, not latest entry
- Click a history entry → confirm detail appears
- Start recording → confirm empty state does not appear (active state content shows)
- Complete recording → return to IDLE → confirm selected entry still shows (AC-006)
- Launch with no history → confirm empty state shows (no crash)

No new automated tests needed — pure UI, no business logic.

---

## 9. CODEBASE.md sections to update

- `ExpandedView.jsx` row: remove mention of auto-selecting `h[0]`
- `ExpandedDetailPanel.jsx` row: note empty state for IDLE + no selection
