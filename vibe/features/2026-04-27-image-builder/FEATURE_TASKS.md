# FEATURE-IMAGE-BUILDER Tasks

- [x] IMG-001 — useMode.js image mode + purple accent
  Touches: src/renderer/hooks/useMode.js
  Depends: —

- [x] IMG-002 — main.js MODE_CONFIG + show-mode-menu
  Touches: main.js
  Depends: IMG-001

- [x] IMG-003 — ImageBuilderState.jsx question component
  Touches: src/renderer/components/ImageBuilderState.jsx (new)
  Depends: IMG-001

- [x] IMG-004 — ImageBuilderDoneState.jsx final output component
  Touches: src/renderer/components/ImageBuilderDoneState.jsx (new)
  Depends: IMG-001

- [x] IMG-005 — App.jsx states + question flow state
  Touches: src/renderer/App.jsx
  Depends: IMG-003, IMG-004

- [x] IMG-006 — App.jsx navigation handlers
  Touches: src/renderer/App.jsx
  Depends: IMG-005

- [x] IMG-007 — App.jsx STATE_HEIGHTS
  Touches: src/renderer/App.jsx
  Depends: IMG-005

- [x] IMG-008 — history saving for image mode
  Touches: src/renderer/App.jsx, src/renderer/utils/history.js (call only)
  Depends: IMG-005

- [x] IMG-009 — expanded view 4-col grid + progress bar
  Touches: src/renderer/components/ImageBuilderState.jsx
  Depends: IMG-003, IMG-005

- [x] IMG-010 — docs update
  Touches: vibe/CODEBASE.md, vibe/DECISIONS.md, vibe/TASKS.md, vibe/SPEC.md
  Depends: IMG-001 through IMG-009
