# Final Review — Promptly (Complete Project)
> Date: 2026-05-19 | Scope: Full codebase — all features since last final review (2026-04-29)
> Previous gate: final-review-2026-04-29.md — Score 8.9/10 (B+) — 0 P0, 1 P1, 1 P2, 4 P3
> New since last final review: FEATURE-EMAIL-MODE, FEATURE-EVAL-SCORECARD, FEATURE-EVAL-METRICS,
>   FEATURE-PREFLIGHT-HEALTH-CHECKS, design: ModeDropdown (native menu → custom React dropdown),
>   BUG-NVM-PATH (s1-notresponding path override fix)

---

## Step 0A — Dependency graph pre-screening

Graph present at `vibe/graph/CONCEPT_GRAPH.json`. Pre-screening ran — boundary check completed.
No agent-imports-agent violations found. Proceeding with full review.

---

## Step 0 — Automated checks

### ESLint (`npm run lint`)
```
> promptly@2.4.1 lint
> eslint main.js preload.js
(no output — 0 errors, 0 warnings)
```
✅ Lint clean.

### Vitest (`npm test`)
```
> promptly@2.4.1 test
> vitest run

 RUN  v4.1.5 /Users/aakash-anon/Documents/GitHub-personal/promptly

 Test Files  1 passed (1)
      Tests  45 passed (45)
   Start at  16:07:16
   Duration  207ms
```
✅ All 45 tests pass. Count grew from 22 → 45 (eval scorecard + metrics + image v2 additions).

### npm audit
```
ip-address  <=10.1.0
Severity: moderate
ip-address has XSS in Address6 HTML-emitting methods — GHSA-v2v4-37r5-5v8g
fix available via `npm audit fix`

brace-expansion (via dep chain)
Severity: moderate

2 moderate severity vulnerabilities
```
⚠️ 2 moderate vulnerabilities. Both are in devDep chains only — `ip-address` is a transitive
dep of electron-builder, not present in the packaged .dmg. `npm audit fix` resolves both without
breaking changes. Per ARCHITECTURE.md rule: "high/critical = block commit" — moderate does not
block commits per the project's own rule. Flagging as P1 per review protocol.

---

## Carryover check

**Previous final review:** final-review-2026-04-29.md — Score 8.9/10 — 0 P0, 1 P1, 1 P2, 4 P3.

| ID | Finding | Status |
|----|---------|--------|
| BL-FINAL-001 / BL-EMAIL-003 | App.jsx 721 lines — extract `useOperationHandlers` | ⚠️ PARTIAL — hook extracted (RFX-EMAIL-003, −32 lines). `useTextInput` + `useWindowLayout` also extracted. Current: 719 lines. Orchestrator core remains — all extractable hooks are now extracted. |
| BL-FINAL-002 | splash.html missing CSP meta tag | ✅ RESOLVED — present at splash.html:5 |
| P3-001 | CODEBASE.md OperationErrorPanel stale "105 lines" | ⚠️ Still open — monitor |
| P3-002 | ExpandedDetailPanel approaching 500-line threshold | ✅ IMPROVED — 490 lines (down from 495) |
| P3-003 | WorkflowBuilderState × delete button no hover | ⚠️ Still open |
| P3-004 | ExpandedDetailPanel ISP 27 props | ⚠️ Still open — boundary layer |

Open backlog carryovers:
| ID | Finding | Status |
|----|---------|--------|
| BL-EMAIL-010 | TEAL_FULL unused constant | ✅ RESOLVED — absent from EmailReadyState.jsx |
| BL-EMAIL-011 | useState ordering cosmetic | ⚠️ Still open — P3 |
| BL-EVAL-M-001 | DIMENSION_LABELS recreated in map | ✅ RESOLVED — hoisted to const at line 4 |
| BL-EVAL-M-002 | IIFE pattern in EvalPanel JSX | ⚠️ Still open — P3 |
| P3-IMG2-001/002/003 | ImageBuilder pure-function tests, silent variation failure, duplicate parse fns | ⚠️ Still open — P3 |

---

## Architecture drift detection

Checked all ARCHITECTURE.md invariants against current code.

| Rule | Status | Evidence |
|------|--------|---------|
| State transitions via `transition()` only | ✅ | No direct `setCurrentState` outside `transition()` |
| `localStorage` only via wrappers | ✅ | useMode, useTone, history.js — no direct calls |
| No `dangerouslySetInnerHTML` with user/Claude content | ✅ | Zero occurrences across all React components |
| `contextBridge` / `nodeIntegration: false` | ✅ | Both BrowserWindows confirmed |
| PATH resolution via cached `claudePath` | ✅ | All `spawn` calls use `claudePath`; null-checked |
| `shell.openExternal` URL validation | ✅ | `url.startsWith('https://')` guard present |
| One component per file in `src/renderer/components/` | ✅ | All component files single-export |
| No runtime npm dependencies | ✅ | Zero runtime deps in package.json |
| `originalTranscript` captured once, not mutated | ✅ | ITER exception documented D-ITER-003 |

**Code-level architecture: clean. Documentation drift found:**

🔶 ARCHITECTURE DRIFT (documentation) — IPC surface table significantly out of date
- Decision: IPC surface table in ARCHITECTURE.md is the complete channel inventory
- Found: `evaluate-prompt`, `check-claude`, `check-ffmpeg`, `check-whisper`, `check-whisper-model`,
  `download-whisper-model`, `check-setup-complete`, `set-setup-complete`, `reset-setup-complete`,
  `reopen-wizard`, `retry-transcription`, `retry-generation`, `set-last-prompt`,
  `whisper-download-progress`, `transcription-slow-warning`, `generation-slow-warning`
  — all registered in main.js, none in ARCHITECTURE.md IPC table
- Impact: IPC surface audit fails; agents and team members cannot rely on ARCHITECTURE.md for
  channel inventory; new work may add duplicate channels
- Fix: Add all 16 missing channels to the IPC table in ARCHITECTURE.md (P2)

🔶 ARCHITECTURE DRIFT (documentation) — state count stale + email mode absent
- Found: ARCHITECTURE.md:81 says "17 total" — EMAIL_READY (added FEATURE-EMAIL-MODE) makes 18.
  Email mode missing from prompt modes table (lines ~314-328).
  State machine diagram missing `RECORDING (email mode) → THINKING → EMAIL_READY` transition.
- Fix: Update state count 17→18, add email row to prompt modes table, add transition to diagram (P2)

---

## SOLID principles review

### Component size audit

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `App.jsx` | **719** | 🔴 P1 | 219 over SRP threshold (500). Persistent carryover. ALL extractable hooks now extracted: useRecording, useKeyboardShortcuts, usePolishMode, useIteration, useImageBuilder, useVideoBuilder, useWorkflowBuilder, useOperationHandlers, useTextInput, useWindowLayout. Remaining is orchestrator core (STATES/STATE_HEIGHTS constants, transition(), handleGenerateResult, hook wiring, JSX render). |
| `ExpandedDetailPanel.jsx` | 490 | ⚠️ P3 | 10 under P1 threshold. Improved (495→490). Monitor. |
| `EvalPanel.jsx` | 272 | ✅ | Within threshold. Self-contained eval widget. |
| `EmailReadyState.jsx` | 443 | ✅ | Within threshold. |
| `WorkflowBuilderState.jsx` | 467 | ✅ | Within threshold. |
| `main.js` | 1674 | ✅ (accepted) | Electron main — architectural necessity. |

### App.jsx orchestrator analysis (for P1)

All meaningful concerns have been extracted. Remaining ~719 lines comprise:
- STATES + STATE_HEIGHTS constants (~40 lines)
- ~35 useState/useRef declarations (~40 lines)
- `transition()` function (~80 lines) — cannot be extracted: it calls resizeWindow, animateToState,
  updateMenuBarState, setWindowButtonsVisible in sync — all require App.jsx scope
- `handleGenerateResult()` (~60 lines) — routes all 11 modes; requires App.jsx scope
- Hook invocations with params (~80 lines)
- JSX return (~200 lines) — state-machine render engine, one branch per state
- Remaining handlers and effects (~200 lines)

Verdict: File is at its irreducible minimum given the single-state-machine architecture. No further
extraction yields benefit without artificial complexity. Flagging P1 for protocol compliance.
Recommending acceptance as architectural reality.

---

## Security review

### Universal checks
| Check | Status |
|-------|--------|
| Hardcoded tokens / API keys | ✅ None |
| `dangerouslySetInnerHTML` with user/Claude content | ✅ Zero occurrences |
| `contentEditable` usage | ✅ ExpandedPromptReadyContent — reads `.textContent`, no XSS vector |
| `localStorage` direct access outside wrappers | ✅ None |
| `nodeIntegration` | ✅ Both BrowserWindows: `nodeIntegration: false` |
| `console.log` in production code | ✅ Zero across src/ + main.js + preload.js |
| npm audit | ⚠️ 2 moderate (devDep chains only — not in packaged .dmg) |

### Final phase checks
| Check | Status | Notes |
|-------|--------|-------|
| CORS | N/A | No web server |
| CSP — `src/renderer/index.html` | ✅ | Full policy present |
| CSP — `splash.html` | ✅ | **RESOLVED** — present at splash.html:5 (BL-FINAL-002) |
| Session management | N/A | No sessions |
| High/critical npm vulnerabilities | ✅ 0 | Only moderate (devDep-only) |

---

## Platform-specific review (Electron / macOS)

| Check | Status |
|-------|--------|
| `shell.openExternal` URL validation | ✅ `url.startsWith('https://')` guard |
| `claudePath` null check before all exec calls | ✅ Guards present |
| Window hide-on-close (not destroy) | ✅ `win.on('close')` hide-intercept |
| Single-instance lock | ✅ `app.requestSingleInstanceLock()` |
| Microphone TCC — both layers configured | ✅ Both `setPermissionCheckHandler` + `setPermissionRequestHandler` present |
| `isQuitting` flag for tray quit | ✅ `before-quit` sets `isQuitting = true` |
| preflight.sh CHECK 7 | ✅ All 5 `spawn(claudePath` calls use `makeClaudeEnv` |

---

## Testing review

| Check | Status |
|-------|--------|
| Test runner | ✅ Vitest v4.1.5 |
| All tests pass | ✅ 45/45 |
| Test names describe behaviour | ✅ Behaviour-focused |
| Edge cases covered | ✅ Empty, null, fenced JSON, all modes, eval scoring, parse variants |
| Business logic coverage | ✅ parseSections, getModeTagStyle (12 modes), formatTime, parsePolishOutput, parseImageAnalysis/Assembly, evalScoreColor, evalVerdict |
| React component tests | ⚠️ None — accepted per ARCHITECTURE.md manual smoke test policy |

Test count grew 22 → 45 (eval scorecard + metrics + image v2 parse variants). Solid coverage
of all pure utility functions.

---

## New features — targeted review

### FEATURE-EVAL-SCORECARD + FEATURE-EVAL-METRICS

- **EvalPanel.jsx (272 lines)** — self-contained, fires IPC on mount, owns all state, returns null
  on failure. Pattern correct per spec.
- **Fence-strip before JSON.parse** — follows `parseEmailOutput` pattern. Correct.
- **Dimension breakdown graceful degradation** — `evalData.fieldName && (...)` pattern. Correct.
- **evaluate-prompt IPC** — `child.stdin.end()` present at main.js:1051. spawn uses `claudePath`
  + `makeClaudeEnv`. Correct.

### FEATURE-PREFLIGHT-HEALTH-CHECKS

- **scripts/preflight.sh** — `set -euo pipefail`, `ok()`/`fail()` helpers, CHECKs 1-10.
  CHECK 1-6: `env -i HOME="$HOME"` correctly simulates non-login shell.
  CHECK 7: embedded python3 heredoc (no external dep). `[ $? -ne 0 ] && exit 1` pattern correct.
  CHECK 8-9: simple `grep -q` string matches — reliable.
  CHECK 10: `grep -A 15` with string literal pattern — correct (previous awk range approach
  was fixed before release; ugrep regex compat issue also resolved).
- **scripts/assert-splash.js** — CommonJS, `fs`/`path` only. 4 assertions pass on current splash.html.
  All 4 assert strings are structural IDs that would catch regressions.
- **release.sh integration** — preamble placement correct (after nvm init, before arg check).
- **CI workflow** — `macos-latest`, node 20, splash assertions + CHECK 7. Correct scope for CI
  (no logged-in claude CLI required).

### design: ModeDropdown

- **Portal rendering** — `createPortal(dropdown, document.body)` escapes `overflow:hidden`. Correct.
- **Outside-click race fix** — `pointerdown` on portal, `onModeSelect` in pill handlers after close.
  Previous outside-click reopen race fixed in commit 1d3496f. Correct.
- **No window resize in ExpandedTransportBar** — 860px window has room; only IdleState (134px)
  resizes to 480px on open/close. Correct per decision D-MODE-DROPDOWN in DECISIONS.md.

---

## Code quality analysis

- Zero dead code in reviewed files
- Zero `console.log` in production code
- No hardcoded hex values outside token definitions
- EvalPanel graceful degradation pattern (`evalData.fieldName && (...)`) — clean
- preflight.sh CHECK 10 uses `grep -A 15 "'${handler}'"` — correct (awk range had ugrep compat issue)
- assert-splash.js checks structural IDs that would catch real regressions

---

## Strengths

1. **Test suite grew 22→45 (105% growth) with zero regressions** — eval scorecard, metrics,
   image parse variants all covered. `evalScoreColor` and `evalVerdict` are tested via promptUtils
   before being used in EvalPanel. Solid discipline.

2. **preflight.sh + assert-splash.js** — the right kind of safety net. Catches the exact class of
   failures (nvm PATH, missing binaries, splash escape-hatch regressions) that burned previous
   installs. CHECK 7 (makeClaudeEnv coverage scan) is a smart structural invariant. CI integration
   (splash assertions + CHECK 7) is correctly scoped to what CI can actually run.

3. **EvalPanel architecture** — fully self-contained (fires IPC on mount, owns state, returns null
   on failure). No App.jsx state added. No new props to ExpandedView. Clean isolation.

4. **Eval metrics graceful degradation** — all 4 new metric sections gated with `evalData.fieldName
   && (...)`. If Claude doesn't return a field, the section silently disappears. Zero crash risk.

5. **ModeDropdown portal pattern** — correctly escapes `overflow:hidden` without restructuring the
   DOM. Outside-click race condition in previous version was identified and fixed before shipping.

6. **splash.html CSP resolved** — BL-FINAL-002 is resolved. Both BrowserWindows now have identical
   Content-Security-Policy.

---

## Findings

### P0 — Critical

**None.**

---

### P1 — Fix before deploy

#### P1-001 — App.jsx: 719 lines (219 over SRP threshold) — carryover BL-EMAIL-003
- **File:** `src/renderer/App.jsx`
- **Evidence:** `wc -l src/renderer/App.jsx` → 719. P1 threshold: 500.
- **History:** Was 721 at final-review-2026-04-29. All previously recommended hook extractions
  applied: useOperationHandlers (−32), useTextInput (−25), useWindowLayout (−15). Net reduction:
  ~72 lines offset by eval + mode-dropdown additions. Current 719 is near the practical minimum.
- **Recommendation:** Accept App.jsx at 719 as the irreducible orchestrator. `transition()` (~80
  lines), `handleGenerateResult()` (~60 lines), and the state-machine JSX render (~200 lines)
  cannot be extracted without artificial indirection. Document acceptance in DECISIONS.md.
- **Severity:** P1 per protocol. Recommend accepting with DECISIONS.md entry rather than forcing
  further extraction. If accepted: downgrade to monitor-only in backlog.

#### P1-002 — npm audit: 2 moderate vulnerabilities (devDep-only chains)
- **Evidence:** `npm audit` → `ip-address <=10.1.0` (XSS in HTML-emitting methods) + `brace-expansion`
  (via dep chain). Both in electron-builder devDep chain. NOT present in packaged .dmg. Zero
  runtime risk for users.
- **Fix:** `npm audit fix` — resolves both without breaking changes (safe upgrade).
- **Note:** ARCHITECTURE.md "block commit" rule applies to high/critical only. Moderate vulns in
  devDep-only chains have zero user impact but should be fixed before the release tag.
- **Severity:** P1 per review protocol (moderate = P1). Trivially fixed — `npm audit fix`.

---

### P2 — Fix before next distribution

#### P2-001 — ARCHITECTURE.md IPC table: 16 channels registered in main.js but absent from table
- **File:** `vibe/ARCHITECTURE.md` — IPC surface section (lines 148–186)
- **Evidence:** The following channels are in main.js but absent from ARCHITECTURE.md:
  `evaluate-prompt`, `check-claude`, `check-ffmpeg`, `check-whisper`, `check-whisper-model`,
  `download-whisper-model`, `check-setup-complete`, `set-setup-complete`, `reset-setup-complete`,
  `reopen-wizard`, `retry-transcription`, `retry-generation`, `set-last-prompt`,
  `whisper-download-progress` (main→renderer push), `transcription-slow-warning` (push),
  `generation-slow-warning` (push).
  These were added by FEATURE-ONBOARDING-WIZARD (12 channels), FEATURE-EVAL-SCORECARD (1),
  FEATURE-018 Quick Copy (1), and FEATURE-EMAIL-MODE (2 push channels).
- **Fix:** Add all 16 to the IPC table in ARCHITECTURE.md with direction and purpose.
- **Severity:** P2 — documentation drift. Code is correct; channel inventory is untrustworthy.

#### P2-002 — ARCHITECTURE.md: EMAIL_READY state missing; state count stale; email mode absent from prompt modes table
- **File:** `vibe/ARCHITECTURE.md` lines 81, 88–94, ~314–328
- **Evidence:** State count "17 total" — EMAIL_READY makes 18. State diagram has no email-mode
  transition. Prompt modes table has no email row.
- **Fix:** Update state count 17→18; add `RECORDING (email mode) → THINKING → EMAIL_READY`
  to state diagram; add email row to prompt modes table (teal accent, always-expanded,
  speaks situation → Claude drafts ready-to-send email).
- **Severity:** P2 — documentation drift only. Feature is fully implemented and working.

---

### P3 — Minor / monitor

| ID | File | Line | Finding |
|----|------|------|---------|
| P3-001 (carryover) | `vibe/CODEBASE.md` | OperationErrorPanel row | "105 lines" → actual 128 lines. Minor stale count. |
| P3-002 (carryover) | `src/renderer/components/ExpandedDetailPanel.jsx` | 1–490 | 490 lines — 10 under P1 threshold. Down from 495. Monitor — email + eval additions balanced by ExpandedErrorContent extraction. |
| P3-003 (carryover) | `src/renderer/components/WorkflowBuilderState.jsx` | × delete btn | No hover state (rgba 0.2 → no onMouseEnter/Leave). Low discoverability for destructive action. |
| P3-004 (carryover) | `src/renderer/components/ExpandedDetailPanel.jsx` | props | 27+ props — boundary layer necessity; all consumed. No action until further refactor opportunity. |
| P3-005 (carryover) | `src/renderer/components/EvalPanel.jsx` | IIFE JSX pattern | `(() => { const driftColor = ...; return (...) })()` in JSX — valid but non-idiomatic. Could move `driftColor`/`driftBg`/`driftBorder` to component scope. |
| P3-006 (carryover) | `src/renderer/hooks/useImageBuilder.js` | generateVariations | Silent failure — `isGeneratingVariations` resets to false, 0 variations shown with no retry affordance. |
| P3-007 (carryover) | `src/renderer/App.jsx` | 96–97 | `transcriptionError`/`generationError` useState out of order with other useState declarations. Cosmetic only. |

---

## Score calculation

```
Start:                                        10.0
P0 findings (× 1.0):                          0.0   (0 P0)
P1 findings (× 0.5):                         -1.0   (P1-001: App.jsx 719 lines; P1-002: npm audit moderate)
P2 findings (× 0.2):                         -0.4   (P2-001: IPC table drift; P2-002: email in ARCHITECTURE.md)
P3 findings (× 0.1):                         -0.7   (7 P3 findings)
Architecture drift violations (× 0.5):       -0.5   (ARCHITECTURE.md IPC + state machine documentation drift)
─────────────────────────────────────────
Score:                                         7.4 / 10 — Grade B
```

Previous score: 8.9/10. Δ: −1.5 (new IPC table documentation drift detected; App.jsx P1 persists;
npm audit moderate added; offset by splash CSP + TEAL_FULL + DIMENSION_LABELS resolutions).

---

## Carryover resolution summary

| ID | Finding | Resolution |
|----|---------|-----------|
| BL-FINAL-002 | splash.html missing CSP | ✅ RESOLVED — splash.html:5 |
| BL-EMAIL-010 | TEAL_FULL unused constant | ✅ RESOLVED — absent from file |
| BL-EVAL-M-001 | DIMENSION_LABELS recreated in map | ✅ RESOLVED — hoisted as const |
| BL-EMAIL-003 | App.jsx 724→719 lines | ⚠️ PARTIAL — all hooks extracted; residual is orchestrator |
| BL-EMAIL-011 | useState ordering | ⚠️ Open P3 |
| BL-EVAL-M-002 | IIFE pattern in EvalPanel | ⚠️ Open P3 |

---

## Gate decision

```
🔴 BLOCKED — 2 P1 issues

P1-001: Run `npm audit fix` before release tag (trivial — 30 seconds)
P1-002: App.jsx 719 lines — all recommended hooks extracted. Recommend adding DECISIONS.md
        entry accepting orchestrator at current size, then downgrade to P3 in backlog.

Complete both P1 actions, then say "next" to re-run review.
```

---

## Summary table

| Severity | Count | Items |
|----------|-------|-------|
| P0 | 0 | — |
| P1 | 2 | App.jsx 719 lines (orchestrator carryover); npm audit 2 moderate (devDep) |
| P2 | 2 | ARCHITECTURE.md IPC table 16 channels missing; email mode + EMAIL_READY state absent |
| P3 | 7 | CODEBASE.md stale count; ExpandedDetailPanel threshold monitor; × delete hover; ISP props; EvalPanel IIFE; ImageBuilder silent failure; useState ordering |
