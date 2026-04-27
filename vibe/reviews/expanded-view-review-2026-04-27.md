# Expanded View Complete — Code Review
**Date:** 2026-04-27
**Reviewer:** vibe-review skill
**Branch:** feat/toggle-expand-collapse
**Scope:** BUG-TOGGLE-002 through BUG-TOGGLE-005 + history parity — complete ExpandedView implementation
**Files changed:** ExpandedView.jsx (new, 1131 lines), App.jsx (+wiring), WaveformCanvas.jsx (DPR), MorphCanvas.jsx (DPR)

---

## Automated Checks

### ESLint (`npm run lint`)
```
> promptly@1.4.0 lint
> eslint main.js preload.js
(no output — 0 errors, 0 warnings)
```
✅ Lint clean. (Note: ESLint scans main.js + preload.js only, not src/renderer — reviewed manually below.)

### npm audit
```
found 0 vulnerabilities
```
✅ No vulnerabilities.

---

## Carryover Check

Previous review: `toggle-review-2026-04-26.md` — Score 9.9/10 (A) — 0 P0, 0 P1.
All P2 findings (BL-057, BL-058, BL-059) resolved before that review closed.
One open P3 (BL-060 — visual crowding awareness — monitor only).

| ID | Finding | Status |
|----|---------|--------|
| BL-060 | PolishReadyState collapse/tone toggle visual crowding at narrow widths | Open / monitor — no change, still acceptable at 520px. |

No escalations. No carryover P1 items.

---

## Graph Pre-Screening

`vibe/graph/CONCEPT_GRAPH.json` exists. All changed files belong to the `renderer` concept. No cross-concept imports. **Pre-screening: clean.**

---

## Architecture Drift Detection

### 🔴 ARCHITECTURE DRIFT — Styling: component-defined @keyframes

**Decision:** `"index.css owns all @theme design tokens, @keyframes, and global body reset. Component files must not redefine tokens."` (ARCHITECTURE.md — Frontend patterns / Styling)

**Found:** `src/renderer/components/ExpandedView.jsx` lines 1114–1128 — a `<style>` block injected into JSX output defines four `@keyframes` rules:

```jsx
<style>{`
  @keyframes spin { ... }
  @keyframes breathe { ... }
  @keyframes pulse-ring { ... }
  @keyframes skeleton-pulse { ... }
`}</style>
```

Verification against `src/renderer/index.css` — none of these four names exist in index.css:
- `spin` — absent from index.css
- `breathe` — absent (index.css has `mic-breathe`, different timing)
- `pulse-ring` — absent (index.css has `pulse-expand` and `pulse-inner`, different keyframes)
- `skeleton-pulse` — absent

**Decision origin:** ARCHITECTURE.md (Frontend patterns / Styling) — established 2026-04-18, reiterated after React migration.

**Impact:** Splits the single source of truth for animation tokens across two files. Future changes to animation timing must be applied in both places. Injecting a `<style>` block also creates a new `<style>` element on every component re-render (minor perf). `pulse-ring` in ExpandedView differs from `pulse-expand`/`pulse-inner` in index.css — same visual role, different names and values across the codebase.

**Fix:** Move all four `@keyframes` into `src/renderer/index.css`. Remove the `<style>` block. Reference via `animation: 'spin 1s linear infinite'` as today.

---

### ✅ All other architecture patterns compliant

| Pattern | Status | Evidence |
|---------|--------|---------|
| No `dangerouslySetInnerHTML` | ✅ | Grep confirms clean — all dynamic text via JSX text nodes |
| No direct localStorage access in component | ✅ | All history access via `utils/history.js` imports |
| No new IPC channels | ✅ | Zero new `ipcMain.handle` entries |
| `WebkitAppRegion: 'no-drag'` on all interactive controls | ✅ | All buttons, mode pill, pause button confirmed |
| `transition()` skips resizeWindow when isExpanded | ✅ | App.jsx:106 — `if (!isExpandedRef.current) resizeWindow(...)` |
| `handleCollapse` manual state reset documented | ✅ | ARCHITECTURE.md + DECISIONS.md D-BUG-TOGGLE-002; same pattern as `closeHistory` bypass — intentional, window-width change cannot go through `transition()` |
| Zero runtime npm dependencies | ✅ | package.json unchanged |
| WaveformCanvas / MorphCanvas DPR scaling | ✅ | `canvas.width = offsetWidth * dpr; ctx.scale(dpr, dpr)` — BUG-TOGGLE-004 fix correct |

---

## SOLID Principles Review

### SRP — P0 CRITICAL

#### 🔴 P0-EXP-001 — ExpandedView.jsx 1131 lines — four distinct concerns in one file

**File:** `src/renderer/components/ExpandedView.jsx` — 1131 lines (threshold: >1000 = P0 CRITICAL)

ExpandedView.jsx handles four distinct, independently changeable concerns:

| Concern | Lines (approx) | Should be |
|---------|---------------|-----------|
| Top transport bar (mic/stop/pause/waveform/mode pill/settings) | ~190 (lines 306–493) | `ExpandedTransportBar.jsx` |
| Left panel — history list (search, tabs, filters, stats, entry rows, footer, clear all) | ~290 (lines 498–789) | `ExpandedHistoryList.jsx` |
| Right panel — history entry detail (bookmark, rate, tag chips, copy, reuse) | ~135 (lines 795–931) | Inline or small sub-component |
| Right panel — current state content (IDLE placeholder, RECORDING, PAUSED, THINKING, PROMPT_READY edit/two-column/action row) | ~210 (lines 933–1113) | `ExpandedStatePanel.jsx` |

Plus three file-level pure helpers (`parseSections`, `renderPromptSections`, `getModeTagStyle`) and a local `STATES` constant that should be shared (see P2-EXP-001).

This file will continue to grow with every new state added (e.g. polish mode detail in PROMPT_READY, ITERATING handling) — the accumulation pattern is set.

**Fix:** Extract into three components. Suggested split:
```
ExpandedView.jsx           ← thin orchestrator, ~200 lines max
ExpandedTransportBar.jsx   ← top bar only
ExpandedHistoryList.jsx    ← left panel: search, tabs, filters, stats, entries, footer
ExpandedStatePanel.jsx     ← right panel: per-state content + entry detail
```
Shared helpers move to `src/renderer/utils/promptUtils.js`.

### ISP — P1

#### P1-EXP-001 — ExpandedView accepts 23 props (threshold: >10 = P1)

**File:** `src/renderer/components/ExpandedView.jsx` lines 91–115

The props interface has 23 named props:
`currentState`, `mode`, `modeLabel`, `duration`, `generatedPrompt`, `originalTranscript`, `thinkTranscript`, `onStart`, `onCollapse`, `onPause`, `onStop`, `onRegenerate`, `onReset`, `onIterate`, `isIterated`, `setGeneratedPrompt`, `isPolishMode`, `polishResult`, `polishTone`, `onPolishToneChange`, `onPolishCopy`, `polishCopied`, `onReuse`

This is a direct consequence of the file absorbing too many concerns (P0-EXP-001). The fix for P0 naturally resolves this — sub-components receive only the props they need:
- `ExpandedTransportBar`: ~7 props (currentState, duration, mode, modeLabel, onStart, onStop, onPause)
- `ExpandedHistoryList`: ~3 props (onReuse, selectedId state managed internally)
- `ExpandedStatePanel`: ~12 props (currentState, generatedPrompt, …polish props)

### SRP — Pre-existing, worsened

#### P3-EXP-001 — HistoryPanel.jsx at 663 lines — pre-existing, tracking

**File:** `src/renderer/components/HistoryPanel.jsx` — 663 lines (P1 threshold: 500 lines)

Pre-existing before this branch. Now that ExpandedView.jsx contains a near-complete reimplementation of the history list + entry detail logic, the codebase has ~1800 lines of overlapping history UI across two files. Noted for the next refactor cycle.

---

## Code Quality Analysis

### Duplication

#### P2-EXP-001 — STATES constant silently duplicated

**Files:** `src/renderer/components/ExpandedView.jsx:6–12` vs `src/renderer/App.jsx:22–35`

ExpandedView.jsx defines its own local `STATES` with 5 keys (IDLE, RECORDING, PAUSED, THINKING, PROMPT_READY). App.jsx defines STATES with 12 keys. There is no `export` or `import` — they are independent objects that happen to share the same key names. If a new state is added to App.jsx STATES (e.g. a future DICTATING state), ExpandedView's switch-style conditionals silently ignore it.

```js
// ExpandedView.jsx:6
const STATES = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  THINKING: 'THINKING',
  PROMPT_READY: 'PROMPT_READY',   // ← ITERATING, TYPING, SHORTCUTS, HISTORY, SETTINGS missing
}
```

**Fix:** Export `STATES` from a shared `src/renderer/constants.js` and import in both App.jsx and ExpandedView.jsx. (One-time 5-minute change; no behaviour change.)

#### P2-EXP-002 — Prompt-parsing logic duplicated (parseSections vs renderPromptOutput)

**Files:** `src/renderer/components/ExpandedView.jsx:17–83` and `src/renderer/components/PromptReadyState.jsx:6+`

Both files independently implement line-by-line section-label detection (the `/^([A-Za-z][A-Za-z\s]*):\s*$/` regex pattern):
- ExpandedView: `parseSections()` returns section objects, consumed by `renderPromptSections()` for two-column grid
- PromptReadyState: `renderPromptOutput()` parses inline and returns styled JSX

They serve slightly different rendering targets (two-column grid vs. linear list), but share the same parsing logic. If the section-label regex ever needs to change (e.g. to support numbered sections), it must be changed in both files.

**Fix:** Extract parsing logic to `src/renderer/utils/promptUtils.js` — export `parseSections(text)`. ExpandedView and PromptReadyState each call it and apply their own rendering. Keep `renderPromptSections` and `renderPromptOutput` as local render functions; only share the parsing primitive.

---

## Feature Gap Analysis

### P2-EXP-003 — Settings button in transport bar has no onClick handler

**File:** `src/renderer/components/ExpandedView.jsx` lines 457–475

The sliders-icon button rendered in the transport right flank (logged in DECISIONS.md D-BUG-TOGGLE-003 as "settings button added") has no `onClick` prop. It is purely visual — clicking it does nothing. Users who click it will see no feedback.

```jsx
<div style={{ ... cursor: 'pointer', ... }}>
  <svg width="14" height="12" ...>
    {/* sliders icon */}
  </svg>
</div>
// No onClick handler present
```

**Fix:** Either wire `onClick={() => onOpenSettings?.()}` (requires passing `onOpenSettings` prop from App.jsx — already available via `useKeyboardShortcuts`), or remove the button until it's intended to be functional.

### P2-EXP-004 — ITERATING and TYPING states produce blank right panel in expanded mode

**Files:** `src/renderer/components/ExpandedView.jsx:933–1110` (right panel conditionals) + `src/renderer/App.jsx:400–420` (ExpandedView render gate)

ExpandedView is rendered for ALL states when `isExpanded=true` (App.jsx:400). However, the right panel has no conditional for `ITERATING` or `TYPING`. If a user:
1. Clicks "↻ Iterate" from PROMPT_READY in expanded mode → `transition(STATES.ITERATING)` → right panel is blank
2. Triggers ⌘T while expanded → `transition(STATES.TYPING)` → right panel is blank

The transport bar remains, but the right panel shows nothing (no element matches, so React renders null).

```jsx
// Right panel in ExpandedView — no ITERATING case:
{currentState === STATES.RECORDING && <div>Listening...</div>}
{currentState === STATES.PAUSED && <div>Paused</div>}
{currentState === STATES.THINKING && <div>Generating...</div>}
{currentState === STATES.PROMPT_READY && <div>...</div>}
// ITERATING → nothing; TYPING → nothing
```

**Fix (minimal):** Add placeholder cases:
```jsx
{currentState === 'ITERATING' && (
  <div style={{ padding: '24px' }}>
    <div style={{ fontSize: '13px', color: 'rgba(10,132,255,0.75)' }}>Iterating...</div>
    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '6px' }}>Speak your refinement. Stop when done.</div>
  </div>
)}
{currentState === 'TYPING' && (
  <div style={{ padding: '24px', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>Typing mode active — check the compact bar to submit.</div>
)}
```

---

## Security Review

| Check | Status |
|-------|--------|
| No `dangerouslySetInnerHTML` with user/Claude content | ✅ — all prompt text via JSX text nodes; `selected.transcript` + `selected.prompt` rendered as children, never as HTML |
| History entries rendered with textContent-equivalent | ✅ — `{entry.title}`, `{selected.transcript}` are JSX text nodes |
| `window.electronAPI.copyToClipboard()` used for copy (not navigator.clipboard) | ✅ — ExpandedView:206 uses `window.electronAPI.copyToClipboard` |
| No new IPC input validation surface | ✅ — no new IPC channels |
| No localStorage direct access | ✅ — all via `utils/history.js` |
| No hardcoded secrets | ✅ |

---

## Strengths

**DPR-crisp canvas rendering (BUG-TOGGLE-004)** is implemented correctly in both WaveformCanvas.jsx and MorphCanvas.jsx — `canvas.width = offsetWidth * dpr; ctx.scale(dpr, dpr)`. This matches the standard Retina canvas pattern exactly.

**Three-zone layout architecture** (BUG-TOGGLE-002) is the right approach: top transport bar, left history panel, right state content. The separation of zones is clear, and the left panel history logic is functionally complete (search, tabs, filter chips, stats bar, bookmark/rating indicators, clear all) — full parity with HistoryPanel.

**`transition()` guard for expanded mode** (App.jsx:106 `if (!isExpandedRef.current)`) correctly prevents height-resize IPC calls while in expanded mode, where `setWindowSize` is the appropriate call instead.

**History entry state managed locally** — `useState(() => getHistory())` initialized at mount, refreshed via `useEffect` on `currentState` change. This is the correct pattern for a session-level history list: no prop drilling, no global state.

**BUG-REC-001 fix** (`onStart` guard `IDLE || PROMPT_READY`) is a clean one-line fix that correctly allows re-recording from expanded PROMPT_READY without requiring a separate reset step.

---

## Findings Summary

### P0 — Critical (blocks merge to main)

| ID | File | Line | Finding |
|----|------|------|---------|
| P0-EXP-001 | ExpandedView.jsx | 1–1131 | SRP CRITICAL — 1131 lines, 4 distinct concerns. Threshold: >1000 = P0. Must split before merge. |

### P1 — Fix before deploy

| ID | File | Line | Finding |
|----|------|------|---------|
| P1-ARCH-001 | ExpandedView.jsx | 1114–1128 | Architecture drift — `@keyframes` defined in component `<style>` block. `spin`, `breathe`, `pulse-ring`, `skeleton-pulse` not in index.css. ARCHITECTURE.md: "index.css owns all @keyframes." Move to index.css. |
| P1-EXP-001 | ExpandedView.jsx | 91–115 | ISP violation — 23 props (threshold: >10 = P1). Direct consequence of P0-EXP-001; resolves automatically when component is split. |

### P2 — Should fix

| ID | File | Line | Finding |
|----|------|------|---------|
| P2-EXP-001 | ExpandedView.jsx | 6–12 | STATES constant silently duplicated (5 keys vs App.jsx's 12). Export from `src/renderer/constants.js` and import in both. |
| P2-EXP-002 | ExpandedView.jsx | 17–83 | Prompt-parsing logic duplicated vs PromptReadyState.jsx. Extract `parseSections()` to `src/renderer/utils/promptUtils.js`. |
| P2-EXP-003 | ExpandedView.jsx | 457–475 | Settings button (sliders icon) has no onClick — non-functional UI element. Wire to settings handler or remove. |
| P2-EXP-004 | ExpandedView.jsx | 933–1110 | ITERATING and TYPING states produce blank right panel. Add minimal placeholder divs for each. |

### P3 — Minor / tracking

| ID | File | Line | Finding |
|----|------|------|---------|
| P3-EXP-001 | HistoryPanel.jsx | 1–663 | 663 lines — pre-existing above P1 threshold (500 lines). Not introduced by this branch. Schedule refactor when ExpandedView split creates natural opportunity. |
| BL-060 | PolishReadyState.jsx | 31–35 | Carryover — collapse/tone visual crowding at narrow widths. Monitor. |

---

## Quality Score

```
Start:                              10.0
P0 (× 1.0 each):                   -1.0   (1 finding: ExpandedView.jsx 1131 lines)
P1 (× 0.5 each):                   -1.0   (2 findings: @keyframes drift, 23 props)
P2 (× 0.2 each):                   -0.8   (4 findings: STATES dup, parseSections dup, settings no-op, blank panel)
P3 (× 0.1 each):                   -0.2   (2 findings: HistoryPanel 663 lines, BL-060 carryover)
Architecture drift (× 0.5 each):   -0.5   (1 violation: @keyframes)
──────────────────────────────────────────
Score:                               6.5 / 10 — Grade C+
```

---

## Gate Decision

🔴 **BLOCKED — 1 P0 issue**

ExpandedView.jsx at 1131 lines is a P0 CRITICAL SRP violation. The file must be split before this branch merges to main.

**Suggested P0 fix task order:**

1. `RFX-EXP-001` — Extract `ExpandedTransportBar.jsx` from ExpandedView.jsx (lines 306–493)
2. `RFX-EXP-002` — Extract `ExpandedHistoryList.jsx` from ExpandedView.jsx (lines 498–789)
3. `RFX-EXP-003` — Extract `ExpandedStatePanel.jsx` from ExpandedView.jsx (lines 795–1113)
4. `RFX-EXP-004` — Move helpers (`parseSections`, `getModeTagStyle`) to `src/renderer/utils/promptUtils.js`
5. `RFX-EXP-005` — Move 4 `@keyframes` to `src/renderer/index.css` (resolves P1-ARCH-001)

After split: ExpandedView.jsx becomes a thin orchestrator (~150 lines). P0, P1-EXP-001, and P2-EXP-002 all resolve as part of the split.

P2-EXP-001 (STATES export), P2-EXP-003 (settings onClick), P2-EXP-004 (ITERATING/TYPING panels) are small targeted fixes — address after or during the split.

---

## TASKS.md Blocking Entry (to add)

```
🔴 Review fixes required — Expanded View gate (0/5)
   Must complete before branch merges to main.
   [ ] RFX-EXP-001 · Extract ExpandedTransportBar.jsx — lines 306–493 from ExpandedView.jsx
   [ ] RFX-EXP-002 · Extract ExpandedHistoryList.jsx — lines 498–789 from ExpandedView.jsx
   [ ] RFX-EXP-003 · Extract ExpandedStatePanel.jsx — lines 795–1113 from ExpandedView.jsx
   [ ] RFX-EXP-004 · Move parseSections + getModeTagStyle to src/renderer/utils/promptUtils.js
   [ ] RFX-EXP-005 · Move spin/breathe/pulse-ring/skeleton-pulse @keyframes to index.css — remove <style> block
   → Full report: vibe/reviews/expanded-view-review-2026-04-27.md
```
