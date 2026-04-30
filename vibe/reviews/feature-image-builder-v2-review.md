# Review — FEATURE-IMAGE-BUILDER-V2
> Date: 2026-04-30 · Reviewed by: vibe-review skill
> Branch: feat/image-builder-v2

---

## Automated checks

| Check | Result |
|-------|--------|
| `npm test` | ✅ PASS — 35/35 tests |
| `npm run lint` | ✅ PASS — 0 errors, 0 warnings |
| `npm audit` | ✅ PASS — 0 vulnerabilities |
| Concept boundary graph | ✅ PASS — 0 cross-concept violations |

---

## Carryover from previous reviews

| ID | Finding | Status |
|----|---------|--------|
| BL-EMAIL-003 | App.jsx 724 lines — P1 SRP carryover from final/email reviews | ⚠️ WORSENED — now 758 lines (+34) |
| BL-FINAL-002 | splash.html missing CSP meta tag — P2 | ❌ NOT ADDRESSED (out of scope for this feature) |
| BL-EMAIL-010 | Dead TEAL_FULL constant in EmailReadyState.jsx — P3 | ❌ NOT ADDRESSED (out of scope) |
| BL-EMAIL-011 | useState ordering in App.jsx — P3 cosmetic | ❌ NOT ADDRESSED (out of scope) |
| P3-EXP-002 | ExpandedDetailPanel 24 props — P3 monitor | ❌ Remains open |
| BL-IMG-001 | useImageBuilder extraction — P3 | ✅ RESOLVED (was resolved before this feature) |

---

## Architecture compliance

| Rule | Result |
|------|--------|
| All transitions via `transition()` | ✅ `runPreSelection` + `assembleImagePrompt` call `transitionRef.current()` |
| IPC only via `window.electronAPI` | ✅ `generateRaw`, `copyToClipboard`, `setWindowButtonsVisible` all via API |
| No `dangerouslySetInnerHTML` | ✅ All text via JSX text nodes |
| `localStorage` only via wrappers | ✅ `saveToHistory` and `useMode()` only — no direct access |
| Zero runtime npm deps | ✅ `npm audit` 0 vulnerabilities |
| One component per file | ✅ VariationsPanel.jsx, ImageBuilderDoneState.jsx, ImageBuilderState.jsx all single exports |
| `originalTranscript` not mutated | ✅ Read-only throughout image builder flow |
| Purple accent `rgba(139,92,246,0.85)` | ✅ Set via `setThinkingAccentColor` in both phase 1 and phase 2 |

---

## Acceptance criteria — 9/9 PASS

| # | Criterion | Status |
|---|-----------|--------|
| 1 | IMG2-001: Phase 1 prompt uses new nested JSON schema (5 tabs) | ✅ |
| 2 | IMG2-002: useImageBuilder.js fully rewritten with variations + phase 2 | ✅ |
| 3 | IMG2-003: ImageBuilderState has 5 category tabs + Zone A/B layout | ✅ |
| 4 | IMG2-004: Technical tab with NumericParamRow + 48-preset strip | ✅ |
| 5 | IMG2-005: VariationsPanel.jsx new component, skeleton loading, select/generate | ✅ |
| 6 | IMG2-006: parseImageAnalysisOutput + parseImageAssemblyOutput in promptUtils.js + tests | ✅ |
| 7 | IMG2-007: App.jsx wired via imageBuilderProps bundle, setThinkingAccentColor added | ✅ |
| 8 | IMG2-008: ImageBuilderDoneState splits prompt/flags, flattenAnswers for nested v2 schema | ✅ |
| 9 | IMG2-009: CODEBASE.md, DECISIONS.md, TASKS.md all updated | ✅ |

---

## Findings

### P1 — Fix before merge

**P1-IMG2-001 — ImageBuilderState.jsx 733 lines — SRP violation**
- File: `src/renderer/components/ImageBuilderState.jsx` · lines 1–733
- Issue: 733 lines, 233 over the P1 threshold (500). Contains: 5 tab param definitions, 48 preset definitions, 4 internal components (Chip, ParamRow, NumericParamRow, NegativeRow, SeedRow), and the export default. The preset data alone (`PRESET_CATEGORIES`) accounts for ~130 lines; the param definitions (SUBJECT_PARAMS, LIGHTING_PARAMS, CAMERA_PARAMS, STYLE_PARAMS, TECHNICAL_PARAMS, TECHNICAL_NUMERIC_PARAMS) add ~60 lines. These are pure data — extractable to a sibling constants file without logic changes.
- Fix: Extract `PRESET_CATEGORIES`, `SUBJECT_PARAMS`, `LIGHTING_PARAMS`, `CAMERA_PARAMS`, `STYLE_PARAMS`, `TECHNICAL_PARAMS`, `TECHNICAL_NUMERIC_PARAMS`, and `REQUIRED` to `src/renderer/components/ImageBuilderState.constants.js`. Re-import in `ImageBuilderState.jsx`. Reduces file to ~545 lines, with a second pass opportunity to extract `Chip` + `ParamRow` sub-components.

**P1-IMG2-002 — App.jsx 758 lines — SRP carryover worsened (BL-EMAIL-003)**
- File: `src/renderer/App.jsx` · lines 1–758
- Issue: 758 lines, 258 over threshold. Was 724 before this feature; this feature added net +34 lines (new setThinkingAccentColor call, small THINKING state setup). Carryover of BL-EMAIL-003. Further extraction opportunities: `handleTypingSubmit` + `handleRegenerate` (~25 lines) → `useTextInput`; `handleExpand`/`handleCollapse` + mode-effect (~15 lines) → `useWindowLayout`.
- Fix: Extract `handleTypingSubmit` and `handleRegenerate` into a `useTextInput` hook. This is the largest extractable cohesive block remaining.

---

### P2 — Fix before deploy

**P2-IMG2-001 — FIELD_LABELS constant duplicated with silent divergence**
- Files: `src/renderer/components/ImageBuilderState.jsx` line 150; `src/renderer/components/ImageBuilderDoneState.jsx` line 3
- Issue: Identical constant defined in two files. Already diverged: `angle: 'Camera angle'` (ImageBuilderState) vs `angle: 'Angle'` (ImageBuilderDoneState). Any future field rename will require a two-file update with no lint enforcement.
- Fix: Extract to `src/renderer/components/ImageBuilderState.constants.js` (same file as P1-IMG2-001 fix). Import in both components. Eliminates the divergence vector.

**P2-IMG2-002 — fenceParse never consolidated with promptUtils.js exports**
- File: `src/renderer/hooks/useImageBuilder.js` line 3 (comment) + lines 5–11 (`fenceParse`)
- Issue: Comment at line 3 says "Inline fence-stripping parse helpers (will be moved to promptUtils.js in IMG2-006)". IMG2-006 was completed — it added `parseImageAnalysisOutput` and `parseImageAssemblyOutput` to promptUtils.js — but `useImageBuilder.js` was never updated to use them. The hook's `fenceParse`, `parsePhase1`, `parseVariations`, and `parsePhase2` are all still local. The promptUtils exports are only exercised by the test file, never by production code. Result: two independent JSON fence-stripping implementations, plus the stale comment that implies completion of work that never finished.
- Fix: Update `parsePhase2` in `useImageBuilder.js` to use `parseImageAssemblyOutput` from promptUtils.js. Remove local `fenceParse` and update `parsePhase1`/`parseVariations` to use `parseImageAnalysisOutput` internally (or accept it as an argument). Remove stale comment.

**P2-IMG2-003 — Dead compact layout retained in ImageBuilderDoneState.jsx**
- File: `src/renderer/components/ImageBuilderDoneState.jsx` line 133
- Issue: 37-line `return (...)` block under comment `// Compact bar layout (dead path — image mode always expands)`. Author correctly identified it as dead code, but left it in. The compact path cannot be reached because IMAGE_BUILDER_DONE is always rendered inside ExpandedView where `isExpanded` is always true.
- Fix: Delete lines 133–170 (the compact return block). If `isExpanded` prop is no longer needed, remove from the props destructure too.

**P2-IMG2-004 — ARCHITECTURE.md image mode description still describes v1 flow**
- File: `vibe/ARCHITECTURE.md` line 325
- Issue: Entry reads "Two-phase flow: generate-prompt passthrough → Phase 1 generate-raw... → Phase 2 generate-raw... → IMAGE_BUILDER_DONE". The v2 rewrite introduces a third phase (Phase 1.5 — variations in parallel). The description also references the old flat param schema ("pre-selects all params as JSON → imageDefaults") which is now a nested 5-tab schema.
- Fix: Update line 325 to describe the v2 three-phase flow: Phase 1 (analysis → nested imageDefaults), Phase 1.5 (variations in background via generateVariations), Phase 2 (selected variation + confirmed params → assembled prompt + flags). Add note about `--parameter` flags being output in a separate field.

---

### P3 — Monitor / minor cleanup

**P3-IMG2-001 — parseImageAnalysisOutput and parseImageAssemblyOutput are identical**
- File: `src/renderer/utils/promptUtils.js` lines 46–78
- Issue: Both functions have the same body — fence-strip + JSON.parse with outermost-brace fallback. No meaningful distinction. If the assembly response ever needs different error handling, the duplication creates a divergence risk.
- Suggestion: Either merge into one `parseImageJsonOutput(raw)` used by both callers, or have one delegate to the other.

**P3-IMG2-002 — generateVariations fails silently with no user signal**
- File: `src/renderer/hooks/useImageBuilder.js` lines 211–226
- Issue: If the variations API call fails (`!result.success` or `newVars.length === 0`), `isGeneratingVariations` resets to false and the VariationsPanel shows "0 variations · tap to select" indefinitely. Users may not know variations failed vs. are still loading.
- Suggestion: On failure, set a minimal fallback state (e.g., set `imageVariations` to a placeholder array or show a retry affordance). Low severity given variations are supplementary to the main flow.

**P3-IMG2-003 — buildPhase1Prompt / buildVariationsPrompt / buildPhase2Prompt are pure but untested**
- File: `src/renderer/hooks/useImageBuilder.js` lines 13–161
- Issue: Three pure functions that build large system prompts. Any regression in prompt construction (wrong field names, malformed JSON example, missing rules) would only surface at runtime. Consistent with project testing philosophy but worth noting given the prompt complexity.
- Suggestion: Add snapshot or integration tests for the assembled prompt strings if prompt engineering quality becomes critical.

---

## Component metrics

| File | Lines | Status |
|------|-------|--------|
| `ImageBuilderState.jsx` | 733 | 🔴 P1 — 233 over threshold |
| `App.jsx` | 758 | 🔴 P1 — 258 over threshold (carryover, worsened) |
| `useImageBuilder.js` | 433 | ⚠️ P1-adjacent — monitor |
| `VariationsPanel.jsx` | 87 | ✅ Focused |
| `ImageBuilderDoneState.jsx` | 170 | ✅ Acceptable |
| `promptUtils.js` | 84 | ✅ Acceptable |

---

## Strengths

- **3-phase architecture** (analysis → variations-in-background → assembly) is clean and non-blocking. Firing `generateVariations` alongside the IMAGE_BUILDER state mount is the right call — user sees parameters immediately, variations populate without a wait state.
- **imageBuilderProps bundle** spread pattern at App.jsx call site is a major improvement over the v1's 14 explicit props. Clean encapsulation.
- **parsePhase1 merge logic** (reiterate path, lines 243–278) correctly distinguishes user-changed values from AI-filled values using `userChanged = currentVal !== oldAiDefault && currentVal !== ''` — this is the right invariant and avoids the stale-state async bug that was P1-001 in the v1 review.
- **VariationsPanel skeleton loading** (3 pulse rows, `skeleton-pulse` CSS class) shows good loading state UX for a background async operation.
- **flattenAnswers** in ImageBuilderDoneState.jsx correctly handles the nested v2 schema and special-cases `negativePrompts` as a comma-joined "Avoid" row.
- **Test suite**: 6 new test cases for `parseImageAnalysisOutput` and `parseImageAssemblyOutput` covering fence variants, raw JSON, and null inputs — 35 tests total, all passing.

---

## Quality score

| Deduction | Amount |
|-----------|--------|
| P1-IMG2-001 (ImageBuilderState.jsx 733 lines) | −0.5 |
| P1-IMG2-002 (App.jsx 758 lines, carryover worsened) | −0.5 |
| P2-IMG2-001 (FIELD_LABELS duplication + divergence) | −0.2 |
| P2-IMG2-002 (fenceParse not consolidated, stale comment) | −0.2 |
| P2-IMG2-003 (dead compact layout retained) | −0.2 |
| P2-IMG2-004 (ARCHITECTURE.md v1 image mode description) | −0.2 |
| P3-IMG2-001 (identical parseImage* bodies) | −0.1 |
| P3-IMG2-002 (generateVariations silent failure) | −0.1 |
| P3-IMG2-003 (prompt builders untested) | −0.1 |
| **Total deductions** | **−2.1** |

**Final score: 7.9 / 10 — Grade C+**

---

## Gate decision

✅ **PASS** — 0 P0 issues.
2 P1 fix tasks added to TASKS.md (RFX-IMG2-001, RFX-IMG2-002).
4 P2 + 3 P3 logged to backlog.md.
