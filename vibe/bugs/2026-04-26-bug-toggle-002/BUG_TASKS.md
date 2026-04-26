# BUG_TASKS — BUG-TOGGLE-002
> Expanded view renders generic centred mic screen instead of three-zone layout.
> Date: 2026-04-26 | Branch: feat/toggle-expand-collapse

---

### BUG-TOGGLE-002-001 · Regression baseline
- **Status**: [x] COMPLETE
- **Touches**: none (read-only verification)

**What was done**: Confirmed lint passes (0 errors). Build passes. Visually confirmed `ExpandedIdleView.jsx` was a generic centred mic screen. Confirmed App.jsx only gated IDLE on `isExpanded`; RECORDING/THINKING/PROMPT_READY all bypassed the check.

**Acceptance criteria**:
- [x] Lint passes on current broken code
- [x] Build passes on current broken code
- [x] Bug confirmed exactly as described

---

### BUG-TOGGLE-002-002 · Create ExpandedView.jsx
- **Status**: [x] COMPLETE
- **Touches**: `src/renderer/components/ExpandedView.jsx` (new)

**What was done**: Created full three-zone layout component (~320 lines). Zone 1: top bar with traffic-light spacer, collapse button (abs top-right), transport row (pause + timer / 52px record button / mode pill), 36px waveform strip (WaveformCanvas for RECORDING, MorphCanvas for THINKING, flat hairline otherwise). Zone 2: 228px left panel with SESSION HISTORY label and scrollable history list (getHistory() on mount + currentState change). Zone 3: right panel with state-specific content — IDLE (centred "Speak your prompt"), RECORDING ("Listening..."), PAUSED (amber "Paused"), THINKING (skeleton bars), PROMPT_READY (header + two-column section grid + action row with Edit/Copy).

**Acceptance criteria**:
- [x] Component file exists at correct path
- [x] Three zones present: top bar, left panel, right panel
- [x] All required states rendered in right panel
- [x] WaveformCanvas/MorphCanvas imported with RAF cleanup via their own useEffect

---

### BUG-TOGGLE-002-003 · Update App.jsx
- **Status**: [x] COMPLETE
- **Touches**: `src/renderer/App.jsx`

**What was done**:
- Replaced `import ExpandedIdleView` with `import ExpandedView`
- Added `EXPANDED: 580` to STATE_HEIGHTS
- Fixed `handleExpand()`: `setWindowSize(760, 560)` → `setWindowSize(760, STATE_HEIGHTS.EXPANDED)`
- Replaced all individual state conditionals: when `isExpanded=true` → single `<ExpandedView {...props} />`; when `isExpanded=false` → existing state components (unchanged)
- Removed inline collapse button (now inside ExpandedView top bar)
- Deleted `ExpandedIdleView.jsx` (was untracked; removed from disk)

**Acceptance criteria**:
- [x] Only ExpandedView imported (ExpandedIdleView gone)
- [x] All states gated behind isExpanded check
- [x] handleExpand height uses STATE_HEIGHTS.EXPANDED (580)
- [x] Inline collapse button removed from App.jsx

---

### BUG-TOGGLE-002-004 · Verify
- **Status**: [x] COMPLETE

**What was done**:
- `npm run build:renderer` — ✅ built in 128ms, 0 errors
- `npm run lint` — ✅ 0 errors
- Code committed: `fix(toggle): BUG-TOGGLE-002 — tear down ExpandedIdleView, rebuild as three-zone ExpandedView`

**Smoke checklist** (human must verify in running app):
- [ ] Three zones render correctly — top bar, left panel, right panel
- [ ] Transport bar has centred recording button with flanking controls
- [ ] Waveform zone renders below transport
- [ ] History list renders in left panel with entries
- [ ] Right panel shows correct content for current app state
- [ ] Collapse button top-right returns to minimized bar
- [ ] Recording works from expanded view
- [ ] Prompt ready shows two-column layout in right panel
- [ ] Window is 760px wide × 580px tall in expanded state

---

### BUG-TOGGLE-002-005 · Update docs
- **Status**: [x] COMPLETE
- **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`, `vibe/TASKS.md`, `vibe/ARCHITECTURE.md`, `vibe/features/2026-04-26-toggle/DESIGN_TASKS.md`, `vibe/features/2026-04-26-toggle/DESIGN_SPEC.md`

**What was done**:
- CODEBASE.md: Added ExpandedView.jsx to file map; added EXPANDED=580 to STATE_HEIGHTS table
- ARCHITECTURE.md: Added `isExpanded` layout mode section to state management rules
- DECISIONS.md: Appended D-BUG-TOGGLE-002 entry
- TASKS.md: Added BUG-TOGGLE-002 complete block; updated "What just happened"
- vibe/features/2026-04-26-toggle/: Created DESIGN_SPEC.md and DESIGN_TASKS.md with full spec + task log

---

#### Bug Fix Sign-off: BUG-TOGGLE-002
- [x] Build passes (128ms, 0 errors)
- [x] Lint clean (0 errors)
- [x] Only files in BUG_PLAN.md scope modified
- [x] CODEBASE.md updated — ExpandedView.jsx added, EXPANDED=580 noted
- [x] ARCHITECTURE.md updated — isExpanded layout mode section added
- [x] DECISIONS.md updated — D-BUG-TOGGLE-002 appended
- [ ] Human smoke test — 9 checklist items (pending human verification in running app)
