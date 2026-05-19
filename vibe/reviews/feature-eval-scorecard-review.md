# Review — FEATURE-EVAL-SCORECARD
> Date: 2026-05-19
> Reviewer: vibe-review (Senior Engineer + Architect + Code Quality Auditor)
> Scope: EVAL-001 through EVAL-007 — evaluate-prompt IPC, EvalPanel.jsx, wiring into ExpandedPromptReadyContent / EmailReadyState / WorkflowBuilderDoneState / ExpandedDetailPanel

---

## Automated checks

| Check | Result |
|-------|--------|
| `npm test` | ✅ 35/35 passed (1 file, 191ms) |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm audit` | ⚠️ 2 moderate vulnerabilities in `ip-address` — pre-existing (not introduced by this feature) |

---

## Graph pre-screening

DEPENDENCY_GRAPH.json exists. Pre-screening ran — **0 architectural violations** detected.

---

## Carryover from previous reviews

| ID | Finding | Status |
|----|---------|--------|
| BL-EMAIL-003 | App.jsx 724 lines — over P1 threshold (500). Pre-existing. | Open — not touched by this feature |
| BL-WFL-008 | App.jsx residual SRP — accepted, monitor only | Open — not touched |
| BL-EMAIL-010 | `TEAL_FULL` unused constant in EmailReadyState.jsx | Open — not touched |
| BL-EMAIL-011 | useState declaration order cosmetic issue in App.jsx | Open — not touched |
| BL-FINAL-002 | splash.html missing CSP meta tag | Open — not touched |
| BL-FINAL-003 | CODEBASE.md stale OperationErrorPanel line count | Open — not touched |

No carryover issues were worsened by this feature.

---

## Architecture drift detection

**ARCHITECTURE.md line 120:** "One component per file in `src/renderer/components/`. Functional components only."

🔴 ARCHITECTURE DRIFT — One component per file
   Decision: "One component per file in `src/renderer/components/`."
   Found: `src/renderer/components/EvalPanel.jsx` line 115
          `function ScoreColumn(...)` — second non-exported component defined in the same file as `EvalPanel`.
   Decision origin: ARCHITECTURE.md line 120
   Impact: Minor — ScoreColumn is tightly coupled to EvalPanel (not exported), but the rule exists to prevent hidden coupling and keep files scannable.
   Fix: Inline `ScoreColumn` as a JSX block directly inside `EvalPanel`, or extract to `src/renderer/components/EvalScoreColumn.jsx`.
   Severity: **P2** (architectural convention drift, no runtime impact)

---

## SOLID review

**SRP:** EvalPanel (145 lines) — single responsibility: fire eval IPC on mount, render toggle button + scorecard. ✅ Clean.

**OCP:** EvalPanel wired additively into done screens — no modification of existing action logic. ✅

**ISP:** EvalPanel has 2 props (`transcript`, `prompt`). ScoreColumn has 4 (`label`, `score`, `reasons`, `isPromptly`). Both well under 10-prop threshold. ✅

**DIP:** All IPC goes through `window.electronAPI.evaluatePrompt` — contextBridge abstraction layer. ✅

---

## Platform-specific review (Electron / React)

**IPC handler — `evaluate-prompt` (main.js):**

✅ `claudePath` null guard present (line 999)
✅ `transcript` + `prompt` falsy guard present (line 1000)
✅ `spawn(claudePath, ['-p', evalSystemPrompt], { env: makeClaudeEnv(claudePath) })` — correct PATH resolution pattern
✅ 30s timeout — kills child, resolves `{ success: false }` without throwing
✅ `child.on('error', ...)` handler clears timeout and resolves `{ success: false }`
✅ Fence-strip before JSON.parse — consistent with `parseEmailOutput` pattern
✅ Type validation: `typeof parsed.rawScore === 'number' && typeof parsed.promptlyScore === 'number'`
✅ No console.log / console.error added
✅ `timedOut` flag prevents double-resolve race between timeout and close handlers

⚠️ **Missing `child.stdin.end()`** (main.js, `evaluate-prompt` handler, ~line 1022):
   Every other spawn-based handler calls `child.stdin.end()` after setup:
   — `generate-prompt` → line 882
   — `check-claude` → line 923
   — `generate-raw` → line 971
   — `check-whisper` → line 1414
   The `evaluate-prompt` handler omits this call. While the `-p` flag means Claude CLI reads the prompt inline (not from stdin), the stdin pipe remains open. On some systems, this may delay the child process's natural close or produce zombie descriptors.
   **Severity: P2** — file: `main.js`, line ~1022. Fix: add `child.stdin.end()` after the `setTimeout` block.

**preload.js:**
✅ `evaluatePrompt: (args) => ipcRenderer.invoke('evaluate-prompt', args)` — correct channel name, correct `.invoke` (not `.send`). One line, no other changes.

**EvalPanel.jsx:**
✅ `useEffect([], [])` fires on mount — correct for fire-once IPC call
✅ `return null` on `evalFailed` — button disappears silently, no error shown to user
✅ `WebkitAppRegion: 'no-drag'` on toggle button — required for Electron draggable windows
✅ No `dangerouslySetInnerHTML` — reasons rendered as JSX text nodes via `• {r}`
✅ `maxHeight` + `opacity` transition — functional animation without CSS class toggling
✅ `reasons || []` defensive guard — handles missing reasons array without crashing
✅ `scoreColor` and `verdict` are pure helper functions — correct pattern
✅ `evalPrompt` in ExpandedPromptReadyContent correctly uses polished text for Polish mode (line 71: `isPolishMode ? (polishResult?.polished || generatedPrompt) : generatedPrompt`)

**Wiring — ExpandedDetailPanel.jsx:**
✅ `transcript={thinkTranscript}` passed to `ExpandedPromptReadyContent` (line 340)
✅ `transcript={thinkTranscript}` passed to `WorkflowBuilderDoneState` (line 432)
✅ `ImageBuilderDoneState` and `VideoBuilderDoneState` have NO `EvalPanel` — correct exclusion per spec

**Wiring — EmailReadyState.jsx:**
✅ `emailText = [emailOutput?.subject, emailOutput?.body].filter(Boolean).join('\n\n')` — correct; filter handles missing subject/body gracefully
✅ `transcript` prop already existed — no prop-chain changes required

---

## Code quality

**File sizes (all in bounds):**
| File | Lines | Threshold | Status |
|------|-------|-----------|--------|
| EvalPanel.jsx (new) | 145 | 500 | ✅ |
| ExpandedPromptReadyContent.jsx | 186 | 500 | ✅ |
| EmailReadyState.jsx | 444 | 500 | ✅ |
| WorkflowBuilderDoneState.jsx | 302 | 500 | ✅ |
| ExpandedDetailPanel.jsx | 475 | 500 | ✅ |
| main.js | 1645 | — | ✅ (no new P1 — main.js is exempt from component threshold) |

**Duplication:** No duplication introduced — `scoreColor` and `verdict` are local to EvalPanel, not candidates for shared utils (eval-specific logic).

---

## Security review

✅ No hardcoded secrets or tokens
✅ `transcript` and `prompt` interpolated into system prompt string — acceptable for local desktop app (not a web attack surface); no SQL/XSS risk
✅ `npm audit` 2 moderate vulnerabilities are pre-existing (`ip-address`) — not introduced by this feature

---

## Testing review

✅ 35 existing tests still pass — no regressions
ℹ️ No new unit tests added — `scoreColor` and `verdict` are pure functions with simple branching logic. Coverage acceptable for a feature-flag enhancement, but test coverage would strengthen confidence.
**P3:** `scoreColor` and `verdict` helper functions in `EvalPanel.jsx` have no unit tests. They have 5 and 5 branches respectively — straightforward to test in `tests/utils.test.js` if exported.

---

## Strengths

- **Zero App.jsx coupling** — EvalPanel owns all its state; no new transitions, no new state vars in the orchestrator. Cleanest possible integration.
- **Fire-on-mount, not on button-click** — eval runs in the background while the user reads their result; button is ready immediately. Smart UX design.
- **Silent failure** — `return null` on any error means a broken eval never pollutes the done screen. Exactly right for an optional enhancement.
- **Consistent patterns throughout** — `makeClaudeEnv`, fence-strip before parse, `WebkitAppRegion: 'no-drag'`, `ipcRenderer.invoke` — all follow established codebase conventions.
- **Score exclusions correct** — Image and Video done screens have no EvalPanel per spec; confirmed by reading ExpandedDetailPanel render tree.
- **Polish mode handled** — `evalPrompt` uses `polishResult?.polished` when in Polish mode, not the raw generatedPrompt. Spec-correct.

---

## Findings summary

| ID | Severity | File | Line | Finding |
|----|----------|------|------|---------|
| BL-EVAL-001 | P2 | `main.js` | ~1022 | `child.stdin.end()` missing in evaluate-prompt handler — inconsistent with all other spawn handlers |
| BL-EVAL-002 | P2 | `src/renderer/components/EvalPanel.jsx` | 115 | `ScoreColumn` is a second component in the same file — violates "one component per file" architecture rule |
| BL-EVAL-003 | P3 | `src/renderer/components/EvalPanel.jsx` | 137–141 | `scoreColor` and `verdict` pure functions have no unit tests; 10 branches untested |
| BL-EVAL-004 | P3 | `src/renderer/components/EvalPanel.jsx` | 138 | `key={i}` (array index) used in reasons list — stable keys not required here (static list), but React best practice is a content-derived key |

---

## Quality score

| Category | Deductions |
|----------|------------|
| P2 findings (2) | −0.4 |
| P3 findings (2) | −0.2 |
| **Total** | **−0.6** |

**Score: 9.4 / 10 — Grade A**

---

## Gate decision

✅ **PASS** — 0 P0, 0 P1 issues.
P2 findings logged to backlog. No blocking issues.
Feature is shippable after smoke test confirms visual rendering.
