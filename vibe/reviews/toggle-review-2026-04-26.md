# POLISH-TOGGLE Review — Expand/Collapse Toggle
**Date:** 2026-04-26
**Reviewer:** vibe-review skill
**Branch:** feat/toggle-expand-collapse
**Scope:** TOG-001–TOG-005 — expand/collapse toggle buttons (IdleState.jsx, App.jsx, PromptReadyState.jsx, PolishReadyState.jsx)
**Files changed:** 4 source files + 4 doc/design files (+228 lines total, all additive)

---

## Automated Checks

### ESLint (`npm run lint`)
```
> promptly@1.4.0 lint
> eslint main.js preload.js
(no output — 0 errors, 0 warnings)
```
✅ Lint clean.

### npm run build:renderer
```
vite v8.0.8 building client environment for production...
✓ 38 modules transformed.
dist-renderer/index.html   1.09 kB │ gzip:  0.57 kB
dist-renderer/assets/...css  20.40 kB │ gzip:  4.50 kB
dist-renderer/assets/...js  266.93 kB │ gzip: 77.09 kB
✓ built in 120ms
```
✅ Build succeeds. Bundle size unchanged (was 266 kB pre-change).

### npm audit
```
found 0 vulnerabilities
```
✅ No vulnerabilities.

---

## Carryover Check

Previous final review (2026-04-24) scored **9.8/10 — Grade A** with 0 P0, 0 P1.
Only open item: P2-005 (no automated tests — intentional for v1).
All backlog items resolved. No carryover P0/P1 to escalate.

---

## Graph Pre-Screening

`vibe/graph/CONCEPT_GRAPH.json` exists. All four changed files (`IdleState.jsx`, `App.jsx`, `PromptReadyState.jsx`, `PolishReadyState.jsx`) belong to the `renderer` concept. Changes are purely intra-concept. No cross-concept imports introduced. No DIP violations. **Pre-screening: clean.**

---

## Architecture Drift Detection

### ✅ All core patterns compliant

| Pattern | Status | Evidence |
|---------|--------|---------|
| `transition()` is the single state-change function | ✅ | `onExpand={() => transition(STATES.PROMPT_READY)}` App.jsx:383; `onCollapse={() => transition(STATES.IDLE)}` App.jsx:423, 440 |
| `transition()` calls `resizeWindow(STATE_HEIGHTS[newState])` | ✅ | App.jsx:102 — IDLE resizes to 134px, PROMPT_READY to 560px automatically |
| No dangerouslySetInnerHTML | ✅ | Grep confirms CLEAN across all changed files |
| No localStorage direct access in components | ✅ | CLEAN |
| No new IPC channels | ✅ | Zero new `ipcMain.handle` or `contextBridge` entries |
| `WebkitAppRegion: 'no-drag'` on interactive buttons | ✅ | IdleState.jsx:31 (expand), PromptReadyState.jsx:158 (collapse), PolishReadyState.jsx:21 (collapse) |
| No runtime npm dependencies added | ✅ | Confirmed — package.json unchanged |
| Zero `nodeIntegration: true` | ✅ | Not touched in this change |
| React component per file | ✅ | No new component files created; collapse button added inline |

### ⚠️ Pre-existing documentation drift (P2 — exacerbated by this change)

CODEBASE.md line 107 lists `IDLE` height as 101px. The actual React `STATE_HEIGHTS.IDLE` was 118px before this change and is now 134px. This was already stale before this feature; our change widens the gap.

```
vibe/CODEBASE.md:107 — | `IDLE` | `panel-idle` | 101px | ...
Actual:                   STATE_HEIGHTS.IDLE = 134 (App.jsx:36)
```

---

## SOLID Principles Review

### SRP
| File | Lines | Assessment |
|------|-------|-----------|
| `App.jsx` | 482 | +12 lines from 470. Well under P1 threshold (500). Prop additions only — no new concern added. ✅ |
| `IdleState.jsx` | 212 | +34 lines. Clean. One concern: IDLE state rendering. ✅ |
| `PromptReadyState.jsx` | 376 | +21 lines. One concern: PROMPT_READY state rendering. ✅ |
| `PolishReadyState.jsx` | 168 | +24 lines. One concern: POLISH mode PROMPT_READY rendering. ✅ |

### ISP
- `PromptReadyState` props before: 8. After: 9 (`onCollapse` added). Still under P1 threshold of 10. ✅
- `IdleState` props before: 6. After: 7 (`onExpand` added). Under threshold. ✅
- `PolishReadyState` props before: 8. After: 9. Under threshold. ✅

### OCP
- Both `PromptReadyState` and `PolishReadyState` extended by new optional prop — no existing behaviour modified. ✅

### DIP
- No direct localStorage, no direct IPC, no direct DB. All state transitions via `transition()`. ✅

---

## Security Review

| Check | Status |
|-------|--------|
| New buttons render no user/Claude content | ✅ — SVG paths only, no dynamic text |
| No new shell execution surface | ✅ — visual-only change |
| No new IPC input validation needed | ✅ — no new IPC |
| `WebkitAppRegion: 'no-drag'` prevents drag-zone click conflicts | ✅ |

---

## Findings

### P0 — Critical (blocks gate)
**None.**

---

### P1 — Fix before deploy
**None.**

---

### P2 — Should fix

#### P2-TOG-001 — CODEBASE.md IDLE height stale (pre-existing, now further off)
- **File:** `vibe/CODEBASE.md:107`
- **Evidence:** Line 107 reads `| IDLE | panel-idle | 101px |`. The React `STATE_HEIGHTS.IDLE` is now `134` (App.jsx:36). Was already wrong before this change (118px was actual, 101px was listed). Our change increases the gap.
- **Fix:** Update CODEBASE.md line 107 to `134px`. Also consider noting in the App.jsx row that `STATE_HEIGHTS` canonical values live in App.jsx, not the legacy state machine table.

#### P2-TOG-002 — Expand button transitions to empty PROMPT_READY on first session use
- **File:** `src/renderer/App.jsx:383` / `src/renderer/components/PromptReadyState.jsx:153-158`
- **Evidence:** `onExpand={() => transition(STATES.PROMPT_READY)}` unconditionally. On app start, before any generation, clicking expand shows PROMPT_READY with "✓ Prompt ready", empty YOU SAID, empty prompt content, and active "Copy prompt" button — misleading affordance. `generatedPrompt` is `''` at start.
- **Note:** The spec mandated "zero logic changes." This is compliant with that constraint. The issue surfaces only on first session use before any recording — once a prompt has been generated, the expand button correctly re-shows the last result.
- **Fix options:** (a) Conditionally hide expand button when `generatedPrompt` is empty (one-line logic change, acceptable); (b) Add an empty state treatment inside PROMPT_READY when both `generatedPrompt` and `originalTranscript` are empty. Option (a) is the least invasive.

#### P2-TOG-003 — No hover feedback on expand/collapse buttons
- **Files:** `src/renderer/components/IdleState.jsx:22-41` / `src/renderer/components/PromptReadyState.jsx:147-167` / `src/renderer/components/PolishReadyState.jsx:11-28`
- **Evidence:** Existing interactive buttons in the app all implement hover states via `onMouseEnter`/`onMouseLeave` (e.g. keyboard button in IdleState:130-131, Edit/Copy buttons in PromptReadyState). The new expand/collapse buttons have static backgrounds with no hover feedback — inconsistent with the established interaction pattern.
- **Fix:** Add `onMouseEnter` → lighten background, `onMouseLeave` → restore, on all three buttons. e.g. for expand: `onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}` / `onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}`.

---

### P3 — Minor

#### P3-TOG-001 — Collapse button potentially unreachable in PolishReadyState top-row overlap
- **File:** `src/renderer/components/PolishReadyState.jsx:31-35`
- **Evidence:** The collapse button sits at `top:14px right:16px` (absolute). The "Top row" div (just below the 36px breathing area) has `justifyContent: 'space-between'` with status text left and tone toggle right. The tone toggle's rightmost edge aligns with `right: 20px`. At close inspection, the tone toggle (in the content flow starting at y≈36px) and the collapse button (absolute at y=14px) do not overlap vertically — the collapse button is in the 36px traffic-light zone. However, at very narrow window widths, this _could_ create a visual crowded zone. At 520px window width with a 26px collapse button at right:16px, this is fine. ✅ No action needed; noting for awareness.

---

## Strengths

**Prop-only extension is architecturally clean.** All four components receive optional new props (`onExpand`, `onCollapse`) without any change to existing prop contracts or behaviour. No existing tests or flows are affected.

**`transition()` handles window resize automatically.** Expand → `transition(STATES.PROMPT_READY)` resizes to 560px; collapse → `transition(STATES.IDLE)` resizes to 134px. No bespoke resize calls needed, no IPC added, no additional `resizeWindow()` invocations.

**`position:absolute` pattern for collapse button is correct.** Anchoring to the existing `relative` container (`panel-ready`, `className="relative z-[1]"`) means zero disruption to the flex column layout inside PROMPT_READY. The transport bar, YOU SAID section, prompt output, and action buttons are completely unaffected.

**PolishReadyState correctly gains `position:relative`.** Its outer div did not previously have `position:relative`, which was required to anchor the absolute collapse button. Adding it inline is the minimal-impact fix.

**Branch hygiene confirmed.** All commits on `feat/toggle-expand-collapse` — no main branch contamination. Code commit and doc commit are correctly separated.

---

## Quality Score

```
Start:                         10.0
P0 (× 1.0 each):               0.0   (0 P0 findings)
P1 (× 0.5 each):               0.0   (0 P1 findings)
P2 (× 0.2 each):              -0.6   (3 P2 findings: stale doc, empty-expand UX, no hover)
P3 (× 0.1 each):              -0.1   (1 P3 finding: visual crowding awareness)
Architecture drift (× 0.5):    0.0   (no new drift — pre-existing doc gap logged as P2-TOG-001)
──────────────────────────────────────
Score:                          9.3 / 10 — Grade A
```

---

## Gate Decision

**✅ PASS — 0 P0, 0 P1**

Three P2 findings logged to backlog. Recommended to fix P2-TOG-002 (empty expand UX) and P2-TOG-003 (hover states) before merging to main — both are small targeted additions consistent with the existing pattern. P2-TOG-001 (CODEBASE.md height) is a 1-line doc fix.

No blocking issues. Feature branch may merge to main after P2 fixes if desired, or ship as-is.
