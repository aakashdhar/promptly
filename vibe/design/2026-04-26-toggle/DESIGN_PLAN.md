# Toggle Implementation Plan

## Tasks
TOG-001 (S) — IdleState.jsx: update traffic lights row to flex space-between layout,
  add expand button right side, update bottom tagline to bottom:10px, update height to 134px

TOG-002 (S) — App.jsx: increase STATE_HEIGHTS.IDLE from 118 to 134,
  add onExpand prop handler that transitions to PROMPT_READY,
  add onCollapse prop to both PromptReadyState and PolishReadyState

TOG-003 (S) — PromptReadyState.jsx + PolishReadyState.jsx: add collapse button
  absolute top:14px right:16px, onCollapse prop that returns to IDLE

TOG-005 (S) — lint + smoke test both directions, verify content row unchanged,
  verify window resize fires: expand → 560px (PROMPT_READY), collapse → 134px (IDLE)

## Files in scope
- src/renderer/components/IdleState.jsx
- src/renderer/App.jsx (STATE_HEIGHTS.IDLE + prop handlers only)
- src/renderer/components/PromptReadyState.jsx (collapse button addition only)
- src/renderer/components/PolishReadyState.jsx (collapse button addition only)

## Files out of scope (do not touch)
- All hooks
- All utils
- preload.js
- main.js
- index.css
- All other components
