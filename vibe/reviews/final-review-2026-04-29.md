# Final Review — Promptly (Complete Project)
> Date: 2026-04-29 | Scope: Full codebase — all features since deploy unlock (2026-04-24)
> Previous gate: full-project-review-2026-04-28 — Score 9.5/10 (Grade A) — 0 P0, 0 P1
> New since last review: FEATURE-ONBOARDING-WIZARD, FEATURE-WORKFLOW-BUILDER, FEATURE-ABORT-RESET,
>   FEATURE-HISTORY-EMPTY-STATE, BUG-TOGGLE-008 visual redesign, video-builder history fix,
>   BUG-RELEASE-NODE-PATH, workflow placeholder fill + delete bug fix

---

## Step 0A — Dependency graph pre-screening

Graph present at `vibe/graph/DEPENDENCY_GRAPH.json`. Pre-screening ran — no agent-imports-agent violations
found. Proceeding with full review.

---

## Step 0 — Automated checks

### ESLint (`npm run lint`)
```
> promptly@1.9.0 lint
> eslint main.js preload.js
(no output — 0 errors, 0 warnings)
```
✅ Lint clean.

### Vitest (`npm test`)
```
> promptly@1.9.0 test
> vitest run

 RUN  v4.1.5 /Users/aakash-anon/Documents/GitHub-personal/promptly

 Test Files  1 passed (1)
       Tests  22 passed (22)
    Duration  186ms
```
✅ All 22 tests pass. Count grew from 18 → 22 (workflow + video + design mode test additions).

### npm audit
```
found 0 vulnerabilities
```
✅ Zero vulnerabilities.

---

## Carryover check

**Previous review:** full-project-review-2026-04-28.md (v2) — Score 9.5/10 — 0 P0, 0 P1, 1 P2, 3 P3.

| ID | Finding | Status |
|----|---------|--------|
| P2-001 | CODEBASE.md 3 stale line counts after BL-072/073 dedup | ✅ RESOLVED — backlog shows ✅ 2026-04-27 |
| P3-001 | `dismissIterating` plain function (not useCallback) | ✅ RESOLVED — "wrapped in useCallback 2026-04-27" |
| P3-002 | PromptSections.jsx regex diverges from parseSections | ✅ RESOLVED — BL-078 "regex updated 2026-04-27" |
| P3-003 | getModeTagStyle missing design mode test | ✅ RESOLVED — "explicit design test added 2026-04-27" |

Persistent open backlog items from earlier reviews:

| ID | Finding | Status |
|----|---------|--------|
| BL-060 | PolishReadyState narrow width crowding (P3 — monitor) | ⚠️ Still open — no change |
| BL-WFL-008 | App.jsx 659 lines — accepted as "irreducible orchestrator" | ⚠️ ESCALATED — now 721 lines (see P1-001) |
| P3-EXP-002 | ExpandedDetailPanel ISP — many props at boundary layer | ⚠️ Still open — monitor |
| P3-VID-001 | ExpandedDetailPanel 24→27 props (boundary layer carryover) | ⚠️ Still open — monitor |
| P3-WFL-DEL-001 | × delete button no hover state on node cards | ⚠️ Still open |

---

## Architecture drift detection

Checked all ARCHITECTURE.md invariants against current code.

| Rule | Status | Evidence |
|------|--------|---------|
| State transitions via `transition()` only | ✅ | No direct `setCurrentState` outside `transition()` or `handleCollapse()` in App.jsx |
| `localStorage` only via wrappers | ✅ | useMode.js:18,21 and useTone.js:6,10 are the wrappers themselves — correct |
| No `dangerouslySetInnerHTML` with user/Claude content | ✅ | Zero occurrences across all React components |
| `innerHTML` only for static structure | ✅ | splash.html lines 978–987 set hardcoded SVG icons; lines 1095,1110 set static HTML with no user-provided text — within rule |
| `contextBridge` / `nodeIntegration: false` | ✅ | Both BrowserWindows confirmed `nodeIntegration: false` in main.js |
| PATH resolution via cached `claudePath` | ✅ | All `spawn`/`execFile` calls use `claudePath`; null checks at lines 812, 877, 1175 in main.js |
| `shell.openExternal` URL validation | ✅ | main.js:751 — `url.startsWith('https://')` guard present |
| One component per file in `src/renderer/components/` | ✅ | All component files confirmed single-export |
| No runtime npm dependencies | ✅ | package.json: zero runtime deps |
| `originalTranscript` captured once, not mutated | ✅ | ITER exception documented in DECISIONS.md D-ITER-003 |

**No P0-level architecture drift detected.**

---

## SOLID principles review

### Component size audit

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `App.jsx` | **721** | 🔴 P1 | 221 lines over SRP threshold (500). Grew from 659 (WFL accepted) → 721 (ONBD +62). |
| `ExpandedDetailPanel.jsx` | **495** | ⚠️ P3 | 5 lines under P1 threshold. ONBD routing grew it from 311→495. Monitor closely. |
| `ExpandedTransportBar.jsx` | 374 | ✅ | Within threshold |
| `ExpandedView.jsx` | 118 | ✅ | Thin orchestrator |
| `WorkflowBuilderState.jsx` | 467 | ✅ | Within threshold |
| `OperationErrorPanel.jsx` | 128 | ✅ | Shared error component. CODEBASE.md lists "105 lines" — stale (P3) |
| `useWorkflowBuilder.js` | 265 | ✅ | Within threshold |
| `main.js` | 1466 | ✅ (accepted) | Single Electron main — architectural necessity |

### App.jsx concern analysis

App.jsx now owns 42 state/callback definitions (counted via grep). Concerns present:
1. State machine / window transitions (`transition`, `handleExpand`, `handleCollapse`)
2. Error retry logic (`handleRetryTranscription`, `handleRetryGeneration`, slow warning state + IPC listeners)
3. Recording orchestration (delegated to `useRecording`)
4. Keyboard shortcuts (delegated to `useKeyboardShortcuts`)
5. Image/video/workflow builder orchestration (delegated to respective hooks)
6. Polish mode orchestration (delegated to `usePolishMode`)
7. Iteration orchestration (delegated to `useIteration`)
8. Abort logic (`handleAbort`, `abortRef`)

Concerns #2 and #8 were added by ONBD + ABORT-RESET features. These are extractable to a
`useOperationHandlers` hook: `transcriptionError`, `generationError`, `transcriptionSlow`,
`generationSlow` state + slow warning IPC listeners + `handleRetryTranscription` +
`handleRetryGeneration` + `abortRef` + `handleAbort`. This would reduce App.jsx by ~60–70 lines
(back toward the accepted 659).

### ISP check

- `ExpandedView.jsx`: 27+ props — boundary-layer necessity passing through to children.
- `ExpandedDetailPanel.jsx`: 27 props including `transcriptionErrorProps`, `transcriptionSlow`,
  `generationErrorProps`, `generationSlow` added by ONBD. Boundary layer — all are consumed.

No violations — these are pass-through orchestrator boundaries.

---

## Security review

### Universal checks
| Check | Status |
|-------|--------|
| Hardcoded tokens / API keys | ✅ None |
| `dangerouslySetInnerHTML` with user/Claude content | ✅ Zero occurrences |
| `contentEditable` usage | ✅ ExpandedPromptReadyContent — reads `.textContent` on save, no XSS vector |
| `localStorage` direct access outside wrappers | ✅ None |
| `nodeIntegration` | ✅ Both BrowserWindows: `nodeIntegration: false` |
| npm audit | ✅ 0 vulnerabilities |
| `console.log` in production code | ✅ Zero across all src/ + main.js + preload.js |

### Final phase additional checks (desktop app — server checks N/A)
| Check | Status | Notes |
|-------|--------|-------|
| CORS | N/A | No web server |
| Security headers | N/A | No web server |
| Rate limiting | N/A | No public endpoints |
| HTTPS enforcement | N/A | No web server |
| CSP — `src/renderer/index.html` | ✅ Present | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;` |
| CSP — `splash.html` | ⚠️ P2 | No CSP meta tag. The renderer BrowserWindow has a policy; splash BrowserWindow does not. Inconsistency — low risk (splash runs zero user-provided content) but should match. |
| Session management | N/A | No sessions |
| High/critical npm vulnerabilities | ✅ 0 |

---

## Platform-specific review (Electron / macOS)

| Check | Status |
|-------|--------|
| `shell.openExternal` URL validation | ✅ `url.startsWith('https://')` guard at main.js:751 |
| `claudePath` null check before all exec calls | ✅ Guards at main.js:812, 877, 1175 |
| `whisperPath` null check | ✅ Guards at main.js:1036, 1124 |
| Window hide-on-close (not destroy) | ✅ `win.on('close')` hide-intercept in main.js |
| Single-instance lock | ✅ `app.requestSingleInstanceLock()` in main.js |
| Microphone TCC — both layers configured | ✅ `setPermissionCheckHandler` + `setPermissionRequestHandler` both present |
| Global shortcut conflict fallback | ✅ `SHORTCUT_FALLBACK` registered; `shortcut-conflict` sent to renderer |
| `isQuitting` flag for tray quit | ✅ `before-quit` sets `isQuitting = true` |

---

## Testing review

| Check | Status |
|-------|--------|
| Test runner | ✅ Vitest v4.1.5 |
| All tests pass | ✅ 22/22 |
| Test names describe behaviour | ✅ All behaviour-focused |
| AAA structure | ✅ Present |
| Edge cases covered | ✅ Empty, null, missing markers, multiline, all modes |
| Business logic coverage | ✅ parseSections, getModeTagStyle (9 modes + unknown), formatTime, parsePolishOutput |
| React component tests | ⚠️ None — accepted per ARCHITECTURE.md "manual smoke test is the v1 test suite" |

---

## Code quality analysis

- Zero dead code found across all reviewed files
- Zero `console.log` in production code
- No hardcoded hex values outside token definitions (verified in previously-flagged files)
- `OperationErrorPanel.jsx` — `copied` state pattern correct; owned by component, not parent
- `WorkflowBuilderState.jsx` (467 lines) — within threshold, single responsibility: n8n node review UI
- `useWorkflowBuilder.js` (265 lines) — two-phase Claude flow well-contained; reiterate merge logic cohesive
- `splash.html` — well-structured; `s1ShowError()` helper extraction was correct call (ONBD UX fix)

---

## Document completeness audit

| Document | Status | Notes |
|----------|--------|-------|
| `vibe/CODEBASE.md` | ⚠️ P3 | `OperationErrorPanel.jsx` listed as "105 lines" — actual 128 lines. Minor stale count. |
| `vibe/ARCHITECTURE.md` | ✅ | States count 15 total, all IPC channels, window lifecycle — all current |
| `CLAUDE.md` | ✅ | Active feature sections correctly listed; stale sections removed |
| `vibe/TASKS.md` | ✅ | All completed tasks ticked, feature sections complete |
| `vibe/reviews/backlog.md` | ✅ | All prior findings tracked; open items clearly marked |

---

## Strengths

1. **Onboarding wizard (ONBD-001–017) is thorough and well-structured** — 4-screen wizard tests the
   full CLI → Whisper → ffmpeg → model stack end-to-end. `s1ShowError()` helper and scrollable screens
   with user-controlled pace (no auto-advance) show good UX thinking. `splash.html` stays vanilla HTML,
   consistent with architecture.

2. **OperationErrorPanel shared component is the right abstraction** — TRANSCRIPTION_ERROR and
   GENERATION_ERROR share one component; 4 icon variants + full error type differentiation without
   duplication.

3. **Retry architecture is correct** — `lastTempAudioPath` + `lastTranscript` in main.js allow
   retry without re-recording. `abortRef` in App.jsx correctly guards stale generation results.
   `handleRetryGeneration` delegates through `handleGenerateResultRef` — consistent with the
   established IPC callback pattern.

4. **All 22 tests pass with zero vulnerabilities** — the test suite expanded correctly with
   workflow + video + design mode coverage.

5. **Zero console.log in production code** — clean across all files.

6. **BUG-TOGGLE-008 visual redesign** — ExpandedTransportBar correctly uses ResizeObserver to
   size the waveform zone; `isContentState` flag in ExpandedDetailPanel cleanly routes between
   history viewing and content states.

---

## Findings

### P0 — Critical

**None.**

---

### P1 — Fix before deploy

#### P1-001 — App.jsx SRP violation: 721 lines (221 over threshold)
- **File:** `src/renderer/App.jsx`
- **Evidence:** `wc -l src/renderer/App.jsx` → 721 lines. P1 threshold is 500. Previous review
  accepted at 659 as "irreducible orchestrator" (BL-WFL-008). ONBD-014/015 + ABORT-RESET added
  ~62 lines: `transcriptionError`, `generationError`, `transcriptionSlow`, `generationSlow`
  (4 useState), `abortRef`, `handleAbort` (~15 lines), `handleRetryTranscription` (~20 lines),
  `handleRetryGeneration` (~15 lines), slow-warning IPC listener setup (~10 lines).
- **Fix:** Extract `handleRetryTranscription`, `handleRetryGeneration`, `abortRef`, `handleAbort`,
  and the 4 error state vars + slow-warning IPC listeners into a `useOperationHandlers` hook.
  Required params: `{ STATES, transitionRef, modeRef, originalTranscript, handleGenerateResultRef,
  setTranscriptionError, setGenerationError, setTranscriptionSlow, setGenerationSlow }`.
  Returns: `{ abortRef, handleAbort, handleRetryTranscription, handleRetryGeneration }`.
  Expected reduction: ~60–70 lines → App.jsx ≈ 655 lines (back to the accepted level).
- **Severity:** P1 — violates SRP, but fix is straightforward. No architectural change required.

---

### P2 — Fix before next distribution

#### P2-001 — splash.html missing Content-Security-Policy meta tag
- **File:** `splash.html`
- **Evidence:** `grep "Content-Security-Policy" splash.html` → no match. `src/renderer/index.html`
  has a full CSP. splash.html is a separate BrowserWindow — it should have the same policy for
  consistency and defence-in-depth.
- **Fix:** Add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;" />` to the `<head>` of splash.html (match the renderer policy).
- **Severity:** P2 — splash.html renders no user-provided content so XSS risk is minimal, but
  policy consistency is the right posture.

---

### P3 — Minor / monitor

#### P3-001 — CODEBASE.md stale line count for OperationErrorPanel.jsx
- **File:** `vibe/CODEBASE.md` — OperationErrorPanel row
- **Evidence:** CODEBASE.md: "105 lines". Actual: 128 lines. Grew with ONBD-016 implementation.
- **Fix:** Update to "128 lines" in the CODEBASE.md file map row.
- **Severity:** P3 — Documentation drift only.

#### P3-002 (carryover) — ExpandedDetailPanel.jsx approaching P1 threshold
- **File:** `src/renderer/components/ExpandedDetailPanel.jsx` — 495 lines
- **Evidence:** 5 lines under P1 threshold (500). Grew from 311 (2026-04-28) → 495 (now).
  Growth driven by TRANSCRIPTION_ERROR + GENERATION_ERROR routing in ONBD-014/015 and
  BUG-TOGGLE-008 content state refactor.
- **Fix:** Monitor — if any further feature adds to this file, extract the error panel
  routing block (lines ~432–478) into an `ExpandedErrorContent.jsx` component.
- **Severity:** P3 — Not yet over threshold. Flag for next feature touching this file.

#### P3-003 (carryover) — × delete button no hover state in WorkflowBuilderState
- **File:** `src/renderer/components/WorkflowBuilderState.jsx`
- **Evidence:** BL-WFL-DEL-001 (Open) — × delete button uses `rgba(255,255,255,0.2)` with no
  `onMouseEnter`/`onMouseLeave` hover feedback. Low discoverability for a destructive action.
- **Fix:** Add `onMouseEnter` (increase opacity to 0.5) and `onMouseLeave` (reset) on the × button.
- **Severity:** P3 — Cosmetic UX improvement, not blocking.

#### P3-004 (carryover) — ExpandedDetailPanel ISP: 27 props
- **File:** `src/renderer/components/ExpandedDetailPanel.jsx`
- **Evidence:** 27 props in the function signature. Added `transcriptionErrorProps`,
  `transcriptionSlow`, `generationErrorProps`, `generationSlow` this cycle. These are all consumed
  within the component. Boundary-layer orchestration necessity.
- **Fix:** No action until P1-001 (useOperationHandlers) is applied — that will reduce prop count
  by collapsing error state into a single `operationHandlerProps` bundle.
- **Severity:** P3 — Boundary-layer ISP, all props are necessary.

---

## Score calculation

```
Start:                                        10.0
P0 findings (× 1.0):                          0.0   (0 P0)
P1 findings (× 0.5):                         -0.5   (P1-001: App.jsx 721 lines SRP)
P2 findings (× 0.2):                         -0.2   (P2-001: splash.html CSP)
P3 findings (× 0.1):                         -0.4   (4 P3 findings)
Architecture drift violations (× 0.5):        0.0
─────────────────────────────────────────
Score:                                         8.9 / 10 — Grade B+
```

Previous score: 9.5/10. Δ: −0.6 (1 new P1, 1 new P2, carryover P3s).

---

## Summary table

| Severity | Count | Items |
|----------|-------|-------|
| P0 | 0 | — |
| P1 | 1 | App.jsx 721 lines — extract `useOperationHandlers` hook |
| P2 | 1 | splash.html missing CSP meta tag |
| P3 | 4 | CODEBASE.md stale OperationErrorPanel line count (105→128); ExpandedDetailPanel approaching threshold (495/500); × delete button no hover state; ExpandedDetailPanel ISP 27 props |
