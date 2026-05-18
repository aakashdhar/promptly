# BUG_TASKS — s1-notresponding path override
> Date: 2026-05-18

---

### BUG-NVM-001 · Regression baseline — confirm gap exists
- **Status**: `[ ]` | **Depends on**: None | **Touches**: none (read-only)

**What to do**: Grep splash.html to confirm `s1-notresponding` div has no path input. Also confirm `runScreen1()` does not set any path input when routing to `s1-notresponding`.

```bash
grep -n "s1-notresponding" splash.html
grep -n "s1NotrespondingUseManualPath\|s1-notresponding-path" splash.html
```

Expected: `s1-notresponding-path` appears ZERO times — confirms the gap.

**Acceptance criteria**:
- [ ] `grep 's1-notresponding-path' splash.html` returns no results
- [ ] Gap confirmed — safe to proceed with fix

**⚠️ Boundaries**: Read-only. Do not touch any file.
**Decisions**: > Filled in by agent. None yet.

---

### BUG-NVM-002 · Implement fix — path input + function + pre-populate
- **Status**: `[ ]` | **Depends on**: BUG-NVM-001 | **Touches**: `splash.html`
- **CODEBASE.md update**: Yes — splash.html row: add `s1NotrespondingUseManualPath()`, update s1-notresponding description

**What to do** (three changes to `splash.html`, per BUG_PLAN.md):

**Change A** — Inside `<div id="s1-notresponding">`, after the `<div class="wz-note">` (last child), add the "Not the right path?" card with `#s1-notresponding-path` input + "Use this path →" button.

**Change B** — After `s1UseManualPath()` function, add `s1NotrespondingUseManualPath()`:
```js
async function s1NotrespondingUseManualPath() {
  const val = document.getElementById('s1-notresponding-path').value.trim();
  if (!val) return;
  const stored = await window.electronAPI.getStoredPaths();
  await window.electronAPI.savePaths({ claudePath: val, whisperPath: stored.whisperPath || '', ffmpegPath: stored.ffmpegPath || '' });
  runScreen1();
}
```

**Change C** — In `runScreen1()`, in the `!result.working` branch, add before `s1ShowError`:
```js
document.getElementById('s1-notresponding-path').value = result.path || '';
```

**Acceptance criteria**:
- [ ] `#s1-notresponding-path` input exists inside `s1-notresponding` div
- [ ] Input has `-webkit-app-region:no-drag` (copy exact inline style from `#s1-manual-path`)
- [ ] "Use this path →" button has `-webkit-app-region:no-drag`
- [ ] `s1NotrespondingUseManualPath()` reads from `#s1-notresponding-path`, not `#s1-manual-path`
- [ ] `runScreen1()` sets `s1-notresponding-path` value from `result.path` before showing state
- [ ] `s1-notfound` "Already installed?" card is unchanged
- [ ] CODEBASE.md splash.html row updated

**⚠️ Boundaries**: Only `splash.html`. Never modify `s1UseManualPath()` or any other existing function.
**Decisions**: > Filled in by agent. None yet.

---

### BUG-NVM-003 · Verify fix and run lint
- **Status**: `[ ]` | **Depends on**: BUG-NVM-002 | **Touches**: none

**What to do**:
1. Grep to confirm the fix exists: `grep -n "s1-notresponding-path\|s1NotrespondingUseManualPath" splash.html`
2. Run lint: `npm run lint 2>&1 | tail -10` — must be 0 errors (lint only covers main.js + preload.js; splash.html is vanilla JS reviewed manually)
3. Visual smoke: `npm start` → open splash → simulate `s1-notresponding` by temporarily modifying runScreen1() to call `s1ShowError('s1-notresponding', false)` early, or confirm via `check-claude` returning working:false

**Acceptance criteria**:
- [ ] `s1-notresponding-path` appears in splash.html
- [ ] `s1NotrespondingUseManualPath` appears in splash.html
- [ ] `npm run lint` → 0 errors
- [ ] Input is visible and pre-populated in the not-responding state

**Decisions**: > Filled in by agent. None yet.

---

### BUG-NVM-004 · Update docs and DECISIONS.md
- **Status**: `[ ]` | **Depends on**: BUG-NVM-003 | **Touches**: `vibe/CODEBASE.md`, `vibe/DECISIONS.md`

**What to do**:
1. `vibe/CODEBASE.md` — splash.html row: add `s1NotrespondingUseManualPath()` to listed JS functions; update s1-notresponding description to note it now has path override
2. `vibe/DECISIONS.md` — append bug fix entry (see template below)

DECISIONS.md entry:
```
---
### D-BUG-NVM-PATH — Bug fix: s1-notresponding missing path override
- **Date**: 2026-05-18 · **Type**: drift (UX gap — missing escape hatch)
- **Folder**: vibe/bugs/2026-05-18-s1-notresponding-path-input/
- **Root cause**: s1-notresponding (Claude found but failing) had no manual path input; s1-notfound had one but s1-notresponding was missed in the 2026-04-30 BUG-ONBOARDING-MANUAL-PATH fix
- **Files in scope**: splash.html only
- **Fix approach**: added #s1-notresponding-path input + s1NotrespondingUseManualPath() function; runScreen1() pre-populates input with result.path
- **CODEBASE.md update**: Yes — splash.html row updated
- **ARCHITECTURE.md update**: No
- **Deviations from BUG_PLAN.md**: none
---
```

**Acceptance criteria**:
- [ ] CODEBASE.md splash.html row mentions `s1NotrespondingUseManualPath()`
- [ ] DECISIONS.md has D-BUG-NVM-PATH entry

**Decisions**: > Filled in by agent. None yet.

---

#### Bug Fix Sign-off: s1-notresponding path override
- [ ] `#s1-notresponding-path` input exists in `s1-notresponding` div with no-drag
- [ ] `s1NotrespondingUseManualPath()` added — reads correct input, preserves other stored paths
- [ ] `runScreen1()` pre-populates path input from `result.path`
- [ ] `s1-notfound` "Already installed?" card unchanged
- [ ] Lint clean (npm run lint → 0 errors)
- [ ] CODEBASE.md updated
- [ ] DECISIONS.md updated
- [ ] Doc commits separate from code commits
---
