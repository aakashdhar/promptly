# BUG_SPEC — BUG-TOGGLE-002
> Expanded view renders generic centred mic screen instead of three-zone layout.
> Date: 2026-04-26 | Branch: feat/toggle-expand-collapse

---

## Bug summary
`ExpandedIdleView.jsx` renders a generic centred mic screen (a reskin of IdleState.jsx) instead of the specified three-zone layout. Additionally, App.jsx only gates IDLE state behind the `isExpanded` flag — all other states (RECORDING, THINKING, PROMPT_READY) render their normal components ignoring `isExpanded`, so the expanded layout is completely absent for those states.

## Files involved
- `src/renderer/components/ExpandedIdleView.jsx` — wrong component entirely
- `src/renderer/App.jsx` — incorrect gating; only IDLE swaps to ExpandedIdleView; height in handleExpand is 560 (spec: 580)

## Root cause hypothesis (confidence: very high)
The previous agent implemented `ExpandedIdleView.jsx` as a standalone centered screen matching only the IDLE state, ignoring:
1. The spec requirement for a three-zone layout (top bar / left history panel / right state-content)
2. The fact that the expanded view is a layout MODE, not a separate state — all existing states must render within it
3. That window height should be 580 (handleExpand hardcodes 560)

Specific code evidence:
- `ExpandedIdleView.jsx:13-148` — `flexDirection:'column'` layout, centered mic icon, no zones
- `App.jsx:399-419` — IDLE gates on `!isExpanded`/`isExpanded`; RECORDING line 420 has no `isExpanded` guard
- `App.jsx:120` — `window.electronAPI.setWindowSize(760, 560)` — wrong height

## Blast radius
- Expanded view broken for RECORDING, THINKING, PROMPT_READY (those states render as narrow 520px panels inside a 760px window)
- Left history panel does not exist
- Top transport bar does not exist
- Right panel state-content does not exist
- Window height 20px short of spec

## Fix approach
1. Create `src/renderer/components/ExpandedView.jsx` — full three-zone layout
2. Update App.jsx: when `isExpanded=true`, render `<ExpandedView>` as the sole renderer (replaces all state conditionals); when `isExpanded=false`, render existing state components unchanged
3. Fix `handleExpand()`: height 560 → 580
4. Remove `ExpandedIdleView` import from App.jsx; delete `ExpandedIdleView.jsx`

## What NOT to change
- All hook logic (useRecording, useKeyboardShortcuts, usePolishMode, useMode, useWindowResize)
- Normal (non-expanded) rendering path — all existing state components untouched
- Any IPC channels or main.js / preload.js

## Verification plan
1. `npm run build:renderer` — must succeed
2. `npm run lint` — 0 errors
3. Walk full smoke checklist (9 items)

## Regression test
Build success + lint clean = regression gate (no unit test framework in project).
