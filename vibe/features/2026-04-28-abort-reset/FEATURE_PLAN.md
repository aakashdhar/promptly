# FEATURE_PLAN.md — Abort / Reset Button
> Feature folder: vibe/features/2026-04-28-abort-reset/
> Added: 2026-04-28

---

## 1. Impact map

### Files to modify (exact paths)

| File | What changes |
|------|-------------|
| `src/renderer/App.jsx` | Add `abortRef`, `handleAbort()`, guard in `handleGenerateResult`, collapsed-mode overlay button JSX, `onAbort` prop on `<ExpandedView>` |
| `src/renderer/components/ExpandedView.jsx` | Accept `onAbort` prop, forward to `ExpandedTransportBar` |
| `src/renderer/components/ExpandedTransportBar.jsx` | Add `onAbort` to prop signature, add button JSX to drag-spacer row |

### New files

None.

---

## 2. Files explicitly out of scope

All files not listed above. Specifically:
- `main.js`, `preload.js` — no IPC changes
- All other `src/renderer/components/` — no state components touched
- All `src/renderer/hooks/` — no hook changes
- `src/renderer/utils/` — no utility changes
- `index.css` — no new keyframes or tokens needed

---

## 3. DB / storage changes

None.

---

## 4. Detailed changes per file

### `src/renderer/App.jsx`

**Add `abortRef`** (alongside existing `transitionRef`, `handleGenerateResultRef`):
```js
const abortRef = useRef(false)
```

**Guard in `handleGenerateResult`** (first thing inside the callback):
```js
const handleGenerateResult = useCallback((genResult, transcript) => {
  if (abortRef.current) { abortRef.current = false; return }
  // ... existing logic
}, [...])
```

**Reset `abortRef` in `startRecording`** — already happens inside `useRecording.js`'s startRecording flow which calls `isIterated.current = false` etc. However `abortRef` is owned by App.jsx so we need to reset it there. The cleanest approach: pass `abortRef` into `useRecording` OR reset it in the `onStart` callback in the ExpandedView render, OR reset it in `handleAbort` itself (no — we set it true there). Best: add a `resetAbort` callback that's called at the top of `startRecording`'s user-facing entry points. Since `startRecording` is called from multiple places, reset `abortRef` at the start of `handleAbort` being a no-op when going to IDLE is fine — and reset at the START of the generation pipeline: inside `handleGenerateResult`'s first-line check (`abortRef.current = false` after checking).

Actually simplest: reset `abortRef.current = false` in the guard branch (when it IS true, reset it so the next flow is clean). This is already written above.

**`handleAbort` function** (defined alongside `handleCollapse` etc.):
```js
function handleAbort() {
  const s = stateRef.current
  if (s === STATES.IDLE || s === STATES.HISTORY || s === STATES.SETTINGS ||
      s === STATES.SHORTCUTS || s === STATES.ERROR) return
  if (s === STATES.RECORDING || s === STATES.PAUSED) {
    handleDismiss()
    return
  }
  if (s === STATES.THINKING) {
    abortRef.current = true
    transition(STATES.IDLE)
    return
  }
  if (s === STATES.ITERATING) {
    dismissIterating()
    return
  }
  if (s === STATES.IMAGE_BUILDER || s === STATES.IMAGE_BUILDER_DONE) {
    handleImageStartOver()
    return
  }
  if (s === STATES.VIDEO_BUILDER || s === STATES.VIDEO_BUILDER_DONE) {
    handleVideoStartOver()
    return
  }
  // TYPING, PROMPT_READY, or anything else
  transition(STATES.IDLE)
}
```

**Collapsed-mode overlay button JSX** (inside the non-expanded branch, as an absolute child of the outer `<div id="bar">`):
```jsx
{!isExpanded && displayState !== STATES.IDLE &&
 displayState !== STATES.HISTORY && displayState !== STATES.SETTINGS &&
 displayState !== STATES.SHORTCUTS && displayState !== STATES.ERROR && (
  <button
    onClick={handleAbort}
    title="Reset to start"
    style={{
      position: 'absolute', top: '10px', right: '14px',
      width: '26px', height: '26px', borderRadius: '7px',
      background: 'rgba(255,255,255,0.05)',
      border: '0.5px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', WebkitAppRegion: 'no-drag', padding: 0,
      transition: 'background 150ms',
      zIndex: 20,
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
  >
    {/* small return/reset arrow SVG */}
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M9 3H4.5A2.5 2.5 0 0 0 2 5.5v0A2.5 2.5 0 0 0 4.5 8H8"
        stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M6.5 5.5L9 3L6.5 0.5"
        stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </button>
)}
```

Note: button uses `displayState` (not `stateRef.current`) for visibility so it follows the animated state, not the instantaneous state. This prevents a flash where the button disappears mid-animation.

**Pass `onAbort` to `<ExpandedView>`:**
```jsx
<ExpandedView
  ...existing props...
  onAbort={handleAbort}
/>
```

---

### `src/renderer/components/ExpandedView.jsx`

Add `onAbort` to the destructured props and forward to `ExpandedTransportBar`:
```jsx
export default function ExpandedView({ ..., onAbort }) {
  ...
  return (
    ...
    <ExpandedTransportBar
      ...existing props...
      onAbort={onAbort}
    />
    ...
  )
}
```

---

### `src/renderer/components/ExpandedTransportBar.jsx`

Add `onAbort` to prop destructuring.

Add button in the drag-spacer row (`height: '36px'` div), LEFT side:

The drag-spacer div currently has `justifyContent: 'flex-end'`. Change to `justifyContent: 'space-between'` and add the abort button on the left:

```jsx
<div style={{
  height: '36px', WebkitAppRegion: 'drag',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
}}>
  {/* Left: abort/reset button */}
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
      transition: 'background 150ms',
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

  {/* Right: collapse button (existing) */}
  <button onClick={...} ...>
    ...
  </button>
</div>
```

In expanded mode, always show the button (dimmed at IDLE, full opacity otherwise). This is simpler than conditional rendering and avoids layout shifts.

---

## 5. Conventions to follow

From `vibe/ARCHITECTURE.md`:
- Inline styles for dynamic/stateful values — abort button visibility/opacity is dynamic → inline style ✓
- No new IPC channels — all logic is pure React state ✓
- Functional React components, one per file ✓
- No `innerHTML` with user content ✓
- `WebkitAppRegion: 'no-drag'` on all clickable elements ✓

From `vibe/CODEBASE.md` patterns:
- `stateRef.current` (not `currentState`) inside event handlers to avoid stale closures ✓
- `animateToState` / `transition()` for all state changes ✓
- `displayState` for render-conditional visibility (follows animation, not instant state) ✓

---

## 6. Task breakdown

| ID | Title | Size | Dependencies |
|----|-------|------|-------------|
| ABORT-001 | abortRef + handleGenerateResult guard | S | None |
| ABORT-002 | handleAbort() in App.jsx + ExpandedView onAbort prop | M | ABORT-001 |
| ABORT-003 | Abort button in ExpandedTransportBar | S | ABORT-002 |
| ABORT-004 | Abort overlay in App.jsx collapsed mode | S | ABORT-002 |
| ABORT-005 | Docs — CODEBASE.md + DECISIONS.md update | S | ABORT-004 |

---

## 7. Rollback plan

All changes are additive (`abortRef` + one new function + two new JSX buttons + two new props).
Rollback: revert the three modified files to their previous state. No migrations to undo.

---

## 8. Testing strategy

- Manual smoke test: exercise abort from each affected state (RECORDING, THINKING, IMAGE_BUILDER_DONE, VIDEO_BUILDER, ITERATING)
- Verify `isExpanded` is unchanged after abort from expanded view
- Verify stale-generation scenario: start recording → stop → immediately click abort during THINKING → wait 2s → confirm no state transition to PROMPT_READY
- Lint: `npm run lint` must pass

No new unit tests needed — abort logic branches are simple state transitions with no pure utility logic to isolate.

---

## 9. CODEBASE.md sections to update after tasks complete

- **File map** — App.jsx entry: add `abortRef`, `handleAbort()` to key exports/functions
- **File map** — ExpandedTransportBar entry: add `onAbort` to props
- **File map** — ExpandedView entry: add `onAbort` to props list
- **React state + refs** table — add `abortRef` row
