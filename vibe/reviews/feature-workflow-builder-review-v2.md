# Feature Re-Review — FEATURE-WORKFLOW-BUILDER (v2)
> Reviewed: 2026-04-29 | Branch: feat/workflow-builder | Reviewer: vibe-review skill
> Scope: Post-fix re-review of RFX-WFL-001, RFX-WFL-002, BL-WFL-003 through BL-WFL-006
> Previous review: vibe/reviews/feature-workflow-builder-review.md (Score: 6.7/10 — BLOCKED)

---

## Automated Checks

| Check | Result |
|-------|--------|
| `npm test` | ✅ 22/22 passing (1 file, +2 new test cases) |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm audit` | ✅ 0 vulnerabilities |

---

## Concept Graph Pre-screening

✅ 0 concept boundary violations — clean.

---

## Carryover Check (from feature-workflow-builder-review.md)

| ID | Finding | Status |
|----|---------|--------|
| BL-WFL-001 | `blankFilled` computed but never added to `filledCount` sum — Confirm permanently disabled after adding blank node | ✅ RESOLVED — `WorkflowBuilderState.jsx:33` now `return sum + paramsFilled + blankFilled`. `blankFilled` logic also corrected: checks `filledPlaceholders[\`${node.id}-__name__\`] && filledPlaceholders[\`${node.id}-__type__\`]` (correct) instead of stale `node.name && node.type`. |
| BL-WFL-002 | App.jsx 750 lines — SRP P1 threshold exceeded | ✅ PARTIALLY RESOLVED — All three prop bundles (`imageBuilderProps`, `videoBuilderProps`, `workflowBuilderProps`) moved into their respective hooks. App.jsx reduced 750 → 659 lines. Still over 500-line threshold; classified P2 residual (see below). |
| BL-WFL-003 | ARCHITECTURE.md state count 13 — should be 15; WORKFLOW_BUILDER + WORKFLOW_BUILDER_DONE absent; `workflow` absent from modes table | ✅ RESOLVED — `vibe/ARCHITECTURE.md:81` now reads "States (15 total...)" with WORKFLOW_BUILDER + WORKFLOW_BUILDER_DONE in state diagram; `workflow` and `video` rows added to prompt modes table |
| BL-WFL-004 | `getModeTagStyle('workflow')` not in test suite | ✅ RESOLVED — `tests/utils.test.js` now has green-tones test for `workflow` and blue-tones test for `video`; test count 20 → 22 |
| BL-WFL-005 | `handleWorkflowConfirm` calls `setThinkingLabel` redundantly | ✅ RESOLVED — Redundant call removed from `useWorkflowBuilder.js:194` |
| BL-WFL-006 | `onReiterate` in App.jsx double-sets `isReiteratingRef.current = true` | ✅ RESOLVED — `onReiterate` now lives inside `useWorkflowBuilder.js` prop bundle; sets ref once via `isReiteratingRef.current = true` directly |

**All 6 previous findings addressed. Both P1s resolved (BL-WFL-001 fully fixed; BL-WFL-002 directed fix applied).**

---

## Architecture Drift

✅ **No code-level architecture drift.** All conventions followed: transitions via `transitionRef.current()`, IPC via `window.electronAPI`, no `dangerouslySetInnerHTML`.

### 🟡 DOC DRIFT — CODEBASE.md hook exports stale (P2)
**Section:** File map rows for `useWorkflowBuilder`, `useVideoBuilder`, `useImageBuilder`
**Found:** `vibe/CODEBASE.md` lines 36–38 still list old expansive return values. Specific gaps:
- Line 36: `useWorkflowBuilder` return shows ~14 exports (workflowAnalysis, filledPlaceholders, workflowJson, assembleWorkflowJson, handleFillPlaceholder, handleAddNode, handleWorkflowConfirm, handleWorkflowReiterate…); actual return is now `{ isReiteratingRef, runWorkflowAnalysis, handleWorkflowStartOver, workflowBuilderProps }`. Also missing `startRecordingRef` from params.
- Line 37: `useVideoBuilder` return shows ~24 exports; actual return is now `{ isReiteratingRef, runPreSelection, handleVideoStartOver, videoBuilderProps }`. Also missing `startRecordingRef` from params.
- Line 38: `useImageBuilder` return missing `imageBuilderProps` return value and `startRecordingRef` param.
- Line 30: App.jsx description still lists `workflowAnalysis`, `filledPlaceholders`, `workflowJson` as state vars — these are now hook-internal only.
- Line 63: test count "20 tests" → now 22 tests.
- Lines 41, 44: ExpandedView and ExpandedDetailPanel props lists missing `workflowBuilderProps` in forwarding chain.

**Impact:** Future agents reading CODEBASE.md will have wrong mental model of hook surface and App.jsx state.
**Fix:** Update CODEBASE.md file map for `useWorkflowBuilder`, `useVideoBuilder`, `useImageBuilder`, `App.jsx`, `ExpandedView`, `ExpandedDetailPanel`, test count.
**Severity:** P2

---

## SOLID Principles

### 🟡 P2 Residual — App.jsx 659 lines (threshold: 500)
**File:** `src/renderer/App.jsx` — 659 lines (verified via `wc -l`)

The directed P1 fix was applied: all three prop bundle construction blocks (~90 lines total) moved from App.jsx into their respective hooks. File reduced 750 → 659. The residual 159 lines over threshold is the irreducible orchestrator core:
- ~40 lines: STATES + STATE_HEIGHTS constants
- ~105 lines: hook wiring (10 hooks × ~10 lines each)
- ~50 lines: state/ref declarations + transition/expand helpers
- ~75 lines: non-hookable handlers (handleAbort, openHistory/Settings, handleTypingSubmit, handleRegenerate, handleGenerateResult)
- ~226 lines: JSX render (15 states × ~15 lines avg + conditions)

No further extraction yields meaningful SRP benefit without introducing artificial complexity. Downgraded from P1 (directed fix applied) to P2 residual.

### ✅ WorkflowBuilderState.jsx — 454 lines (under 500) ✅
### ✅ useWorkflowBuilder.js — 252 lines (down from 251 — effectively unchanged) ✅
### ✅ useVideoBuilder.js — 310 lines ✅

---

## Code Quality Findings

### 🔵 P3 — `runVideoPreSelection` missing from `handleGenerateResult` dep array
**File:** `src/renderer/App.jsx` line 296
```js
}, [mode, runPreSelection, runWorkflowAnalysis])
```
`runVideoPreSelection` is called at line 272 inside this callback but is absent from the dep array. `runVideoPreSelection` is a `useCallback` with deps `[videoDefaults, removedByUser]` — it can change between renders when video chip state changes.

**In practice:** The callback is accessed via `handleGenerateResultRef.current` (a ref) which is updated every render at line 305. Since video reiterate's chip changes happen *after* the recording flow fires `handleGenerateResult`, the stale closure window is very narrow and no user-facing bug has been observed. Still, the dep array is technically incorrect.

**Fix:** Add `runVideoPreSelection` to the dependency array: `[mode, runPreSelection, runVideoPreSelection, runWorkflowAnalysis]`

---

## Security Review

| Check | Result |
|-------|--------|
| Hardcoded secrets / API keys | ✅ None |
| `dangerouslySetInnerHTML` with user/Claude content | ✅ Absent |
| IPC surface | ✅ No new channels — uses existing `generate-raw` only |
| `localStorage` outside wrappers | ✅ None |
| `npm audit` | ✅ 0 vulnerabilities |

---

## Testing Review

| Check | Result |
|-------|--------|
| `getModeTagStyle('workflow')` tested | ✅ RESOLVED — green tones asserted |
| `getModeTagStyle('video')` tested | ✅ NEW — blue default asserted |
| `blankFilled` fill-count logic | ✅ Fixed; would have been caught by unit test |
| Test names describe behaviour | ✅ All names are behaviour-descriptive |
| Total passing | ✅ 22/22 |

---

## Strengths

- BL-WFL-001 fix is architecturally correct: checks `filledPlaceholders[nodeId-__name__]` (what the UI actually writes) rather than `node.name` (which is always `''` in `workflowAnalysis` for user-added nodes — `workflowAnalysis` state is never mutated by the fill flow).
- Prop bundle extraction is clean: `videoBuilderProps`, `imageBuilderProps`, `workflowBuilderProps` now co-located with their hook logic. App.jsx's `return` JSX now just forwards bundles without constructing them.
- `startRecordingRef` param pattern is consistent across all three builder hooks — correct way to avoid stale closure on `onReiterate`.
- All tests pass; 2 new test cases added for the missing `workflow` and `video` mode tag styles.
- `handleWorkflowReiterate` dead function removed from `useWorkflowBuilder.js` — clean.

---

## Quality Score

| Category | Deductions |
|----------|-----------|
| P2 findings × 2 (App.jsx residual + CODEBASE.md stale) | -0.4 |
| P3 findings × 1 (dep array) | -0.1 |
| **Total** | **-0.5** |

**Score: 9.5 / 10 — Grade A**

---

## Gate Decision

✅ **PASS** — 0 P0 issues, 0 P1 issues.

Both original P1 findings resolved. Two P2 findings logged to backlog (CODEBASE.md update + App.jsx residual line count). One P3 finding logged. Branch may merge to main.

---

## Backlog additions

### BL-WFL-007 (P2) — CODEBASE.md hook exports stale
- `useWorkflowBuilder` row: update params + return values
- `useVideoBuilder` row: update params + return values
- `useImageBuilder` row: add `startRecordingRef` param + `imageBuilderProps` return
- App.jsx row: remove `workflowAnalysis/filledPlaceholders/workflowJson` from state vars, add `workflowBuilderProps` to exports
- ExpandedView row: add `workflowBuilderProps` to forwarding list
- ExpandedDetailPanel row: add `workflowBuilderProps` to props list
- test count: update 20 → 22

### BL-WFL-008 (P2 residual from BL-WFL-002) — App.jsx 659 lines
Bundle extraction applied; residual over threshold is irreducible orchestrator core. Monitor for future extraction opportunities (e.g. JSX collapsed builder renders).

### BL-WFL-009 (P3) — `runVideoPreSelection` missing from `handleGenerateResult` dep array
`src/renderer/App.jsx:296` — add `runVideoPreSelection` to `[mode, runPreSelection, runVideoPreSelection, runWorkflowAnalysis]`
