# Feature Review — FEATURE-WORKFLOW-BUILDER
> Reviewed: 2026-04-29 | Branch: feat/workflow-builder | Reviewer: vibe-review skill
> Scope: WFL-001 through WFL-011 (11 tasks, 19 files changed, +2133 / -26 lines)

---

## Automated Checks

| Check | Result |
|-------|--------|
| `npm test` | ✅ 20/20 passing (1 file) |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm audit` | ✅ 0 vulnerabilities |

---

## Concept Graph Pre-screening

✅ 0 concept boundary violations — clean. All new components import from `hooks/` and `utils/` only. No backend/agent cross-imports.

---

## Carryover Check

| ID | Finding | Status |
|----|---------|--------|
| P3-VID-001 | `ExpandedDetailPanel.jsx` 23 props — open since video builder review | Still open — now 24 props after `workflowBuilderProps` addition. 2nd review appearance; no escalation triggered (P3 escalation not defined in rules). |
| BL-060 | `PolishReadyState.jsx` narrow width crowding | Still open / monitoring |

---

## Architecture Drift

### 🟡 DOC DRIFT — ARCHITECTURE.md state count stale
**Section:** State management > States count
**Decision:** "States (13 total — 6 original + SHORTCUTS, HISTORY, PAUSED, ITERATING, TYPING, SETTINGS, IMAGE_BUILDER, IMAGE_BUILDER_DONE added via features)"
**Found:** `vibe/ARCHITECTURE.md` line 81 — count still says 13 total. WORKFLOW_BUILDER and WORKFLOW_BUILDER_DONE (added by this feature) are absent from the state machine description.
**Impact:** Future agents reading ARCHITECTURE.md get wrong state count; new mode additions might miss update pattern.
**Severity:** P2 (doc drift, not code drift)
**Fix:** Update count to 15; add WORKFLOW_BUILDER + WORKFLOW_BUILDER_DONE lines to state diagram.

### 🟡 DOC DRIFT — Prompt modes table missing 'workflow'
**Section:** Prompt modes table (`vibe/ARCHITECTURE.md` line ~309)
**Found:** Table has 9 rows (Balanced through Image) but no `workflow` row. Video builder was added in the previous feature but is also absent. This is a recurring doc-update miss pattern.
**Severity:** P2 (doc drift)
**Fix:** Add `workflow` row: `| Workflow | \`workflow\` | Two-phase: generate-prompt passthrough → Phase 1 generate-raw (Claude maps idea → n8n node analysis JSON → WORKFLOW_BUILDER) → Phase 2 generate-raw (Claude assembles importable n8n JSON) → WORKFLOW_BUILDER_DONE; green accent in UI |`

**Code compliance: ✅ All code-level architecture rules followed.** No `dangerouslySetInnerHTML` with generated content, IPC only via `window.electronAPI`, `localStorage` only via wrappers, all transitions via `transitionRef.current()`, `claudePath` used correctly via `generate-raw`.

---

## SOLID Principles

### 🔴 P1 — SRP: App.jsx 750 lines (threshold: 500)
**File:** `src/renderer/App.jsx` — 750 lines
**Context:** App.jsx was resolved at ~530 lines (BL-VID-003, 2026-04-28). The workflow builder additions push it to 750 — 250 lines over the P1 threshold. The growth pattern:
- Pre-workflow: ~684 lines (video builder added ~154)
- Post-workflow: 750 lines (+66)
- The `workflowBuilderProps` bundle (lines 508–527) and workflow hook destructuring (lines 258–272) are the main additions.

**Root cause:** Each builder mode adds ~60–80 lines of state vars, props bundle construction, and handleGenerateResult routing. App.jsx is now the second-largest file after ExpandedDetailPanel.

**Fix:** Extract `workflowBuilderProps` bundle construction to `useWorkflowBuilder` hook as a return value (like `videoBuilderProps` from `useVideoBuilder`). Move `workflowIsSaved`/`workflowIsCopied` aliasing into hook return. This reduces App.jsx by ~25 lines and co-locates bundle with its logic. Additionally consider extracting the `imageBuilderProps` and `videoBuilderProps` bundle construction from App.jsx for the same reason.

### ✅ WorkflowBuilderState.jsx — 452 lines (under 500) ✅
### ✅ WorkflowBuilderDoneState.jsx — 296 lines ✅
### ✅ useWorkflowBuilder.js — 251 lines ✅
### ✅ ExpandedDetailPanel.jsx — 430 lines ✅
### ✅ ExpandedTransportBar.jsx — 357 lines ✅
### ✅ IdleState.jsx — 221 lines ✅

---

## Code Quality Findings

### 🔴 P1 — Functional bug: blank node fill-count never increments
**File:** `src/renderer/components/WorkflowBuilderState.jsx` lines 26–33
**Code:**
```js
const filledCount = nodes.reduce((sum, node) => {
  const blankFilled = (node.name && node.type) ? ((!node.id || node.id > 0) ? 1 : 0) : 0
  const paramsFilled = (node.placeholders || []).filter(
    pk => filledPlaceholders[`${node.id}-${pk}`]
  ).length
  return sum + paramsFilled   // ← blankFilled is computed but NEVER added to sum
}, 0)
```

**`blankFilled` is computed but never added to `sum`.** The reducer only adds `paramsFilled`.

**Combined with `totalPlaceholders`:**
```js
const totalPlaceholders = nodes.reduce((sum, node) => {
  const blanks = (!node.name || !node.type) ? 1 : 0   // ← counts blank nodes
  return sum + (node.placeholders?.length || 0) + blanks
}, 0)
```

When a user clicks "Add another node", a blank node `{ name: '', type: '', placeholders: [] }` is appended. This adds 1 to `totalPlaceholders`. The user fills in name/type via the inline inputs (stored as `nodeId-__name__` and `nodeId-__type__` in `filledPlaceholders`). But:
1. `filledCount` iterates `node.placeholders` (empty array) → contributes 0
2. `blankFilled` is computed correctly (1 when name+type filled) but **silently discarded**

**Result:** `allFilled` is permanently false when any user-added blank node exists, even after the user fills it in. The Confirm button (line 432) can never be enabled once a blank node is added.

**Fix:**
```js
return sum + paramsFilled + blankFilled  // add blankFilled to sum
```

---

### 🟡 P2 — getModeTagStyle('workflow') not in test suite
**File:** `tests/utils.test.js`
The `getModeTagStyle` describe block (line 43–80) tests 6 cases (polish, refine, image, design, standard prose, unknown). `'workflow'` was added to `promptUtils.js` (WFL-009) but no corresponding test was added. This breaks the pattern established in the video builder review where 'image' and 'design' tests were added retroactively.
**Fix:** Add test:
```js
it('returns green tones for workflow mode', () => {
  const style = getModeTagStyle('workflow')
  expect(style.background).toContain('34,197,94')
  expect(style.color).toContain('74,222,128')
})
```

---

### 🔵 P3 — handleWorkflowConfirm calls setThinkingLabel redundantly
**File:** `src/renderer/hooks/useWorkflowBuilder.js` lines 193–196
```js
const handleWorkflowConfirm = useCallback((analysis, placeholders) => {
  setThinkingLabel('Assembling JSON...')   // ← line 194 — redundant
  assembleWorkflowJson(analysis, placeholders)  // assembleWorkflowJson sets it again at line 122
}, [assembleWorkflowJson, setThinkingLabel])
```
`assembleWorkflowJson` already calls `setThinkingLabel('Assembling JSON...')` at line 122. The call at line 194 fires first, then is immediately overwritten. **Harmless** but dead code that confuses readers. Remove line 194.

---

### 🔵 P3 — onReiterate in App.jsx sets isWorkflowReiteratingRef twice
**File:** `src/renderer/App.jsx` line 518
```js
onReiterate: () => { handleWorkflowReiterate(); isWorkflowReiteratingRef.current = true; startRecording() },
```
`handleWorkflowReiterate()` (hook line 198–200) already executes `isReiteratingRef.current = true`. `isWorkflowReiteratingRef` in App.jsx is the same ref (`isReiteratingRef: isWorkflowReiteratingRef` from the destructure at line 264). The second assignment `isWorkflowReiteratingRef.current = true` is redundant. Remove the explicit assignment and leave only `handleWorkflowReiterate()`.

---

### 🔵 P3 — P3-VID-001 carryover: ExpandedDetailPanel props (24)
**File:** `src/renderer/components/ExpandedDetailPanel.jsx`
`workflowBuilderProps` was added, bringing the prop count from 23 → 24. This was P3-VID-001 (open since video builder review). Second review with this open. No escalation per rules (P3 escalation not defined). Tracking for future refactor.

---

## Security Review

| Check | Result |
|-------|--------|
| Hardcoded secrets / API keys | ✅ None |
| `dangerouslySetInnerHTML` with user/Claude content | ✅ Absent — JSON highlighted via JSX map `renderHighlightedJson()` |
| IPC surface — no new channels added | ✅ Uses existing `generate-raw` only |
| PATH resolution — `claudePath` used in `generate-raw` | ✅ |
| `localStorage` outside wrappers | ✅ None |
| `npm audit` | ✅ 0 vulnerabilities |
| System prompt transcript interpolation | ⚠️ `${transcript}` inline (line 47, useWorkflowBuilder.js) — same pattern as existing modes; low risk in desktop+speech context |

---

## Testing Review

| Check | Result |
|-------|--------|
| `getModeTagStyle('workflow')` tested | ❌ Missing — P2 finding above |
| `useWorkflowBuilder` hook unit tests | Per project testing philosophy (manual smoke checklist is the test suite) — no hook unit tests required |
| Blank node fill-count bug | Would have been caught by a unit test; flagged as P1 functional bug above |
| Manual smoke checklist in FEATURE_TASKS.md | ✅ 19-item conformance checklist — all ticked |

---

## Strengths

- `useWorkflowBuilder.js` cleanly follows the `useVideoBuilder`/`useImageBuilder` hook pattern — consistent architecture, easy to follow.
- Phase 1 + Phase 2 error handling is thorough: parse failure, empty nodes, IPC failure, and JSON validation each route to ERROR with specific messages.
- `assembleWorkflowJson` correctly takes explicit `(analysis, placeholders)` arguments rather than closing over state — avoids stale-closure bugs in async callbacks.
- `isReiteratingRef` as a ref (not state) is architecturally correct — survives the recording flow without spurious re-renders.
- JSON syntax highlighting via custom `renderHighlightedJson()` + JSX map is exactly the right approach (no library, no innerHTML, P0-safe).
- `isFullViewMode = isVideo || isWorkflow` grouping in `ExpandedTransportBar.jsx` is clean — extends the pattern without repetition.
- `WebkitAppRegion: 'no-drag'` correctly applied to all interactive elements in both new components.
- `saveToHistory` called in `assembleWorkflowJson` (not in a separate save handler) — matches image/video builder pattern and ensures ExpandedHistoryList refreshes on state transition.
- Lint: 0 errors, tests: 20/20, audit: 0 vulns — clean automated baseline.

---

## Quality Score

| Category | Deductions |
|----------|-----------|
| P1 findings × 2 | -2.0 |
| P2 findings × 2 | -1.0 |
| P3 findings × 3 | -0.3 |
| Architecture drift (doc only) | included in P2 |
| **Total** | **-3.3** |

**Score: 6.7 / 10 — Grade C+**

---

## Gate Decision

🔴 **BLOCKED** — 2 P1 issues must be resolved before merging to main.

Fix tasks added to TASKS.md below.

---

## RFX Tasks (P1 fixes required)

### RFX-WFL-001 · WorkflowBuilderState.jsx:33 — blank node fill-count bug
**File:** `src/renderer/components/WorkflowBuilderState.jsx` line 33
**Fix:** Change `return sum + paramsFilled` to `return sum + paramsFilled + blankFilled`

### RFX-WFL-002 · App.jsx SRP — 750 lines over P1 threshold
**File:** `src/renderer/App.jsx`
**Fix:** Extract `workflowBuilderProps` bundle construction into `useWorkflowBuilder.js` as a return value. Also extract `imageBuilderProps` and `videoBuilderProps` bundles from App.jsx to their respective hooks. Goal: bring App.jsx under 600 lines.
