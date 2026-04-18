# BUG_TASKS — BUG-003

### BUG-003-1 · Write regression test (manual smoke checklist)
- **Status**: `[x]` — manual smoke test is the test suite (no automated tests in v1)
- Pre-fix: ghost visible in RECORDING, traffic dots at bottom, blank flash, ghost in PROMPT_READY

### BUG-003-2 · Implement fix
- **Status**: `[ ]`
- A: Create `pill.html` + add pillWin lifecycle to `main.js` + update `preload.js` + remove pill markup from `index.html`
- B: `.traf { align-items: center }` in `index.html`
- C: Wrap all `resizeWindow` calls in `requestAnimationFrame` in `index.html`
- D: `#bar { min-height: 100vh }` in `index.html`

### BUG-003-3 · Verify
- **Status**: `[ ]`
- Run app, exercise all 4 fixed states, run lint

### BUG-003-4 · Update docs
- **Status**: `[ ]`
- Update CODEBASE.md, DECISIONS.md, TASKS.md

---
#### Sign-off checklist
- [ ] Ghost behind pill: gone
- [ ] Traffic lights centred
- [ ] No blank flash before THINKING
- [ ] No ghost below PROMPT_READY
- [ ] Lint clean
- [ ] CODEBASE.md updated
