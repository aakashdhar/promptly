# BUG_SPEC — Iterating stop button missing in expanded view

## Bug summary
In expanded view, ITERATING state has no stop button — the transport bar centre button calls `onStart` (starts a new recording) instead of `stopIterating`, and no blue waveform is shown.

## Files involved
- `src/renderer/components/ExpandedTransportBar.jsx` — transport bar, unaware of ITERATING state
- `src/renderer/components/ExpandedView.jsx` — orchestrator, never passes `stopIterating` to transport bar
- `src/renderer/App.jsx` — renders ExpandedView with `onStop={stopRecording}` but no `onStopIterate`

## Root cause hypothesis
`ExpandedTransportBar.jsx` derives `isRecording` as `currentState === 'RECORDING'` only. During ITERATING:
- `isRecording` is `false`
- Centre button onClick calls `onStart` (new main recording) instead of stopping iteration
- Waveform zone renders a flat line

`ExpandedView` never receives `stopIterating` from App.jsx and never forwards it to ExpandedTransportBar.

Confidence: **High** — traced from App.jsx line 411 (`onStop={stopRecording}`, no `stopIterating` passed) through ExpandedView.jsx (no `onStopIterate` prop) to ExpandedTransportBar.jsx (line 16–17, no ITERATING check).

## Blast radius
- Only affects expanded view in ITERATING state
- Minimized view unaffected (IteratingState.jsx has its own stop button)
- No data loss risk — iteration recording continues but user cannot stop it without collapsing the view

## Fix approach
1. `App.jsx`: Add `onStopIterate={stopIterating}` prop to `<ExpandedView>`
2. `ExpandedView.jsx`: Accept `onStopIterate` prop and pass to `<ExpandedTransportBar>`
3. `ExpandedTransportBar.jsx`:
   - Add `onStopIterate` prop
   - Add `isIterating = currentState === 'ITERATING'`
   - Centre button: `onClick={isRecording ? onStop : isIterating ? onStopIterate : onStart}`
   - Centre button icon: show stop square (white rect) when `isIterating`, mic otherwise
   - Centre button style: blue glow + blue background when `isIterating`
   - Waveform zone: render an IteratingWaveCanvas (or reuse MorphCanvas) when `isIterating`
   - Pulse rings: show blue variant when `isIterating`

## What NOT to change
- `IteratingState.jsx` (minimized view — works correctly)
- `ExpandedDetailPanel.jsx` (ITERATING panel text is fine)
- `useRecording.js` / `App.jsx` recording logic
- Any IPC channels

## Verification plan
1. Launch app in expanded view
2. Generate a prompt → PROMPT_READY
3. Tap ↻ Iterate → speak
4. Confirm: centre button shows stop affordance (blue), clicking it stops iteration
5. Confirm: blue waveform visible in transport bar during ITERATING
6. Confirm: minimized view iteration still works

## Regression test
No automated test framework — manual smoke: iterate in expanded view, confirm stop button stops iteration and transitions to THINKING/PROMPT_READY.
