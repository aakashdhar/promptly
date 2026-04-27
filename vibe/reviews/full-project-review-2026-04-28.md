# Full Project Review — Promptly (Post-Fix Re-run)
> Date: 2026-04-28 v2 | Scope: Full codebase | Model: claude-sonnet-4-6
> Focus: Post-P2R fix verification — BL-071/072/073/074 applied

---

## Automated checks

### `npm test`
```
> promptly@1.5.0 test
> vitest run

 RUN  v4.1.5 /Users/aakash-anon/Documents/GitHub-personal/promptly

 ✓ tests/utils.test.js (18 tests) 18ms

 Test Files  1 passed (1)
      Tests  18 passed (18)
   Duration  156ms
```
✅ All 18 tests pass. Vitest running at v4.1.5 (upgraded from 2.1.9 — P2R-004 resolved).

### ESLint (`npm run lint`)
```
> promptly@1.5.0 lint
> eslint main.js preload.js
(no output — 0 errors, 0 warnings)
```
✅ Lint clean. Zero `console.log` statements in production source.

### `npm audit`
```
found 0 vulnerabilities
```
✅ Zero vulnerabilities. Previous 5 moderate devDep vulns fully resolved by vitest@4.1.5 upgrade.

---

## Carryover check

**Previous review:** full-project-review-2026-04-28.md (v1) — Score 9.0/10 (Grade A) — 0 P0, 0 P1, 4 P2, 2 P3

All 4 P2 fixes confirmed resolved via commits BL-071/072/073/074:

| ID | Finding | Status |
|----|---------|--------|
| P2R-001 | CODEBASE.md missing 7 new files + 3 stale line counts | ✅ RESOLVED — `vibe/CODEBASE.md` — all 7 files added; ExpandedDetailPanel corrected 496→346, HistoryPanel 663→362, App.jsx 548→466. BL-071 commit. |
| P2R-002 | Dead `renderPromptSections` in `ExpandedPromptReadyContent.jsx:4-38` | ✅ RESOLVED — `ExpandedPromptReadyContent.jsx` verified: file starts at `import { useState, useRef, useEffect }` — no dead function present. File reduced 215→179 lines. BL-072 commit. |
| P2R-003 | `renderPromptSections` triplicated across HistoryDetailPanel + ExpandedDetailPanel + ExpandedPromptReadyContent | ✅ RESOLVED — `HistoryDetailPanel.jsx:2` imports `PromptSections` component; renders at line 74 via `<PromptSections prompt={selected.prompt} ... />`. `ExpandedDetailPanel.jsx:5` imports `PromptSections`; renders at lines 119. Both files fully deduped. BL-073 commit. |
| P2R-004 | npm audit 5 moderate devDep vulnerabilities (vitest 2.1.9) | ✅ RESOLVED — `package.json` now shows `"vitest": "^4.1.5"`; `npm audit` returns `found 0 vulnerabilities`. BL-074 commit. |

Open P3 carryovers:

| ID | Status |
|----|--------|
| P3-001 | ⚠️ STILL OPEN — `useIteration.js:105` — `dismissIterating` is a plain function, not `useCallback`. Stylistic inconsistency only. |
| P3-002 | ✅ No action needed — informational only (HistoryDetailPanel `onCopy` prop design is correct). Closed. |
| P3-003 | ⚠️ STILL OPEN — `getModeTagStyle` missing test for `design` mode (falls through to blue default). Low priority. |

---

## Architecture drift detection

| Rule | Status | Evidence |
|------|--------|---------|
| `localStorage` only via wrapper functions | ✅ | Zero direct `localStorage.*` in any component |
| No `dangerouslySetInnerHTML` | ✅ | Zero occurrences codebase-wide |
| One component per file in `src/renderer/components/` | ✅ | All files match one-component-per-file pattern |
| `PromptSections.jsx` correctly placed | ✅ | `src/renderer/components/PromptSections.jsx` — correct location per ARCHITECTURE.md folder rule |
| CODEBASE.md updated after dedup fix | ⚠️ | CODEBASE.md was updated for the 7 previously-missing files (P2R-001 fix) but the dedup commit (BL-073) further reduced line counts: ExpandedPromptReadyContent 215→179, HistoryDetailPanel 203→168, ExpandedDetailPanel 346→311. These three counts are now stale again. See P2-001 below. |

**No P0-level architecture drift detected.**

---

## Findings

### P0 — Critical (blocks)

**None.**

---

### P1 — Fix before deploy

**None.**

---

### P2 — Should fix

#### P2-001 — CODEBASE.md three stale line counts after BL-073 dedup commit
- **File:** `vibe/CODEBASE.md`
- **Evidence:** The BL-073 commit replaced local `renderPromptSections` functions in `HistoryDetailPanel.jsx` and `ExpandedDetailPanel.jsx` with the `PromptSections` component (removing ~35 lines each), and the BL-072 commit removed the dead `renderPromptSections` from `ExpandedPromptReadyContent.jsx` (~36 lines). CODEBASE.md was not updated to reflect these reductions:
  - `ExpandedPromptReadyContent.jsx`: listed as 215 lines → actual **179 lines** (−36)
  - `HistoryDetailPanel.jsx`: listed as 203 lines → actual **168 lines** (−35)
  - `ExpandedDetailPanel.jsx`: listed as 346 lines → actual **311 lines** (−35)
- **Fix:** Update the three line counts in the CODEBASE.md file map table.
- **Severity:** P2 — CODEBASE.md is the agent's live reference. Stale line counts are lower severity than missing entries, but still create confusion about component size when diagnosing SRP thresholds.

---

### P3 — Minor / nice to have

#### P3-001 (carryover) — `dismissIterating` plain function vs `useCallback` in useIteration.js
- **File:** `src/renderer/hooks/useIteration.js:105`
- **Evidence:** `handleIterate` (line 23) and `stopIterating` (line 41) are both wrapped in `useCallback(..., [])`. `dismissIterating` (line 105) is a plain `function` declaration. No correctness issue — stable-ref pattern means re-creation on render doesn't cause stale reads. Cosmetic inconsistency only.
- **Fix:** Wrap in `useCallback(() => {...}, [])` for consistency with sibling functions.
- **Severity:** P3 — No correctness issue.

#### P3-002 — `PromptSections.jsx` uses inline regex diverging from `parseSections` in promptUtils.js
- **File:** `src/renderer/components/PromptSections.jsx:8`
- **Evidence:** `PromptSections` uses `/^[A-Z][A-Z\s/]+:/` to identify section labels. `parseSections` in `promptUtils.js` uses `/^([A-Za-z][A-Za-z\s/]*):\s*$/`. The differences:
  - `parseSections` accepts lowercase-starting labels (`[A-Za-z]`); `PromptSections` requires uppercase-starting (`[A-Z]`).
  - `parseSections` anchors at end-of-line (`$`) and allows trailing whitespace; `PromptSections` does not anchor at end.
  - This means edge-case label parsing will differ between the shared component and the utility function.
  - In practice, all Claude-generated sections start with uppercase labels (e.g. `GOAL:`, `CONTEXT:`) so divergence is currently benign.
- **Fix:** Align `PromptSections.jsx` to use the same regex as `parseSections` (`/^([A-Za-z][A-Za-z\s/]*):\s*$/`), or extract the regex as a shared constant imported by both. Low urgency.
- **Severity:** P3 — No current impact on any prompt output. Future-proofing only.

#### P3-003 (carryover) — `getModeTagStyle` missing test for `design` mode
- **File:** `tests/utils.test.js`
- **Evidence:** 4 tests cover `getModeTagStyle` but none tests `'design'` mode. Currently `design` falls through to the blue default (`{ background: 'rgba(10,132,255,0.1)', color: 'rgba(100,170,255,0.9)' }`). If a future PR adds a distinct design colour, the test gap would allow a regression.
- **Fix:** Add one test: `expect(getModeTagStyle('design')).toEqual({ background: 'rgba(10,132,255,0.1)', color: 'rgba(100,170,255,0.9)' })` to lock the current default behaviour.
- **Severity:** P3 — Low probability of regression. Test takes 2 minutes to add.

---

## Security review

| Check | Status |
|-------|--------|
| Hardcoded tokens/keys | ✅ None in codebase |
| `dangerouslySetInnerHTML` with user/Claude content | ✅ Zero occurrences |
| `contentEditable` usage | ✅ `ExpandedPromptReadyContent.jsx:101` — edit mode only; reads `.textContent` on save — no XSS vector |
| `localStorage` direct access outside wrappers | ✅ None |
| `nodeIntegration` | ✅ Both BrowserWindows confirmed `nodeIntegration: false` |
| npm audit | ✅ 0 vulnerabilities (all 5 previous moderate devDep vulns resolved by vitest@4.1.5) |
| console.log in production code | ✅ Zero — grep across src/renderer, main.js, preload.js returns empty |

**Security summary: Clean. Zero findings.**

---

## SOLID principles review

| File | Lines | SRP | ISP | Notes |
|------|-------|-----|-----|-------|
| `App.jsx` | 466 | ✅ | ✅ | Well below P1 (500) threshold. Recording + keyboard delegated to hooks. |
| `ExpandedView.jsx` | 100 | ✅ | ✅ | Thin orchestrator. Props count is high (24) but boundary-layer necessity — all passed through from App.jsx. |
| `ExpandedDetailPanel.jsx` | 311 | ✅ | ⚠️ | Down from 346 after dedup. Still 15 props — boundary layer necessity, no avoidable prop. |
| `ExpandedPromptReadyContent.jsx` | 179 | ✅ | ✅ | Down from 215 (dead code removed). 9 props. Clean. |
| `HistoryDetailPanel.jsx` | 168 | ✅ | ✅ | Down from 203 (PromptSections migration). 6 props. Clean. |
| `PromptSections.jsx` | 36 | ✅ | ✅ | Single responsibility: render labelled prompt sections. 4 props with sensible defaults. |
| `useIteration.js` | 118 | ✅ | ✅ | Ref-based hook pattern. 12 params — all structurally required for stable-ref sharing. |
| `main.js` | 1064 | ⚠️ | ✅ | Unchanged. Single-file Electron main — accepted architecture by design. |

All components that were P1/P3 concerns in previous reviews are now comfortably below thresholds.

---

## Testing review

| Check | Status |
|-------|--------|
| Test runner | ✅ Vitest v4.1.5 — `npm test` passes |
| All tests pass | ✅ 18/18 |
| Test names describe behaviour | ✅ All behaviour-focused |
| AAA structure | ✅ Present in all 18 tests |
| Edge cases | ✅ Empty input, null, missing markers, multiline, slash labels |
| npm audit | ✅ 0 vulnerabilities |

---

## Document completeness audit

| Document | Status | Notes |
|----------|--------|-------|
| `vibe/CODEBASE.md` | ⚠️ P2 | 3 stale line counts from BL-072/073 dedup (P2-001 above). All 7 previously-missing files are now present. |
| `vibe/ARCHITECTURE.md` | ✅ | Current. Window lifecycle, ExpandedView dimensions at 1100×860, all IPC channels correct. |
| `CLAUDE.md` | ✅ | Clean. Stale sections removed in previous session. |
| `vibe/TASKS.md` | ✅ | All P2R tasks ticked. Gate status current. |

---

## Strengths

1. **All 4 P2R issues resolved in a single commit batch (BL-071/072/073/074)** — dead code removed, deduplication complete, audit clean, docs updated. Clean sweep.

2. **`PromptSections.jsx` is the right abstraction** — the deduplication was done at the React component level (shared rendering component) rather than just sharing a utility function. This is cleaner than the previous architecture where three files each rendered their own JSX from local parse functions.

3. **Zero npm audit vulnerabilities** — project returned to clean audit status. The vitest@4.1.5 upgrade was non-breaking: all 18 tests pass unchanged.

4. **Component size trajectory is healthy** — ExpandedPromptReadyContent (179), HistoryDetailPanel (168), ExpandedDetailPanel (311). All three are well below P1 threshold and trending downward as deduplication work continues.

5. **Zero console.log in production code** — grep across all source files confirms clean.

---

## Score calculation

```
Start:                                        10.0
P0 findings (× 1.0):                          0.0   (0 P0 findings)
P1 findings (× 0.5):                          0.0   (0 P1 findings)
P2 findings (× 0.2):                         -0.2   (1 P2: CODEBASE.md 3 stale line counts)
P3 findings (× 0.1):                         -0.3   (3 P3: dismissIterating style, PromptSections regex, getModeTagStyle test)
Architecture drift violations (× 0.5):        0.0   (no drift violations)
──────────────────────────────────────────
Score:                                         9.5 / 10 — Grade A
```

**Previous score: 9.0/10. Improvement: +0.5 points.**

The +0.5 gain comes from resolving 4 P2s (saves 0.8) offset by introducing 1 P2 + 1 new P3 (costs 0.3). Net +0.5.

---

## Summary table

| Severity | Count | Items |
|----------|-------|-------|
| P0 | 0 | — |
| P1 | 0 | — |
| P2 | 1 | CODEBASE.md 3 stale line counts after dedup commits (ExpandedPromptReadyContent 215→179, HistoryDetailPanel 203→168, ExpandedDetailPanel 346→311) |
| P3 | 3 | `dismissIterating` not useCallback (style carryover); `PromptSections` regex diverges from `parseSections`; `getModeTagStyle` missing `design` mode test (carryover) |
