# FEATURE-THINKING-PROGRESS Tasks

> **Estimated effort:** 4 tasks — S: 3, M: 1 — approx. 2–3 hours total

---

### THINK-001 · thinkingLabels.js utility
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#getlabelsequence--getmodeaccent
- **Dependencies**: None
- **Touches**: `src/renderer/utils/thinkingLabels.js` (new)

**What to do**:
Create `src/renderer/utils/thinkingLabels.js` as a pure ES module with two named exports.

`getLabelSequence(mode, phase = 1)`:
- Standard modes (balanced/detailed/concise/chain/code/design): `["Structuring your prompt...", "Adding context and constraints...", "Refining the output format...", "Almost ready...", "Taking a moment longer than usual..."]`
- refine: `["Analysing your prompt...", "Identifying improvements...", "Refining the structure...", "Almost ready..."]`
- polish: `["Reading your draft...", "Polishing the language...", "Finalising the tone...", "Almost ready..."]`
- email: `["Reading your situation...", "Drafting the email...", "Choosing the right tone...", "Almost ready..."]`
- image phase 1: `["Analysing your idea...", "Identifying visual parameters...", "Preparing the builder..."]`
- image phase 2: `["Assembling your prompt...", "Optimising for Nano Banana...", "Almost ready..."]`
- video phase 1: `["Analysing your idea...", "Mapping camera and style...", "Preparing the builder..."]`
- video phase 2: `["Assembling your video prompt...", "Optimising for Veo 3.1...", "Almost ready..."]`
- workflow phase 1: `["Mapping your workflow...", "Identifying nodes and connections...", "Preparing the builder..."]`
- workflow phase 2: `["Assembling the workflow JSON...", "Validating node connections...", "Almost ready..."]`
- Unknown mode: fall back to balanced sequence

Implementation: use a `sequences` object keyed by mode name; for image/video/workflow use key `${mode}_${phase}`, others use mode directly. Return `sequences[key] || sequences['balanced']`.

`getModeAccent(mode)`:
- balanced/detailed/concise/chain/code/design → `'rgba(10,132,255,0.85)'`
- refine → `'rgba(168,85,247,0.85)'`
- polish → `'rgba(48,209,88,0.85)'`
- email → `'rgba(20,184,166,0.85)'`
- image → `'rgba(139,92,246,0.85)'`
- video → `'rgba(251,146,60,0.85)'`
- workflow → `'rgba(34,197,94,0.85)'`
- Unknown → `'rgba(10,132,255,0.85)'`

**Acceptance criteria**:
- [ ] `getLabelSequence('balanced', 1)` returns 5-item array starting with "Structuring your prompt..."
- [ ] `getLabelSequence('image', 1)` returns 3-item phase-1 array
- [ ] `getLabelSequence('image', 2)` returns 3-item phase-2 array (different from phase 1)
- [ ] `getLabelSequence('unknown_mode', 1)` returns balanced fallback
- [ ] `getModeAccent('email')` returns `'rgba(20,184,166,0.85)'`
- [ ] `getModeAccent('unknown')` returns blue fallback

**Self-verify**: Read FEATURE_SPEC.md#label-sequences. Check every mode has correct labels.
**Test requirement**: Optional — add unit tests in `tests/utils.test.js` for both exports.
**⚠️ Boundaries**: Pure utility. No React imports. No side effects. No default export.
**CODEBASE.md update?**: Yes — add `thinkingLabels.js` row to file map.
**Architecture compliance**: Named exports. Pure functions. Matches utils/promptUtils.js and utils/history.js pattern.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### THINK-002 · Top bar rotating label + timer + mode accent spinner
- **Status**: `[x]`
- **Size**: M
- **Spec ref**: FEATURE_SPEC.md#top-bar-layout-during-thinking, FEATURE_SPEC.md#usethinkingprogress-hook
- **Dependencies**: THINK-001
- **Touches**: `src/renderer/hooks/useThinkingProgress.js` (new), `src/renderer/components/ExpandedTransportBar.jsx`

**What to do**:

**Part A — Create `src/renderer/hooks/useThinkingProgress.js`**:

```js
import { useState, useEffect } from 'react'
import { getLabelSequence } from '../utils/thinkingLabels.js'

export function useThinkingProgress({ mode, phase, isActive }) {
  const [elapsed, setElapsed] = useState(0)
  const [currentLabel, setCurrentLabel] = useState('')
  const [labelOpacity, setLabelOpacity] = useState(1)

  useEffect(() => {
    if (!isActive) {
      setElapsed(0)
      setCurrentLabel('')
      setLabelOpacity(1)
      return
    }
    const labels = getLabelSequence(mode, phase)
    setCurrentLabel(labels[0])
    setLabelOpacity(1)
    let labelIdx = 0

    const elapsedInterval = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 1000)

    const labelInterval = setInterval(() => {
      if (labelIdx >= labels.length - 1) return
      setLabelOpacity(0)
      setTimeout(() => {
        labelIdx += 1
        setCurrentLabel(labels[labelIdx])
        setLabelOpacity(1)
      }, 150)
    }, 4000)

    return () => {
      clearInterval(elapsedInterval)
      clearInterval(labelInterval)
    }
  }, [isActive, mode, phase])

  return { elapsed, currentLabel, labelOpacity }
}
```

Key: first label set synchronously before intervals fire. `labelIdx` is a local variable in the effect (not state) so it doesn't trigger re-renders.

**Part B — Update `ExpandedTransportBar.jsx`**:

Add props: `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingLabelOpacity`.

Read the existing THINKING branch carefully (currently: `textLine1 = 'Generating prompt...'; textLine2 = ''; textDot = 'thinking'`).

Replace the text content rendering for the THINKING case. The existing component builds `textLine1`/`textLine2` strings and renders them in a text block. For THINKING, render a JSX block instead:

```jsx
// In the text block area, add a THINKING-specific render:
{isThinking ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: '7px',
      fontSize: '13px', fontWeight: 500,
      color: 'rgba(255,255,255,0.6)',
      opacity: thinkingLabelOpacity,
      transition: 'opacity 150ms ease',
    }}>
      <div style={{ animation: 'spin 1.1s linear infinite', flexShrink: 0, display: 'flex' }}>
        <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="12"
            stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
          <path d="M16 4A12 12 0 0 1 28 16"
            stroke={getModeAccent(mode)} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
      {thinkingCurrentLabel}
    </div>
    <div style={{
      fontFamily: 'monospace', fontSize: '11px',
      color: 'rgba(255,255,255,0.2)',
      paddingLeft: '19px',
    }}>
      {`${Math.floor(thinkingElapsed / 60)}:${(thinkingElapsed % 60).toString().padStart(2, '0')}`}
    </div>
  </div>
) : (
  /* existing textLine1/textLine2 rendering unchanged */
)}
```

Import `getModeAccent` from `'../utils/thinkingLabels.js'` at the top of the file.

Do not touch any other part of ExpandedTransportBar — buttons, waveform, drag region, etc. are unchanged.

**Acceptance criteria**:
- [ ] During THINKING: 12px spinner with mode accent arc visible in top bar
- [ ] Spinner rotates continuously via spin animation
- [ ] First label shown immediately (no 4s wait)
- [ ] Label opacity fades to 0 then back to 1 when changing (150ms ease)
- [ ] Timer starts at 0:00 and increments every second
- [ ] Timer format M:SS (e.g. 0:06 not 00:06)
- [ ] paddingLeft 19px on timer row aligns under label text
- [ ] All other states: existing textLine1/textLine2 rendering unchanged
- [ ] Hook resets elapsed + label when isActive becomes false
- [ ] Both intervals cleared — no memory leaks on unmount

**Self-verify**: Re-read FEATURE_SPEC.md#top-bar-layout-during-thinking and #usethinkingprogress-hook.
**Test requirement**: Manual — exercise THINKING in multiple modes, watch label rotation and timer.
**⚠️ Boundaries**: Do not touch ExpandedDetailPanel. Do not touch the waveform, buttons, or drag area in ExpandedTransportBar.
**CODEBASE.md update?**: Yes — add useThinkingProgress.js row; update ExpandedTransportBar props.
**Architecture compliance**: opacity-only transition (150ms ease). spin @keyframe reuse. No transform in transition declarations.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### THINK-003 · App.jsx — mode + phase props wired through
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md#integration-points, FEATURE_SPEC.md#phase-detection
- **Dependencies**: THINK-002
- **Touches**: `src/renderer/App.jsx`, `src/renderer/components/ExpandedView.jsx`

**What to do**:

**App.jsx** — three additions:

1. Add `thinkingPhase` state near the other thinking-related state:
   ```js
   const [thinkingPhase, setThinkingPhase] = useState(1)
   ```

2. In `transition()`, add phase detection and reset:
   ```js
   // When entering THINKING (add alongside existing accent/label logic):
   if (newState === STATES.THINKING) {
     const builderStates = [STATES.IMAGE_BUILDER, STATES.VIDEO_BUILDER, STATES.WORKFLOW_BUILDER]
     setThinkingPhase(builderStates.includes(stateRef.current) ? 2 : 1)
   }
   // When leaving THINKING (add alongside setThinkingLabel('') reset):
   if (newState !== STATES.THINKING) {
     setThinkingPhase(1)   // ADD THIS alongside existing setThinkingLabel('') line
   }
   ```

   Find the exact location of the existing `setThinkingLabel('')` call in `transition()` and add `setThinkingPhase(1)` next to it. Do not restructure the function.

3. Call the hook (add near other hook calls):
   ```js
   import { useThinkingProgress } from './hooks/useThinkingProgress.js'

   const { elapsed: thinkingElapsed, currentLabel: thinkingCurrentLabel, labelOpacity: thinkingLabelOpacity } = useThinkingProgress({
     mode,
     phase: thinkingPhase,
     isActive: currentState === STATES.THINKING,
   })
   ```

4. Forward props to ExpandedView:
   ```jsx
   <ExpandedView
     ...existing props...
     thinkingElapsed={thinkingElapsed}
     thinkingCurrentLabel={thinkingCurrentLabel}
     thinkingLabelOpacity={thinkingLabelOpacity}
   />
   ```

**ExpandedView.jsx** — thread props through to ExpandedTransportBar only:
- Add `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingLabelOpacity` to ExpandedView props
- Forward all three to ExpandedTransportBar
- ExpandedDetailPanel is NOT touched

**Acceptance criteria**:
- [ ] `thinkingPhase` = 1 for standard modes and first pass of builder modes
- [ ] `thinkingPhase` = 2 when entering THINKING from IMAGE_BUILDER, VIDEO_BUILDER, or WORKFLOW_BUILDER
- [ ] `thinkingPhase` resets to 1 when leaving THINKING
- [ ] `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingLabelOpacity` flow from App.jsx → ExpandedView → ExpandedTransportBar
- [ ] ExpandedDetailPanel receives no new props
- [ ] Lint clean — no unused variables

**Self-verify**: Re-read FEATURE_SPEC.md#integration-points and #phase-detection. Verify the transition() insertion points don't disrupt existing logic.
**Test requirement**: Manual — image/video/workflow phase 2 shows correct labels; standard modes show correct labels.
**⚠️ Boundaries**: Minimal changes — only add thinkingPhase state, hook call, and prop forwarding. Do not restructure transition() or any existing logic.
**CODEBASE.md update?**: Yes — update App.jsx row (new state var + hook call); update ExpandedView props.
**Architecture compliance**: useState near related state. Hook called alongside other hooks. Props forwarded through ExpandedView consistent with existing pattern.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

### THINK-004 · Docs update
- **Status**: `[x]`
- **Size**: S
- **Spec ref**: FEATURE_SPEC.md (scope summary)
- **Dependencies**: THINK-001 through THINK-003
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`

**What to do**:

**CODEBASE.md**:
- File map: add `src/renderer/utils/thinkingLabels.js` row — `getLabelSequence(mode, phase)`, `getModeAccent(mode)`
- File map: add `src/renderer/hooks/useThinkingProgress.js` row — `useThinkingProgress({ mode, phase, isActive })` → `{ elapsed, currentLabel, labelOpacity }`
- App.jsx row: add `thinkingPhase` useState; `useThinkingProgress` call in key exports/notes
- ExpandedView.jsx row: add 3 new props threaded to ExpandedTransportBar
- ExpandedTransportBar.jsx row: add `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingLabelOpacity` to props list

**DECISIONS.md** — append:
```
---
## — Feature: FEATURE-THINKING-PROGRESS — 2026-04-30
> Folder: vibe/features/2026-04-30-thinking-progress/
> Adds rotating label + elapsed timer + mode accent spinner to top bar during THINKING.
> Right panel unchanged. ThinkingState.jsx unchanged.
> Phase detection in transition(): entering from IMAGE_BUILDER/VIDEO_BUILDER/WORKFLOW_BUILDER → phase 2.
> State lifted to App.jsx via useThinkingProgress hook; passed down through ExpandedView.
> Tasks: THINK-001–004 | Estimated: ~2-3 hours
---
```

**TASKS.md** — add feature entry and mark progress.

**Acceptance criteria**:
- [ ] CODEBASE.md reflects all new and modified files
- [ ] DECISIONS.md has the feature entry
- [ ] TASKS.md shows FEATURE-THINKING-PROGRESS

**Self-verify**: Confirm every file touched in THINK-001/002/003 appears in CODEBASE.md.
**Test requirement**: None — doc only.
**⚠️ Boundaries**: Docs only. No code changes.
**CODEBASE.md update?**: This IS the CODEBASE.md update task.
**Architecture compliance**: Consistent with previous DECISIONS.md entry format.

**Decisions**:
> Filled in by agent after completing.
- None yet.

---

#### Conformance: FEATURE-THINKING-PROGRESS
> Tick after every task. All items ✅ before feature is shippable.
- [ ] Top bar shows rotating label + timer during THINKING
- [ ] Right panel unchanged (ExpandedDetailPanel not touched)
- [ ] Spinner 12px with mode accent arc, white track
- [ ] First label shown immediately at 0s
- [ ] Label opacity transition on change (150ms ease, opacity only — no transform in transition)
- [ ] All label sequences correct per FEATURE_SPEC.md
- [ ] Phase 1 vs phase 2 correct for Image/Video/Workflow
- [ ] Timer format M:SS
- [ ] "Taking a moment longer..." after 16s for standard modes
- [ ] Intervals cleaned up on unmount — no leaks
- [ ] ThinkingState.jsx untouched
- [ ] ExpandedDetailPanel.jsx untouched
- [ ] Lint clean
- [ ] No regression in other states or modes
- [ ] CODEBASE.md updated for all structural changes
