# FEATURE-THINKING-PROGRESS — Native window thinking state progress

## Feature overview

In the native (expanded) window, the THINKING state gives users no feedback. The top transport bar shows a static "Generating prompt..." text during what can be a 5–30 second wait. This feature replaces that static text with a live progress indicator in the top bar only: a mode-accented 12px spinner, a rotating mode-aware label, and an elapsed timer.

The right panel is unchanged — it continues to show the skeleton/clock state it already shows.

The minimized floating bar uses `ThinkingState.jsx` for its THINKING state. **That component is completely out of scope and must not be touched.**

---

## User stories

- As a user in expanded view, when Claude is generating I want to see what it's doing so I trust the app is working.
- As a user with a long generation, I want an elapsed timer in the top bar so I know roughly how long to wait.
- As a user, I want feedback that is specific to what mode I'm in so the wait feels purposeful.

---

## Acceptance criteria

- [ ] Top bar shows rotating label + timer during THINKING (replaces static "Generating prompt...")
- [ ] First label appears immediately when THINKING begins (not after 4s)
- [ ] Label changes every 4 seconds
- [ ] Correct label sequence per mode and phase
- [ ] Image/Video/Workflow phase 1 vs phase 2 use the correct sequence
- [ ] Elapsed timer starts at `0:00` and increments every second
- [ ] Timer format is `M:SS` (e.g. `0:06` not `00:06`)
- [ ] "Taking a moment longer than usual..." appears after 16s for standard modes
- [ ] Spinner is 12px, colour matches current mode accent
- [ ] Both intervals cleared on unmount and when leaving THINKING — no memory leaks
- [ ] `ThinkingState.jsx` (minimized bar) completely unchanged
- [ ] Right panel unchanged — no modifications to ExpandedDetailPanel.jsx
- [ ] Waveform zone unchanged — morph wave still animates during thinking state
- [ ] Rotating label in text area only — not over waveform
- [ ] No regression in any other state or mode
- [ ] `getLabelSequence` returns correct array for every mode+phase combination
- [ ] `spin` keyframe from `index.css` reused — no new CSS keyframes added

---

## Scope boundaries

**Included:**
- `src/renderer/utils/thinkingLabels.js` — label sequences + accent colour helper
- `src/renderer/hooks/useThinkingProgress.js` — elapsed timer + label rotation, driven from App.jsx
- `App.jsx` — `thinkingPhase` state, `useThinkingProgress` call, phase detection in `transition()`, prop forwarding to ExpandedView → ExpandedTransportBar
- `ExpandedView.jsx` — thread new props to ExpandedTransportBar only
- `ExpandedTransportBar.jsx` — top bar spinner + rotating label + elapsed timer

**Explicitly out of scope:**
- `ExpandedDetailPanel.jsx` — no changes, right panel unaffected
- `ThinkingState.jsx` — DO NOT TOUCH
- `main.js`, `preload.js` — DO NOT TOUCH
- `src/renderer/index.css` — DO NOT TOUCH (spin keyframe already exists)
- All builder hooks (useImageBuilder, useVideoBuilder, useWorkflowBuilder) — phase detected in transition(), no hook changes needed

---

## Waveform — must be preserved

The expanded transport bar currently shows a slow blue morph waveform in the waveform zone (the area below the transport row). During THINKING this waveform is already animating. **It must remain completely unchanged.**

The rotating label and elapsed timer go only in the text area — the section to the right of the 0.5px vertical divider in the transport row. This is the same position that shows "Speak your prompt" in idle state or "Listening..." during recording.

**Do not modify the waveform zone in any way.** Do not add elements over it, resize it, or change its animation.

---

## Integration points

### ExpandedTransportBar.jsx
The only component that gains visible UI changes.

- New props: `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingLabelOpacity`
- In the THINKING branch, replace `textLine1 = 'Generating prompt...'` with a JSX block:
  - Line 1: inline-flex row — 12px spinner SVG (mode accent) + `thinkingCurrentLabel`, fontSize 13px, fontWeight 500, rgba(255,255,255,0.6), opacity driven by `thinkingLabelOpacity`
  - Line 2: elapsed timer — monospace, fontSize 11px, rgba(255,255,255,0.2), paddingLeft 19px (aligns under label text past icon)
- Opacity transition on label change: `opacity 150ms ease` on the label row (opacity-only — no transform per ARCHITECTURE.md)
- During all other states: existing text rendering completely unchanged

### App.jsx
- Add `thinkingPhase` useState (default 1)
- In `transition()`: when `newState === STATES.THINKING`, detect phase from `stateRef.current` — set to 2 if previous state is `IMAGE_BUILDER | VIDEO_BUILDER | WORKFLOW_BUILDER`, else 1. Reset to 1 alongside `setThinkingLabel('')` in the THINKING exit block.
- Call `useThinkingProgress({ mode, phase: thinkingPhase, isActive: currentState === STATES.THINKING })`
- Pass `thinkingElapsed`, `thinkingCurrentLabel`, and `thinkingLabelOpacity` through ExpandedView → ExpandedTransportBar

### ExpandedView.jsx
- Add to props: `thinkingElapsed`, `thinkingCurrentLabel`, `thinkingLabelOpacity`
- Forward all three to ExpandedTransportBar only

---

## Top bar layout during THINKING

The text area sits to the right of the 0.5px divider in the transport row — same position as "Speak your prompt" (idle) or "Listening..." (recording). The waveform zone below the transport row is untouched.

```
┌─ transport row ────────────────────────────────────────── divider ─ text area ──────────────────┐
│  [Pause] [timer] [Mic/Stop] [Mode] [Type] [Reset]  │  0.5px  │  ● Structuring your prompt...   │
│                                                     │         │    0:06                          │
├─ waveform zone ─────────────────────────────────────────────────────────────────────────────────┤
│  [slow blue morph wave — UNCHANGED]                                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Text area — Line 1 (spinner + label)
- Container: `display flex, align-items center, gap 7px`
- Font: 13px, weight 500, color rgba(255,255,255,0.6)
- Opacity-only transition on change: `transition: 'opacity 150ms ease'`
- When advancing: set opacity 0 (via state), after 150ms update label + set opacity 1

### Text area — Line 1 spinner (12px)
- SVG rendered inline, 12×12 at viewBox "0 0 32 32"
- Outer circle: cx 16 cy 16 r 12, stroke rgba(255,255,255,0.15), strokeWidth 3
- Arc: `M16 4A12 12 0 0 1 28 16`, stroke = getModeAccent(mode), strokeWidth 3, strokeLinecap round
- Container div: `animation: 'spin 1.1s linear infinite'` (existing keyframe in index.css)

### Text area — Line 2 (elapsed timer)
- `${Math.floor(elapsed / 60)}:${(elapsed % 60).toString().padStart(2, '0')}`
- fontFamily monospace, fontSize 11px, color rgba(255,255,255,0.2), paddingLeft 19px (aligns under label text, past the icon width + gap)

---

## useThinkingProgress hook

```
useThinkingProgress({ mode, phase, isActive }) →
  { elapsed, currentLabel, labelOpacity }
```

- When `isActive` becomes true: reset elapsed to 0, set currentLabel to `getLabelSequence(mode, phase)[0]`, set labelOpacity to 1, start both intervals
- Label interval (4000ms): if not at last label — set labelOpacity to 0, after 150ms advance label index + set labelOpacity to 1
- Elapsed interval (1000ms): increment elapsed by 1
- When `isActive` becomes false or on unmount: clear both intervals, reset elapsed to 0, reset currentLabel to ''
- Label advancement clamped at last label — no cycling
- Deps for both effects: `[isActive, mode, phase]`

---

## Label sequences

### Standard modes (balanced, detailed, concise, chain, code, design)
```
0s:  "Structuring your prompt..."
4s:  "Adding context and constraints..."
8s:  "Refining the output format..."
12s: "Almost ready..."
16s+: "Taking a moment longer than usual..."
```

### refine
```
0s:  "Analysing your prompt..."
4s:  "Identifying improvements..."
8s:  "Refining the structure..."
12s: "Almost ready..."
```

### polish
```
0s:  "Reading your draft..."
4s:  "Polishing the language..."
8s:  "Finalising the tone..."
12s: "Almost ready..."
```

### email
```
0s:  "Reading your situation..."
4s:  "Drafting the email..."
8s:  "Choosing the right tone..."
12s: "Almost ready..."
```

### image — phase 1
```
0s:  "Analysing your idea..."
4s:  "Identifying visual parameters..."
8s:  "Preparing the builder..."
```

### image — phase 2
```
0s:  "Assembling your prompt..."
4s:  "Optimising for Nano Banana..."
8s:  "Almost ready..."
```

### video — phase 1
```
0s:  "Analysing your idea..."
4s:  "Mapping camera and style..."
8s:  "Preparing the builder..."
```

### video — phase 2
```
0s:  "Assembling your video prompt..."
4s:  "Optimising for Veo 3.1..."
8s:  "Almost ready..."
```

### workflow — phase 1
```
0s:  "Mapping your workflow..."
4s:  "Identifying nodes and connections..."
8s:  "Preparing the builder..."
```

### workflow — phase 2
```
0s:  "Assembling the workflow JSON..."
4s:  "Validating node connections..."
8s:  "Almost ready..."
```

---

## getLabelSequence + getModeAccent

### getLabelSequence(mode, phase = 1)
Returns the label array for the given mode. For image/video/workflow, selects phase 1 or phase 2 array using key `${mode}_${phase}`. Falls back to balanced sequence for unknown modes.

### getModeAccent(mode)
Returns an rgba string for the mode accent colour:
```
balanced/detailed/concise/chain/code/design: 'rgba(10,132,255,0.85)'
refine:   'rgba(168,85,247,0.85)'
polish:   'rgba(48,209,88,0.85)'
email:    'rgba(20,184,166,0.85)'
image:    'rgba(139,92,246,0.85)'
video:    'rgba(251,146,60,0.85)'
workflow: 'rgba(34,197,94,0.85)'
fallback: 'rgba(10,132,255,0.85)'
```

---

## Phase detection

Phase 2 applies only to the second THINKING pass in Image, Video, and Workflow modes (after the user confirms in the builder UI). Detected in `transition()` in App.jsx:

```js
if (newState === STATES.THINKING) {
  const builderStates = [STATES.IMAGE_BUILDER, STATES.VIDEO_BUILDER, STATES.WORKFLOW_BUILDER]
  setThinkingPhase(builderStates.includes(stateRef.current) ? 2 : 1)
}
```

All other modes and all first-pass THINKING transitions = phase 1.

---

## Edge cases

- User aborts during THINKING: intervals cleared in hook cleanup, elapsed resets to 0 on next THINKING entry
- Mode or phase changes mid-THINKING (shouldn't happen in normal flows): hook restarts intervals with new sequences because `[isActive, mode, phase]` are all deps
- Short sequences (3 labels for builder modes): label stays on last item after exhausting the array — no cycling
- `isActive` false: hook returns `{ elapsed: 0, currentLabel: '', labelOpacity: 1 }` — top bar falls back to existing text rendering for non-THINKING states

---

## Non-functional requirements

- Zero new npm packages
- No changes to `index.css` — reuse existing `spin` keyframe
- No changes to `ThinkingState.jsx`
- No changes to `ExpandedDetailPanel.jsx`
- Intervals cleared on unmount — no memory leaks

---

## Conformance checklist

> All items must be ✅ before this feature is shippable.
- [ ] Top bar text area shows rotating label + timer during THINKING
- [ ] Right panel unchanged (ExpandedDetailPanel.jsx not touched)
- [ ] Waveform zone unchanged — morph wave still animates during THINKING
- [ ] Rotating label in text area only — not over or near waveform
- [ ] Spinner 12px with mode accent arc, white track
- [ ] First label shown at 0s (not 4s)
- [ ] Label opacity transition on change (150ms ease, opacity only — no transform in transition)
- [ ] All label sequences correct per mode + phase
- [ ] Phase 1 vs phase 2 correct for Image/Video/Workflow
- [ ] Timer format M:SS
- [ ] "Taking a moment longer..." after 16s standard modes
- [ ] Intervals cleaned up on unmount — no leaks
- [ ] ThinkingState.jsx untouched
- [ ] ExpandedDetailPanel.jsx untouched
- [ ] Lint clean
- [ ] No regression in other states/modes
