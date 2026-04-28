# FEATURE_TASKS.md — Abort / Reset Button
> Feature folder: vibe/features/2026-04-28-abort-reset/
> Added: 2026-04-28

> **Estimated effort:** 5 tasks — S: 4 (<2hrs each), M: 1 (2-4hrs) — approx. 4–5 hours total

---

### ABORT-001 · abortRef + handleGenerateResult guard
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria (AC-013, AC-014)
- **Dependencies**: None
- **Touches**: `src/renderer/App.jsx`

**What to do**:
1. Add `const abortRef = useRef(false)` directly below the other `useRef` declarations near the top of App.jsx (around line 80–85, where `transitionRef`, `handleGenerateResultRef` etc. live).
2. In `handleGenerateResult` (the `useCallback` around line 246), add this as the VERY FIRST line of the callback body:
   ```js
   if (abortRef.current) { abortRef.current = false; return }
   ```
   This must come before any mode checks so that any abort — regardless of mode — kills the result.

That's the entire task. No other changes.

**Acceptance criteria**:
- [ ] `abortRef = useRef(false)` present in App.jsx near other refs
- [ ] First line of `handleGenerateResult` callback: `if (abortRef.current) { abortRef.current = false; return }`
- [ ] No other logic changed

**Self-verify**: Read `handleGenerateResult` in full — confirm the guard is the first statement and no existing logic was moved or removed.
**Test requirement**: No automated test. Manual: set `abortRef.current = true` in console during THINKING → confirm no PROMPT_READY transition when generation completes.
**⚠️ Boundaries**: Do NOT modify any other part of `handleGenerateResult`. Do NOT change `handleGenerateResultRef.current` assignment.
**CODEBASE.md update?**: No — wait until ABORT-005.
**Architecture compliance**: `useRef` for mutable flag shared across async callbacks — correct pattern per ARCHITECTURE.md state management section.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ABORT-002 · handleAbort() in App.jsx + onAbort prop wired to ExpandedView
- **Status**: `[ ]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria (AC-004 through AC-011)
- **Dependencies**: ABORT-001
- **Touches**: `src/renderer/App.jsx`, `src/renderer/components/ExpandedView.jsx`

**What to do**:

**In `src/renderer/App.jsx`:**

1. Define `handleAbort` as a plain function (not useCallback — it reads `stateRef.current` via ref, so no stale closure risk). Place it near `handleCollapse` (around line 140):

```js
function handleAbort() {
  const s = stateRef.current
  if (s === STATES.IDLE || s === STATES.HISTORY || s === STATES.SETTINGS ||
      s === STATES.SHORTCUTS || s === STATES.ERROR) return
  if (s === STATES.RECORDING || s === STATES.PAUSED) { handleDismiss(); return }
  if (s === STATES.THINKING) { abortRef.current = true; transition(STATES.IDLE); return }
  if (s === STATES.ITERATING) { dismissIterating(); return }
  if (s === STATES.IMAGE_BUILDER || s === STATES.IMAGE_BUILDER_DONE) { handleImageStartOver(); return }
  if (s === STATES.VIDEO_BUILDER || s === STATES.VIDEO_BUILDER_DONE) { handleVideoStartOver(); return }
  transition(STATES.IDLE)
}
```

Note: `handleAbort` references `handleDismiss`, `dismissIterating`, `handleImageStartOver`, `handleVideoStartOver` — all of these are already in scope at that point in App.jsx.

2. Pass `onAbort={handleAbort}` to the `<ExpandedView .../>` component (inside the `isExpanded ? (...)` branch).

**In `src/renderer/components/ExpandedView.jsx`:**

3. Add `onAbort` to the destructured props at the top.
4. Pass `onAbort={onAbort}` to `<ExpandedTransportBar .../>`.

**Acceptance criteria**:
- [ ] `handleAbort` function exists in App.jsx, branches correctly for all 10 states listed in spec
- [ ] `onAbort={handleAbort}` passed to `<ExpandedView>`
- [ ] `ExpandedView` accepts and forwards `onAbort` to `ExpandedTransportBar`
- [ ] No existing props removed from either component

**Self-verify**: Trace the call chain: `handleAbort` in App.jsx → prop `onAbort` on ExpandedView → forwarded to ExpandedTransportBar. All three links must exist.
**Test requirement**: Manual: in expanded mode, click abort from IMAGE_BUILDER_DONE → confirm returns to IDLE with builder state reset (no leftover prompt in imageBuiltPrompt).
**⚠️ Boundaries**: Do NOT touch `handleCollapse` or any existing props on ExpandedView. Add only `onAbort` — nothing else.
**CODEBASE.md update?**: No — wait until ABORT-005.
**Architecture compliance**: Plain function (not useCallback) for abort is correct — it only reads refs, so no closure staleness risk.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ABORT-003 · Abort button in ExpandedTransportBar
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria (AC-002, AC-012, AC-015)
- **Dependencies**: ABORT-002
- **Touches**: `src/renderer/components/ExpandedTransportBar.jsx`

**What to do**:

1. Add `onAbort` to the destructured props.
2. Change the drag-spacer `<div>` (the `height: '36px', WebkitAppRegion: 'drag'` div) from `justifyContent: 'flex-end'` to `justifyContent: 'space-between'`.
3. Add the abort button as the FIRST child of that div (left side), before the existing collapse button:

```jsx
<button
  onClick={onAbort}
  title="Reset to start"
  style={{
    width: '28px', height: '28px', borderRadius: '7px',
    background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: currentState === 'IDLE' ? 'default' : 'pointer',
    marginLeft: '18px', WebkitAppRegion: 'no-drag', padding: 0,
    transition: 'background 150ms', flexShrink: 0,
    opacity: currentState === 'IDLE' ? 0.3 : 1,
  }}
  onMouseEnter={e => { if (currentState !== 'IDLE') e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
>
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
    <path d="M9 3H4.5A2.5 2.5 0 0 0 2 5.5v0A2.5 2.5 0 0 0 4.5 8H8"
      stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M6.5 5.5L9 3L6.5 0.5"
      stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
</button>
```

The SVG is a "return/undo" arrow (arc back to left with arrowhead pointing left).

The existing collapse button stays in the same position (`marginRight: '18px'`). The `space-between` flex gives left button on left, collapse button on right.

**Acceptance criteria**:
- [ ] `onAbort` in props
- [ ] Drag-spacer div uses `justifyContent: 'space-between'`
- [ ] Abort button present on left, collapse button still on right
- [ ] Button is `WebkitAppRegion: 'no-drag'`
- [ ] Button dims to 0.3 opacity when `currentState === 'IDLE'`, full opacity otherwise
- [ ] `title="Reset to start"` present

**Self-verify**: Re-read ExpandedTransportBar fully — confirm the collapse button position and styling are unchanged.
**Test requirement**: Manual: open expanded view, confirm button visible top-left; click from each non-IDLE state and verify return to IDLE.
**⚠️ Boundaries**: Do NOT change collapse button position, style, or behavior. Do NOT modify the transport row (the row with the mic button / pause button / mode pill).
**CODEBASE.md update?**: No — wait until ABORT-005.
**Architecture compliance**: Inline styles for dynamic opacity/cursor ✓. `WebkitAppRegion: 'no-drag'` on clickable element ✓.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ABORT-004 · Abort overlay button in App.jsx (collapsed mode)
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#acceptance-criteria (AC-003, AC-012, AC-015)
- **Dependencies**: ABORT-002
- **Touches**: `src/renderer/App.jsx`

**What to do**:

In App.jsx, inside the non-expanded branch (`isExpanded ? (...) : (<> ... </>)`), add the overlay button as the LAST child before the closing `</>`. It must be placed OUTSIDE the `{displayState === STATES.X && ...}` blocks so it's always rendered regardless of which state component is showing:

```jsx
{!isExpanded && displayState !== STATES.IDLE &&
 displayState !== STATES.HISTORY && displayState !== STATES.SETTINGS &&
 displayState !== STATES.SHORTCUTS && displayState !== STATES.ERROR && (
  <button
    onClick={handleAbort}
    title="Reset to start"
    style={{
      position: 'absolute', top: '10px', right: '14px', zIndex: 20,
      width: '26px', height: '26px', borderRadius: '7px',
      background: 'rgba(255,255,255,0.05)',
      border: '0.5px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', WebkitAppRegion: 'no-drag', padding: 0,
      transition: 'background 150ms',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
  >
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M9 3H4.5A2.5 2.5 0 0 0 2 5.5v0A2.5 2.5 0 0 0 4.5 8H8"
        stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M6.5 5.5L9 3L6.5 0.5"
        stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </button>
)}
```

Important: The outer App container div already has `position: 'relative'` (it has `borderRadius`, `overflow: 'hidden'` etc.), so `position: 'absolute'` on this button will be correctly constrained to the bar window.

Wait — check the existing outer div style. It has `position: 'relative'` at the animated state wrapper level. The button should be placed inside the `<> ... </>` fragment that is the non-expanded branch.

Actually, place the overlay button NOT inside the animated state wrapper div but as a sibling OUTSIDE of it in the top-level return, using the outer `<div id="bar">` as the positioning parent. Check App.jsx structure:
```jsx
<div id="bar" style={{position:'relative', ...}}>
  <div className={stateClass} style={{flex:1,...}}>
    {isExpanded ? <ExpandedView .../> : <> ... </>}
  </div>
  {/* overlay button goes here — sibling to animated wrapper */}
</div>
```

Place the abort overlay button AFTER the animated wrapper div and BEFORE the closing `</div>` of `<div id="bar">`. This makes it truly overlay everything, at the correct position.

**Acceptance criteria**:
- [ ] Overlay button visible for states: RECORDING, PAUSED, THINKING, ITERATING, TYPING, PROMPT_READY, IMAGE_BUILDER, IMAGE_BUILDER_DONE, VIDEO_BUILDER, VIDEO_BUILDER_DONE
- [ ] Overlay button NOT visible for: IDLE, HISTORY, SETTINGS, SHORTCUTS, ERROR, and when `isExpanded === true`
- [ ] `position: 'absolute', top: '10px', right: '14px', zIndex: 20`
- [ ] `WebkitAppRegion: 'no-drag'`
- [ ] `title="Reset to start"`
- [ ] Clicking it calls `handleAbort()`

**Self-verify**: Read the full non-expanded branch in App.jsx. Confirm the button is placed correctly relative to its positioning parent.
**Test requirement**: Manual: in collapsed RECORDING state, confirm button visible top-right. Click → returns to IDLE. Check IDLE state — confirm button gone.
**⚠️ Boundaries**: Do NOT modify any existing state component render block. The button is an overlay — additive only.
**CODEBASE.md update?**: No — wait until ABORT-005.
**Architecture compliance**: `zIndex: 20` matches the existing z-index convention (App.jsx already uses `zIndex: -1` for background glows and `z-10` for edge highlights). 20 ensures it's on top of state components.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### ABORT-005 · Docs — CODEBASE.md + DECISIONS.md update
- **Status**: `[ ]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#conformance-checklist
- **Dependencies**: ABORT-004
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:

1. **`vibe/CODEBASE.md` — File map section:**
   - `App.jsx` row: add `abortRef`, `handleAbort()` to the "Key exports / functions" cell
   - `ExpandedView.jsx` row: add `onAbort` to the props list
   - `ExpandedTransportBar.jsx` row: add `onAbort` to the props list
   - React state + refs table: add row `| \`abortRef\` | useRef boolean | \`handleAbort()\` sets true | \`handleGenerateResult\` guard |`

2. **`vibe/DECISIONS.md`:** Append a new entry:
   ```
   ---
   ## D-ABORT-001 — 2026-04-28 — Abort button: always-visible vs per-state
   > Decision: single overlay button in App.jsx for collapsed mode + button in ExpandedTransportBar for expanded mode.
   > Reason: avoids touching every state component; single implementation point for all 10 abort states.
   > Alternative considered: adding abort to each state component's own dismiss/cancel controls.
   > Rejected: would require 10 separate changes + no single "always same position" guarantee.
   ---
   ```

3. **`vibe/TASKS.md`:** Mark ABORT-005 done and update "What just happened" / "What's next" per the feature tasks protocol.

**Acceptance criteria**:
- [ ] CODEBASE.md App.jsx row mentions `abortRef` + `handleAbort()`
- [ ] CODEBASE.md ExpandedView + ExpandedTransportBar rows mention `onAbort` prop
- [ ] CODEBASE.md refs table has `abortRef` row
- [ ] DECISIONS.md has D-ABORT-001 entry
- [ ] TASKS.md updated

**Self-verify**: Re-read the three updated CODEBASE.md rows and confirm they match the actual code.
**Test requirement**: None — docs only.
**⚠️ Boundaries**: Do NOT rewrite CODEBASE.md sections — update the specific rows only.
**CODEBASE.md update?**: Yes — this IS the CODEBASE.md update task.
**Architecture compliance**: N/A — docs only.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: Abort / Reset Button
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Button visible in all required states, hidden in IDLE / HISTORY / SETTINGS / SHORTCUTS / ERROR (AC-001)
- [ ] Expanded button in ExpandedTransportBar drag-spacer row, left side (AC-002)
- [ ] Collapsed overlay at `top: 10px, right: 14px` (AC-003)
- [ ] RECORDING / PAUSED → `handleDismiss()` → IDLE (AC-004, AC-005)
- [ ] THINKING → `abortRef = true` + transition to IDLE → stale generation discarded (AC-006, AC-013)
- [ ] ITERATING → `dismissIterating()` (AC-007)
- [ ] TYPING / PROMPT_READY → `transition(IDLE)` (AC-008)
- [ ] IMAGE_BUILDER / IMAGE_BUILDER_DONE → `handleImageStartOver()` (AC-009)
- [ ] VIDEO_BUILDER / VIDEO_BUILDER_DONE → `handleVideoStartOver()` (AC-010)
- [ ] `isExpanded` unchanged after abort (AC-011)
- [ ] `title="Reset to start"` on both buttons (AC-012)
- [ ] `abortRef` reset to false after guarding stale generation (AC-013)
- [ ] `abortRef` reset at start of next flow (AC-014)
- [ ] Both buttons `WebkitAppRegion: 'no-drag'` (AC-015)
- [ ] `npm run lint` → 0 errors (AC-016)
- [ ] No regressions in recording, builder, or iteration flows
- [ ] CODEBASE.md updated
