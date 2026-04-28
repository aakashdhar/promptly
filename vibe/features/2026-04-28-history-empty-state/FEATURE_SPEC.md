# FEATURE_SPEC.md — History Empty State
> Feature folder: vibe/features/2026-04-28-history-empty-state/
> Added: 2026-04-28

---

## 1. Feature overview

When the app opens in expanded view, no history entry is selected by default. The right panel shows a centered empty state — an SVG icon above the text "Select a history to view details" — instead of auto-displaying the most recent entry. This gives the user a clear prompt to interact with the history list rather than showing stale content they didn't ask for.

---

## 2. User story

As a user opening Promptly in expanded view, I see a clean right panel that invites me to pick a history entry rather than auto-loading a previous result I didn't choose.

---

## 3. Acceptance criteria

- **AC-001** On app launch, `selected` in ExpandedView is `null` — no history entry is pre-selected
- **AC-002** When `currentState === 'IDLE'` and `selected === null`, the right panel shows the empty state (icon + text)
- **AC-003** Empty state layout: icon + text vertically and horizontally centered in the panel; both at ~35% opacity
- **AC-004** Icon is an inline SVG (history/clock or list), consistent with the existing inline SVG style used throughout the app
- **AC-005** Clicking a history entry in the left panel still populates the right panel as before — no regression
- **AC-006** Once a user selects an entry mid-session and returns to IDLE, the selected entry continues to show (empty state does not re-appear mid-session)
- **AC-007** Empty state does NOT appear during active states (RECORDING, THINKING, PROMPT_READY, etc.) — those states display their own right-panel content unchanged

---

## 4. Scope boundaries

**Included:**
- Initial `selected = null` in ExpandedView
- Empty state JSX block in ExpandedDetailPanel for IDLE + no selection

**Explicitly out of scope:**
- Persisting "no selection" across app restarts
- Any change to the left-panel history list behavior
- Any new IPC channels or data model changes

---

## 5. Integration points

| File | What changes |
|------|-------------|
| `src/renderer/components/ExpandedView.jsx` | Line 39: change `useState(() => { const h = getHistory(); return h.length > 0 ? h[0] : null })` → `useState(null)` |
| `src/renderer/components/ExpandedDetailPanel.jsx` | Line 78 area: add empty state block rendered when `currentState === 'IDLE' && selected === null` |

---

## 6. UI note

Empty state centred in the right panel:
```
        [SVG icon ~24px, opacity 0.35]
   Select a history to view details
         [fontSize 13px, opacity 0.35]
```
Uses inline styles. No new CSS classes or tokens needed.

---

## 7. No data model changes. No new API endpoints.

---

## 8. Edge cases

- **No history at all**: `selected` is already null when history is empty — empty state shows correctly, no change needed
- **History exists but none selected**: same — empty state shows until user clicks an entry
- **Active state during IDLE re-entry**: useEffect in ExpandedView resets `isViewingHistory` but does NOT reset `selected` on active→IDLE transitions — so mid-session selected entry is preserved (AC-006)

---

## 9. Non-functional requirements

- No performance impact — null check is O(1)
- No accessibility changes needed beyond what's already present

---

## 10. Conformance checklist

- [ ] AC-001: `selected` initialises to `null` in ExpandedView
- [ ] AC-002: Empty state visible when IDLE + no selection
- [ ] AC-003: Icon + text centered, ~35% opacity
- [ ] AC-004: Inline SVG icon
- [ ] AC-005: Clicking history entry populates right panel (no regression)
- [ ] AC-006: Mid-session selection persists on IDLE re-entry
- [ ] AC-007: Empty state absent during all active states
- [ ] `npm run lint` → 0 errors
