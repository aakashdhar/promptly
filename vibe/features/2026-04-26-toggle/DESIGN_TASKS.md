# DESIGN_TASKS — POLISH-TOGGLE (Expand/Collapse)
> Branch: feat/toggle-expand-collapse | Updated: 2026-04-26

---

## Task log

### TOGGLE-001 · Expand button in IdleState + collapse in PromptReadyState/PolishReadyState
- **Status**: [x] COMPLETE (initial implementation)
- **What was planned**: Four-corner arrow button in IdleState top-right; two-bar collapse button in PromptReadyState/PolishReadyState. Expand → PROMPT_READY, Collapse → IDLE. 
- **What happened**: Implemented correctly. IdleState expand button added (22×22px). Both PromptReadyState + PolishReadyState got collapse buttons. STATE_HEIGHTS.IDLE 118→134. DECISIONS.md D-POLISH-TOGGLE logged.
- **Files changed**: `src/renderer/components/IdleState.jsx`, `src/renderer/components/PromptReadyState.jsx`, `src/renderer/components/PolishReadyState.jsx`, `src/renderer/App.jsx`

### TOGGLE-002 · ExpandedIdleView.jsx — expanded IDLE view
- **Status**: [x] COMPLETE (initial) → ⚠️ WRONG IMPLEMENTATION → [x] REPLACED by BUG-TOGGLE-002
- **What was planned**: An ExpandedIdleView.jsx showing the three-zone layout for the IDLE state.
- **What happened**: Agent built a generic centred mic screen (reskin of IdleState.jsx), not the three-zone layout. Only IDLE state was gated behind `isExpanded`; other states (RECORDING, THINKING, PROMPT_READY) ignored `isExpanded`. Window height set to 560 (spec: 580).
- **BUG-TOGGLE-002**: Tore down ExpandedIdleView.jsx entirely. Created ExpandedView.jsx with full three-zone layout covering ALL states. App.jsx updated to render ExpandedView for all states when `isExpanded=true`. Height corrected to 580.
- **Files changed**: `src/renderer/components/ExpandedView.jsx` (new), `src/renderer/App.jsx` (ExpandedIdleView→ExpandedView import, gating logic, height fix)
- **Files deleted**: `src/renderer/components/ExpandedIdleView.jsx`

---

## Sign-off checklist
- [x] Expand button in IdleState (22×22px, top-right, four-corner arrow)
- [x] Collapse button in ExpandedView top bar (absolute top-right, 26×26px, two-bar)
- [x] isExpanded flag — layout mode, not state
- [x] Window 760×580 when expanded
- [x] ExpandedView renders correct three-zone layout
- [x] All states (IDLE, RECORDING, THINKING, PROMPT_READY) display correctly in expanded view
- [x] Normal (non-expanded) rendering path unchanged
- [x] Build passes, lint clean
- [x] CODEBASE.md, ARCHITECTURE.md, DECISIONS.md, TASKS.md updated
