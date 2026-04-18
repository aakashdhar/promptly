# Final Review — Promptly
> Reviewed: 2026-04-18 | Reviewer: vibe-review skill
> Scope: Full codebase — main.js · preload.js · index.html · splash.html · package.json

---

## Automated checks

```
npm test    → No test runner configured — manual smoke test is the test suite (ARCHITECTURE.md)
npm run lint → 0 errors, 6 warnings (console.log in main.js — must clean before release)
npm audit   → 2 low severity vulnerabilities in eslint devDep only (@eslint/plugin-kit)
              No high/critical. devDep only — not included in .dmg distribution.
```

**Lint output:**
```
main.js
  71:9  warning  Unexpected console statement  no-console
  74:9  warning  Unexpected console statement  no-console
  86:5  warning  Unexpected console statement  no-console
  92:7  warning  Unexpected console statement  no-console
  97:7  warning  Unexpected console statement  no-console
 138:5  warning  Unexpected console statement  no-console
```

---

## Dependency graph pre-screening

Graph exists (`vibe/graph/CONCEPT_GRAPH.json`). No cross-file imports to check — this is a 3-file
vanilla JS app (no ES module imports, no require() in renderer). Pre-screening is N/A; full review performed.

---

## Carryover check

All issues from Phase 1, F-STATE, and Phase 2 reviews are resolved:

| ID | Finding | Status |
|----|---------|--------|
| BL-013 | renderPromptOutput regex (plain-text labels) | ✅ resolved |
| BL-014 | RAF loop leak in setState(THINKING) | ✅ resolved |
| BL-015 | CODEBASE.md stale | ✅ resolved |
| BL-016 | shell.openExternal URL unvalidated | ✅ resolved |
| BL-017 | 30s vs 60s timeout — SPEC/code mismatch | ✅ resolved (D-005 logged) |
| BL-018 | set-window-buttons-visible undocumented | ✅ resolved (D-006 + ARCH updated) |
| BL-019 | SPEC.md stale | ✅ resolved |
| BL-020 | FIRST_RUN removal undocumented | ✅ resolved (D-007 logged) |
| BL-021 | Dead code: startMorphAnim | ✅ resolved |
| BL-022 | Error message truncated to 60 chars | ✅ resolved |
| BL-023 | inline onclick in splash.html | ✅ resolved |
| BL-024 | 2 low severity npm audit devDep vulns | ⬜ open (carry forward — P3) |

**No P1 carryover from Phase 2.**

---

## Architecture drift detection

Checked every section of ARCHITECTURE.md against running code.

### ✅ No P0 drift found

| Rule | Code location | Status |
|------|---------------|--------|
| PATH resolution via `zsh -lc "which claude"` | main.js:68 | ✅ |
| `spawn()` with args array (no shell injection) | main.js:203 | ✅ |
| All IPC via contextBridge / preload.js | preload.js:5-50 | ✅ |
| `setState()` as sole DOM mutation point | index.html:625 | ✅ |
| `textContent` for all dynamic user content | index.html:577, 611, 640, 663 | ✅ |
| `getMode()`/`setMode()` wrappers only | index.html:465-474 | ✅ |
| `originalTranscript` captured once, never mutated | index.html:764 | ✅ |
| `nodeIntegration: false, contextIsolation: true` | main.js:121-122, 154-155 | ✅ |
| Zero runtime npm dependencies | package.json | ✅ |
| RAF loop cancellation (BL-014 fix verified) | index.html:513-516, 667 | ✅ |

### 🟡 DRIFT-001 — Hardcoded hex values bypass CSS token definitions

**Section violated:** "Frontend patterns — Styling" (ARCHITECTURE.md line 101)

**Decision:** "No hardcoded hex values outside the token definitions."

**Found:** `index.html`
- Line 181: `.pr-check { color: #30D158; }` — token `--green: #30D158` exists but not referenced
- Line 188: `.pr-btn:hover { color: #0A84FF; }` — token `--blue: #0A84FF` exists but not referenced
- Line 276: `.stop-btn { background: #FF3B30; }` — token `--red: #FF3B30` exists but not referenced

**Impact:** Low — values are identical to tokens, no visual regression. Future colour changes require updating multiple sites instead of one token.

**Fix:**
```css
.pr-check { color: var(--green); }
.pr-btn:hover { color: var(--blue); }
.stop-btn { background: var(--red); }
```

---

## Findings

### 🔴 P1-001 — 6 console.log statements must be removed before release

**File:** `main.js` lines 71, 74, 86, 92, 97, 138

**Evidence:**
```js
// main.js:71, 74 — claudePath resolution logs
console.log('claudePath: not resolved —', err?.message);
console.log('claudePath:', p);

// main.js:86, 92, 97 — shortcut registration logs
console.log('Shortcut registered:', SHORTCUT_PRIMARY);
console.log('Shortcut registered (fallback):', SHORTCUT_FALLBACK);
console.log('Shortcut registration failed for both...

// main.js:138 — whisperPath resolution log
console.log('whisperPath:', whisperPath || 'not found');
```

**Rule:** ARCHITECTURE.md code quality section: "`no-console` (warn) — `console.log` allowed during dev, **clean before release**." This is the final review.

**Impact:** All 6 logs write to the Electron console on every app launch. In a distribution build, these are visible to users who open DevTools and produce unnecessary noise in support scenarios.

**Fix:** Remove all 6 `console.log` calls. claudePath and whisperPath resolution success/failure is already communicated to the renderer via IPC (`splash-check-cli`, error state). No information is lost.

---

### 🔴 P1-002 — Manual smoke test not completed

**File:** `vibe/TASKS.md` line 113

**Evidence:**
```
⬜ Manual smoke test — exercise all 5 states × all 5 modes; check shortcut conflict notice;
   verify no hangs; test Regenerate 5× to confirm no RAF accumulation after BL-014 fix
```

**Rule:** ARCHITECTURE.md testing section: "Manual smoke test: All 6 states, all 5 modes — Before every release." Phase 3 exit condition in TASKS.md: "Phase 3 exit: run `review: final` — 0 P0 + 0 P1 before distributing."

**Impact:** BL-014 (RAF loop leak) was fixed — but the 5× Regenerate test to verify no accumulation has not been run. Without this, the fix is unverified in the running app.

**Note:** This is a **human-only** prerequisite. Agent cannot exercise the app. Fix: run the smoke test checklist in TASKS.md, then mark ⬜ → ✅.

---

### 🟡 P2-001 — CSS hardcoded hex values bypass design tokens (DRIFT-001 detail)

**File:** `index.html` lines 181, 188, 276

**See DRIFT-001 above for full detail.**

---

### 🟢 P3-001 — BL-024 carryover: 2 low severity npm audit devDep vulns

**Package:** `@eslint/plugin-kit <0.3.4` (ReDoS vulnerability in ConfigCommentParser)

**Impact:** devDep only — not included in any .dmg distribution. No runtime exposure. Low severity.

**Fix:** `npm audit fix --force` (installs eslint@9.39.4+) when convenient. Not blocking.

---

## Strengths

- **BL-014 fix confirmed in code** — `morphAnimFrame = requestAnimationFrame(animMorph)` correctly stores the handle; `stopMorphAnim()` at every `setState()` entry guarantees cancellation. RAF accumulation bug is fixed at the source.
- **BL-013 fix confirmed** — `renderPromptOutput` regex `/^([A-Za-z][A-Za-z\s]*):\s*$/` correctly matches `Role:`, `Task:`, `Context:`, etc. Section headers will render as `.pt-sl` spans.
- **Security posture: excellent** — `contextIsolation: true`, `nodeIntegration: false` on both windows (main.js:121-122, 154-155). Zero runtime deps = zero supply chain surface. shell.openExternal guarded by `https://` prefix check (main.js:183). All dynamic text via `textContent`.
- **originalTranscript immutability verified** — captured once at `stopRecording()` onstop (index.html:764), never written again. Regenerate (index.html:842) and Edit mode (index.html:807) only write `generatedPrompt`.
- **IPC surface clean** — all 13 channels match ARCHITECTURE.md table. No undocumented channels. contextBridge-only pattern throughout preload.js.
- **State machine discipline** — every DOM visibility change routes through `setState()`. No mutations outside it found anywhere in index.html.
- **Error paths complete** — generate-prompt handler resolves exactly once (double-resolve guarded), propagates specific error strings to renderer, timeout kills the child process. Regenerate path also propagates specific errors.
- **DECISIONS.md audit trail** — D-001 through FEATURE-001, BUG-001 through BUG-008 all logged with root causes. Every deviation from the original plan is explained and approved.

---

## Quality score

| Category | Calculation | Score |
|----------|------------|-------|
| Start | — | 10.0 |
| P1 findings (2 × −0.5) | console.log cleanup, smoke test | −1.0 |
| P2 findings (1 × −0.2) | CSS token bypass | −0.2 |
| P3 findings (1 × −0.1) | BL-024 npm audit carryover | −0.1 |
| Architecture drift (0 new × −0.5) | — | 0.0 |
| **Total** | | **8.7 / 10** |

**Grade: B+** — All Phase 2 P1s are verified fixed. Security posture and core architecture are excellent. The two P1s holding the gate are both small and well-defined: a 5-minute lint cleanup and a human-run smoke test.

---

## Summary

The codebase is in excellent shape. Every Phase 2 finding has been addressed and verified in code. The state machine is clean, security is correct, the RAF bug is definitively fixed, and all IPC channels match the architecture spec.

**Two gate items before distributing:**
1. Remove 6 `console.log` calls from `main.js` (5-minute fix)
2. Human must complete the Phase 3 manual smoke test (all 5 states × 5 modes, 5× Regenerate)

Once both are done, run `review: final` again to confirm gate passes.

**Gate: 🔴 BLOCKED — 2 P1 issues. Complete RFX-001 and RFX-002 in TASKS.md.**
