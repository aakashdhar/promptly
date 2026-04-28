# FEATURE_TASKS.md — History Empty State
> Feature folder: vibe/features/2026-04-28-history-empty-state/
> Added: 2026-04-28

> **Estimated effort:** 2 tasks — S: 2 (<2hrs each) — approx. 30 mins total

---

### HEMPTY-001 · Remove auto-selection in ExpandedView
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria (AC-001)
- **Dependencies**: None
- **Touches**: `src/renderer/components/ExpandedView.jsx`

**What to do**:

Line 39 in ExpandedView.jsx — change the `selected` useState initialiser from auto-selecting the first history entry to always starting as `null`:

```js
// Before
const [selected, setSelected] = useState(() => { const h = getHistory(); return h.length > 0 ? h[0] : null })

// After
const [selected, setSelected] = useState(null)
```

The `getHistory` import at the top of the file is used elsewhere — do NOT remove it.

**Acceptance criteria**:
- [ ] `useState(null)` — no lazy initialiser, no `getHistory()` call on mount
- [ ] `getHistory` import unchanged (still present, used by ExpandedHistoryList)

**Self-verify**: Re-read line 39 and the import block. Confirm `selected` starts as `null` and no import was removed.
**Test requirement**: Manual — launch app with history, confirm right panel shows empty state (not a history entry).
**⚠️ Boundaries**: Do NOT touch `handleSelect`, `handleEntryChange`, or the useEffect. One line change only.
**CODEBASE.md update?**: Yes — update ExpandedView.jsx row to remove mention of auto-selecting `h[0]`.
**Architecture compliance**: useState with null initial value — standard React pattern ✓.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### HEMPTY-002 · Add empty state in ExpandedDetailPanel
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria (AC-002, AC-003, AC-004, AC-007)
- **Dependencies**: HEMPTY-001
- **Touches**: `src/renderer/components/ExpandedDetailPanel.jsx`

**What to do**:

In ExpandedDetailPanel.jsx, find the outer return div (the one with `flex: 1, minWidth: 0`). Inside it, add the empty state block as the FIRST child, before the `{showEntryDetail && (...)}` block:

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

The clock SVG (circle + hands) is consistent with the history concept. Opacity 0.35 on the container dims both icon and text together.

**Acceptance criteria**:
- [ ] Empty state block present and renders when `currentState === 'IDLE'` and `!selected`
- [ ] Empty state does NOT render when `selected` is non-null (entry shows instead)
- [ ] Empty state does NOT render during active states (RECORDING, THINKING, etc.)
- [ ] Icon is inline SVG clock face (circle + path hands)
- [ ] Text: "Select a history to view details", fontSize 13px
- [ ] Container opacity: 0.35
- [ ] Layout: column flex, centered both axes

**Self-verify**: Re-read ExpandedDetailPanel fully — confirm `showEntryDetail` block is unchanged and the new block is correctly conditional.
**Test requirement**: Manual — launch app, confirm empty state shows; click entry, confirm detail shows; start recording, confirm recording content shows (not empty state).
**⚠️ Boundaries**: Do NOT modify the `showEntryDetail` logic or any existing block. Additive only.
**CODEBASE.md update?**: Yes — update ExpandedDetailPanel.jsx row to note empty state.
**Architecture compliance**: Inline styles for conditional rendering ✓. JSX text node (not innerHTML) ✓.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: History Empty State
> Tick after every task. All items ✅ before feature is shippable.
- [x] AC-001: `selected` initialises to `null` in ExpandedView
- [x] AC-002: Empty state visible when IDLE + no selection
- [x] AC-003: Icon + text centered, ~35% opacity
- [x] AC-004: Inline SVG icon (clock)
- [ ] AC-005: Clicking history entry populates right panel — no regression (manual)
- [ ] AC-006: Mid-session selection persists on IDLE re-entry (manual)
- [x] AC-007: Empty state absent during all active states
- [x] `npm run lint` → 0 errors
- [x] CODEBASE.md updated
