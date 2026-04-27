# BUG_PLAN — Iterating stop button missing in expanded view

## Exact files to modify
1. `src/renderer/App.jsx` — add `onStopIterate={stopIterating}` to ExpandedView
2. `src/renderer/components/ExpandedView.jsx` — accept + forward `onStopIterate` prop
3. `src/renderer/components/ExpandedTransportBar.jsx` — handle ITERATING state in transport bar

## Exact files NOT to touch
- `src/renderer/components/IteratingState.jsx`
- `src/renderer/components/ExpandedDetailPanel.jsx`
- `src/renderer/hooks/useRecording.js`
- `main.js`, `preload.js`
- Any test files

## Change description

### App.jsx (line ~401)
Add `onStopIterate={stopIterating}` prop to `<ExpandedView>`.

### ExpandedView.jsx
- Add `onStopIterate` to props destructuring
- Pass `onStopIterate={onStopIterate}` to `<ExpandedTransportBar>`

### ExpandedTransportBar.jsx
- Add `onStopIterate` to props destructuring
- Add `const isIterating = currentState === 'ITERATING'`
- Centre button click: `onClick={isRecording ? onStop : isIterating ? onStopIterate : onStart}`
- Centre button background: blue (`rgba(10,132,255,0.95)`) + blue glow when `isIterating`
- Centre button icon: stop square (white rect) when `isRecording || isIterating`, mic otherwise
- Pulse rings: show blue variant (`rgba(10,132,255,0.3)` / `rgba(10,132,255,0.15)`) when `isIterating`
- Waveform zone: render `<MorphCanvas />` (already imported) when `isIterating` — reuse the blue morph wave
- Pause button: apply reduced opacity when `isIterating` (same as `isTyping`) since pause doesn't apply to iteration

## Conventions
- `isIterating` pattern matches `isRecording`, `isThinking`, `isTyping` pattern already in file
- Inline styles only — no Tailwind
- MorphCanvas already imported in ExpandedTransportBar — reuse it

## Side effects check
- `onStart` is only called when not recording and not iterating → no double-start risk
- `onStop` (stopRecording) remains wired to isRecording only → no cross-call risk

## CODEBASE.md update needed
Yes — update ExpandedTransportBar props table to include `onStopIterate`

## ARCHITECTURE.md update needed
No
