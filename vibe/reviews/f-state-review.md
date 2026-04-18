# F-STATE Review — Promptly
> Reviewed: 2026-04-18 | Reviewer: vibe-review skill
> Scope: FST-001 through FST-005 (State machine + full UI skeleton)
> Files: index.html (state machine, CSS, DOM), main.js (resize-window IPC, window position), preload.js (resizeWindow + IPC listeners)

---

## Automated checks

```
npm run lint   → 0 errors, 6 warnings (console.log in main.js — expected dev logs, clean before release)
npm audit      → 2 low severity vulnerabilities (@eslint/plugin-kit — devDep only, not runtime)
Tests          → No test runner configured (manual smoke test per ARCHITECTURE.md)
```

No blocking errors. `npm audit fix --force` would upgrade ESLint past stated range — hold until ESLint is separately upgraded. Low severity, devDep only — not a runtime risk.

---

## Carryover from Phase 1 Review (2026-04-18)

| ID | Issue | Status |
|----|-------|--------|
| BL-001 | generate-prompt sends two separate args — wrong shape | ✅ RESOLVED — preload.js:7-8 now sends `{ transcript, mode }` |
| BL-002 | check-claude-path missing `found` boolean | ✅ RESOLVED — main.js:92-97 returns `{ found: true/false, path/error }` |
| BL-003 | Window not positioned — SPEC requires centred, near bottom | ✅ RESOLVED — main.js:14-21 adds `x` / `y` from workAreaSize |
| BL-004 | copy-to-clipboard payload/return diverge from SPEC (`{ text }` / `{ success }`) | ⚠️ STILL OPEN — preload.js:11, main.js:80-83 still use raw string / `{ ok: true }` |
| BL-005 | shortcut-conflict sends no payload — SPEC requires `{ fallback }` | ⚠️ STILL OPEN — main.js:67 still sends no second argument |
| BL-006 | index.html lint exclusion undocumented | ✅ RESOLVED — D-001 added to DECISIONS.md |

3 of 3 P1s resolved. 2 of 3 P2s still open (BL-004, BL-005) — carried forward.

---

## Architecture drift

### 🔴 ARCHITECTURE DRIFT — IPC surface table not updated after FST-004

**Decision:** ARCHITECTURE.md "IPC surface" section documents all 5 IPC channels. D-002 in DECISIONS.md logs the addition of `resize-window` as a justified deviation — but the authoritative table in ARCHITECTURE.md itself was never updated.

**Found:** `vibe/ARCHITECTURE.md` lines 112–120 — table has 5 channels, no `resize-window` row.

**Decision origin:** ARCHITECTURE.md rule — "Main process responds via `ipcMain.handle` ... All IPC surface documented here." D-002 (DECISIONS.md) documents the channel exists but the table is stale.

**Impact:** Future feature agents read ARCHITECTURE.md as the IPC source of truth. If `resize-window` is missing, F-SPEECH or F-CLAUDE could register a duplicate handler or assume the channel doesn't exist.

**Fix:** Add `resize-window` row to the ARCHITECTURE.md IPC surface table:
```
| renderer → main | `resize-window` | Resize BrowserWindow height per state (STATE_HEIGHTS) |
```

---

## Findings

### 🔴 P1-F01 — ARCHITECTURE.md IPC surface table stale — resize-window missing

(Full detail above in drift section.)

**File:** `vibe/ARCHITECTURE.md` lines 112–120
**Fix:** Add `resize-window` row to the IPC surface table. One line change.

---

### 🟡 P2-F01 — Direct DOM visibility mutation outside setState() — conflict notice

**File:** `index.html` line 363

**Evidence:**
```js
window.electronAPI.onShortcutConflict(() => {
  document.getElementById('idle-conflict-notice').hidden = false; // ← direct DOM mutation
});
```

**ARCHITECTURE.md says:** "setState is the only place DOM class changes and element visibility are toggled."

**Context:** This pattern was explicitly spec'd in FST-005 FEATURE_TASKS.md. It works correctly. However it creates a second DOM mutation path that violates the single-control-point rule. If setState('IDLE') is ever called again (e.g., from ERROR dismiss), the conflict notice is NOT re-hidden — `setState` doesn't know about the `hidden` property on this sub-element. This is a latent state reset bug.

**Fix:** Move conflict-notice visibility into setState():
```js
// In setState(), when newState === 'IDLE':
if (newState === 'IDLE' && payload.conflictNotice) {
  document.getElementById('idle-conflict-notice').hidden = false;
}
// In onShortcutConflict listener:
window.electronAPI.onShortcutConflict(() => {
  setState('IDLE', { conflictNotice: true });
});
```
Or simpler: reset `idle-conflict-notice.hidden = true` at the top of setState() when showing IDLE, so any setState('IDLE') call correctly resets it.

---

### 🟡 P2-F02 — ARCHITECTURE.md localStorage section only documents 2 of 4 wrapper functions

**File:** `vibe/ARCHITECTURE.md` lines 76–77

**Evidence:**
```
localStorage accessed only via two wrapper functions: `getMode()` and `setMode()` — never `localStorage.*` directly in other code.
```

FST-001 added `getFirstRunComplete()` and `setFirstRunComplete()` (index.html:314–318) — correct per CLAUDE.md and spec, but ARCHITECTURE.md wasn't updated to reflect the full wrapper surface.

**Impact:** Future agents reading ARCHITECTURE.md will think only 2 wrappers exist, may be confused about `getFirstRunComplete()` or re-implement it differently.

**Fix:** Update ARCHITECTURE.md line 76–77:
```
localStorage accessed only via four wrapper functions: `getMode()`, `setMode()`, `getFirstRunComplete()`, `setFirstRunComplete()` — never `localStorage.*` directly in other code.
```

---

### 🟡 P2-F03 — BL-004 still open: copy-to-clipboard payload diverges from SPEC

*(Carried from Phase 1 — see backlog entry)*

`preload.js:11` sends raw string. `main.js:80-83` receives raw string, returns `{ ok: true }`. SPEC contract is `{ text }` payload, `{ success }` return.

---

### 🟡 P2-F04 — BL-005 still open: shortcut-conflict sends no fallback payload

*(Carried from Phase 1 — see backlog entry)*

`main.js:67` sends `shortcut-conflict` event with no payload. SPEC requires `{ fallback: SHORTCUT_FALLBACK }`. Renderer cannot display which fallback shortcut is active.

---

### 🔵 P3-F01 — CODEBASE.md phase status stale

**File:** `vibe/CODEBASE.md` line 10

**Evidence:** `**Phase:** Phase 2 in progress — F-STATE (4/5 tasks done)` — FST-005 is complete, F-STATE is 5/5.

**Fix:** Update to `F-STATE complete (5/5) — F-FIRST-RUN or F-SPEECH next`.

---

### 🔵 P3-F02 — getMode() called twice in boot sequence

**File:** `index.html` lines 372–373

**Evidence:**
```js
document.getElementById('idle-mode-label').textContent =
  getMode().charAt(0).toUpperCase() + getMode().slice(1);
```

Two `getMode()` calls for one label. Minor — localStorage access is synchronous and cheap — but the intent is clearer with one call:
```js
const mode = getMode();
document.getElementById('idle-mode-label').textContent =
  mode.charAt(0).toUpperCase() + mode.slice(1);
```

---

### 🔵 P3-F03 — setState guard uses truthiness check on height value

**File:** `index.html` line 322

**Evidence:**
```js
if (!STATE_HEIGHTS[newState]) {
```

All current heights are positive integers (44, 80, 120, 200) so this works. If a state with height `0` were ever added, it would incorrectly log an error and return. More robust: `if (STATE_HEIGHTS[newState] === undefined)`.

---

## Strengths

- **All 3 Phase 1 P1 fixes applied cleanly** — IPC arg shape (preload.js:7-8), `check-claude-path` return shape (main.js:92-97), and window position (main.js:14-21). No regressions.
- **setState() pattern is solid** — single control point, panel loop is readable, payload handling uses `textContent` exclusively (index.html:337, 340). No innerHTML violations.
- **localStorage wrappers are correct** — all 4 functions guard with try/catch, correct default for `getMode()` and `getFirstRunComplete()` (index.html:308–318).
- **IPC listener pattern is clean** — `onShortcutTriggered` and `onShortcutConflict` registered once at DOMContentLoaded (index.html:351, 362). No dynamic listener attachment.
- **Stub comment correctly placed** — `// F-SPEECH: replace stub` on line 356 makes the stub's intent clear to the next feature agent.
- **D-002 decision log** — resize-window IPC addition is documented with reasoning and alternatives considered.
- **CSS is complete and drift-free** — all 6 states styled, no hardcoded hex values outside `:root`, 150ms opacity transitions only, `@keyframes` for spinner and blink (correct use per ARCHITECTURE.md:101).
- **Security posture maintained** — contextIsolation + nodeIntegration false unchanged (main.js:29-30), all dynamic text via textContent.

---

## Quality score

| Category | Score |
|----------|-------|
| Start | 10.0 |
| P1 findings (1 × −0.5) | −0.5 |
| P2 findings (4 × −0.2) | −0.8 |
| P3 findings (3 × −0.1) | −0.3 |
| Architecture drift (1 × −0.5) | −0.5 |
| **Total** | **7.9 / 10** |

**Grade: B** — F-STATE is functionally complete and architecturally sound. The state machine core (setState, panel switching, window resize) is correct. The two open issues are a stale ARCHITECTURE.md table (quick fix) and a latent state reset bug in the conflict notice (P2 — doesn't affect current feature, will affect F-FIRST-RUN if the shortcut conflict fires then IDLE is re-entered).

---

## Summary

F-STATE shipped cleanly. The Phase 1 P1 fixes were all applied correctly — IPC arg shape, return shape, and window position are now correct. The state machine itself is well-implemented: single setState() control point, correct panel switching, textContent-only dynamic text, complete CSS.

The main issues are documentation drift (ARCHITECTURE.md IPC table missing `resize-window`) and a latent bug in the conflict-notice pattern (direct DOM mutation outside setState() will cause the notice to persist across state transitions). Neither blocks the gate, but both should be fixed before F-FIRST-RUN starts building on top of this foundation.

No P0 findings. Gate passes.
