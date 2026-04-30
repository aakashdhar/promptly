# FEATURE-THINKING-PROGRESS Plan

## Impact map

### New files
| File | Purpose |
|------|---------|
| `src/renderer/utils/thinkingLabels.js` | `getLabelSequence(mode, phase)` + `getModeAccent(mode)` |
| `src/renderer/hooks/useThinkingProgress.js` | elapsed timer + label rotation + fading state, driven from App.jsx |

### Modified files
| File | Change |
|------|--------|
| `src/renderer/App.jsx` | `thinkingPhase` useState; `useThinkingProgress` call; phase detection in `transition()`; prop forwarding chain |
| `src/renderer/components/ExpandedDetailPanel.jsx` | THINKING progress block (spinner + label + timer + divider + skeleton); new props |
| `src/renderer/components/ExpandedTransportBar.jsx` | Top bar label + timer sync; new props |
| `src/renderer/components/ExpandedView.jsx` | Thread new props through to both children |
| `vibe/CODEBASE.md` | New files, prop changes |
| `vibe/DECISIONS.md` | Feature entry |
| `vibe/TASKS.md` | Progress updates |

---

## Files explicitly out of scope

- `src/renderer/components/ThinkingState.jsx` — **DO NOT TOUCH**
- `main.js` — **DO NOT TOUCH**
- `preload.js` — **DO NOT TOUCH**
- `src/renderer/index.css` — **DO NOT TOUCH** (spin keyframe already exists)
- All builder hooks (useImageBuilder, useVideoBuilder, useWorkflowBuilder) — phase detected in transition(), no hook changes needed
- All other components

---

## Phase detection approach

In `App.jsx` `transition()`, when `newState === STATES.THINKING`:
```js
const prevS = stateRef.current
const isPhase2 = [STATES.IMAGE_BUILDER, STATES.VIDEO_BUILDER, STATES.WORKFLOW_BUILDER].includes(prevS)
setThinkingPhase(isPhase2 ? 2 : 1)
```

When `newState !== STATES.THINKING`, reset: `setThinkingPhase(1)` (alongside existing `setThinkingLabel('')`).

This avoids touching any builder hooks.

---

## Conventions to follow (from CODEBASE.md + ARCHITECTURE.md)

- Functional React components, one per file in `src/renderer/components/`
- All state transitions via `transition()` in App.jsx — no direct state mutation
- Inline styles for dynamic/stateful values; Tailwind only for static layout classes
- No `dangerouslySetInnerHTML` with user/Claude content — JSX text nodes only
- `useEffect` with proper cleanup (`return () => clearInterval(...)`)
- Reuse `spin` keyframe from `index.css` — CSS class `animate-[spin_1.1s_linear_infinite]` or inline `animation: 'spin 1.1s linear infinite'` style
- `WebkitAppRegion: 'no-drag'` on all interactive elements (no new interactive elements added here, but SVGs are non-interactive)

---

## Task breakdown

### THINK-001 (S) — `src/renderer/utils/thinkingLabels.js`
Pure utility file. No React. No side effects.
- `getLabelSequence(mode, phase = 1)` — returns string[] for given mode + phase
- `getModeAccent(mode)` — returns rgba string for mode accent colour
- Covers all 11 modes + image_1/image_2/video_1/video_2/workflow_1/workflow_2
- Unit-testable (can add to `tests/utils.test.js` if desired)

### THINK-002 (S) — `src/renderer/hooks/useThinkingProgress.js`
Custom hook. Pure React state + effects.
- Accepts `{ mode, phase, isActive }`
- Returns `{ elapsed, currentLabel, fading }`
- `useEffect` for elapsed (1s interval) — dep on `isActive`, `mode`, `phase`
- `useEffect` for label rotation (4s interval + 300ms fade timeout) — same deps
- Cleanup on every dep change + unmount
- First label set synchronously on activation (no 4s wait)

### THINK-003 (M) — App.jsx wiring
- Add `thinkingPhase` useState (default 1)
- Add phase detection in `transition()` block
- Add reset (`setThinkingPhase(1)`) in the THINKING exit cleanup
- Call `useThinkingProgress({ mode, phase: thinkingPhase, isActive: currentState === STATES.THINKING })`
- Add `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingFading`, `thinkingPhase` to ExpandedView props

### THINK-004 (M) — ExpandedDetailPanel.jsx progress block
- Add `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingFading`, `thinkingPhase` to props
- Add `currentState === 'THINKING'` conditional block:
  - Progress container (flexColumn, alignCenter, gap 12, padding 36px 28px 28px, border-bottom divider)
  - Spinner SVG 32×32 with accent colour from `getModeAccent(mode)`, using `spin` animation
  - Rotating label with fade transition
  - Elapsed timer in monospace
  - Below divider: skeleton bars (three groups, skeleton-pulse animation from index.css)
- The THINKING block replaces the panel header + clock empty state during THINKING — achieved by NOT rendering `{!isContentState && <header>}` and `{showEmpty && <clock>}` when in THINKING (add THINKING to a `isProgressState` check or gate the header/empty on `!isProgressState`)

### THINK-005 (S) — ExpandedTransportBar.jsx top bar sync
- Add `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingFading` to props
- In THINKING branch: replace `textLine1 = 'Generating prompt...'` with inline-flex row: 12px spinner SVG + `thinkingCurrentLabel`
- Add `textLine2 = formatTime(thinkingElapsed)` below, monospace, rgba(255,255,255,0.2), paddingLeft 19px
- `formatTime(s)` utility inline: `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`

### THINK-006 (S) — Docs
- `vibe/CODEBASE.md`: add 2 new files, update prop tables for ExpandedDetailPanel + ExpandedTransportBar + ExpandedView + App.jsx
- `vibe/DECISIONS.md`: FEATURE-THINKING-PROGRESS entry
- `vibe/TASKS.md`: feature start entry + progress

---

## Rollback plan

All changes are additive (new utility + new hook + new props). To roll back:
1. Delete `thinkingLabels.js` + `useThinkingProgress.js`
2. Remove `thinkingPhase` from App.jsx + phase detection + hook call + prop forwarding
3. Revert ExpandedDetailPanel + ExpandedTransportBar prop additions and THINKING blocks

---

## Testing strategy

- Manual smoke test: exercise THINKING state in expanded view across all modes
- Verify label rotation: wait 4s between each label change for standard modes
- Verify phase detection: image/video/workflow should show phase 1 labels first, then phase 2 after user confirms in builder UI
- Verify cleanup: abort during THINKING (use abort button) — confirm no timer leak (elapsed should reset on next THINKING entry)
- Verify top bar sync: label and timer in top bar should match right panel exactly
- `getLabelSequence` — optional unit test in `tests/utils.test.js`

---

## CODEBASE.md sections to update

- File map: add `thinkingLabels.js` + `useThinkingProgress.js`
- `App.jsx` row: add `thinkingPhase`, `useThinkingProgress` call
- `ExpandedDetailPanel.jsx` row: add new props
- `ExpandedTransportBar.jsx` row: add new props
- `ExpandedView.jsx` row: add new props threaded through
