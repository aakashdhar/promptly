# Review: FEATURE-009 — History Panel (Split View)
> Date: 2026-04-19 | Reviewer: vibe-review skill
> Scope: HIST-001 · HIST-002 · HIST-003 · HIST-004 · HIST-005 + BUG-011 fixes

---

## Automated checks

| Check | Result |
|-------|--------|
| `npm run lint` | ✅ 0 errors |
| `npm run build:renderer` | ✅ built in <200ms |
| `npm audit` | ⚠️ 2 low severity (eslint devDep — BL-024, carryover, no runtime risk) |
| Tests | N/A — manual smoke test confirmed by human 2026-04-19 |

---

## Carryover check

| ID | Finding | Status |
|----|---------|--------|
| BL-024 | 2 low eslint devDep vulns (@eslint/plugin-kit) | ⬜ still open — no runtime risk |
| BL-027 | Hardcoded hex `#30D158`, `#0A84FF`, `#FF3B30` in index.html | ⬜ still open |

No escalations — both have been open <2 review cycles and are low/cosmetic risk.

---

## Architecture drift

ARCHITECTURE.md IPC surface table is stale — four channels added across FEATURE-007, FEATURE-009, and BUG-011 are not documented:

```
🟡 ARCHITECTURE DRIFT — IPC surface table (ARCHITECTURE.md line 111–133)
   Decision: "Complete list" — table claims to be exhaustive
   Found: main.js — 4 registered channels absent from table:
     - save-file          (added FEATURE-007)
     - resize-window-width (added HIST-004)
     - show-history        (added HIST-004)
     - set-window-size     (added BUG-011)
   Impact: Agent reads this table at session start to understand IPC surface.
           Stale table causes future agents to miss channels, add duplicates.
   Fix: Add 4 rows to ARCHITECTURE.md IPC table.
```

Also: ARCHITECTURE.md stack section still says "Vanilla HTML + CSS + JS — single index.html, zero build step" — project migrated to React + Vite in FEATURE-004. This is a known carried drift. Recommend updating the stack table to reflect reality.

---

## Feature correctness against acceptance criteria

### HIST-001 · history.js ✅
- All 6 functions exported ✅
- JSON parse error caught → returns `[]` ✅
- Title generated from first 5 words ✅
- Cap at 100 entries ✅
- No direct localStorage.* outside this module ✅

### HIST-002 · HistoryPanel.jsx ✅
- Split layout: 240px left + flex-1 right ✅ (240px, not spec's 220px — acceptable)
- First entry auto-selected on mount ✅
- Entry rows: title, mode pill, timestamp ✅
- ✕ delete with stopPropagation ✅
- Active entry: blue left border + blue-tinted background ✅
- Inline search with autoFocus ✅
- renderPromptSections: regex updated to `/^[A-Z][A-Z\s\/]+:/` (broader than spec — catches more label formats, no downside) ✅
- No dangerouslySetInnerHTML ✅
- All localStorage via utils/history.js ✅
- Copy: green flash 1.8s ✅
- Right panel scroll: `flex:1, overflowY:'auto', minHeight:0` — fixed in BUG-011 ✅

### HIST-003 · App.jsx wiring ✅
- HISTORY in STATES + STATE_HEIGHTS ✅
- ⌘H opens from any non-RECORDING state ✅
- Escape closes history ✅
- onShowHistory IPC listener ✅
- onReuse: sets originalTranscript.current + generatedPrompt + transitions to PROMPT_READY ✅

### HIST-004 · main.js + preload.js ✅
- resize-window uses `win.getSize()[0]` for width (not hardcoded 520) ✅
- resize-window-width handler registered ✅
- "History ⌘H" in context menu ✅
- resizeWindowWidth + onShowHistory exposed in preload.js ✅
- set-window-size handler registered (BUG-011) ✅

### HIST-005 · CODEBASE.md ✅
- All new files, IPC channels, state rows documented ✅

---

## Findings

### P1

**P1-001 — console.log in production code**
- `src/renderer/App.jsx` line 53: `console.log('window resized to', STATE_HEIGHTS.IDLE)`
- Left over from FEATURE-004. Will appear in distributed .dmg console.
- Fix: remove the line.

**P1-002 — ARCHITECTURE.md IPC table stale**
- `vibe/ARCHITECTURE.md` lines 111–133: 4 channels missing (`save-file`, `resize-window-width`, `show-history`, `set-window-size`)
- Fix: add 4 rows; update stack section to reflect React + Vite migration.

### P2

**P2-001 — closeHistory deviation not documented in DECISIONS.md**
- FEATURE_TASKS.md HIST-003 spec says closeHistory → prevState. User changed this to always → IDLE during BUG-011. The change is correct and user-approved but has no DECISIONS.md entry.
- Fix: append a one-liner to DECISIONS.md under D-BUG-011.

**P2-002 — BrowserWindow minWidth/maxWidth not updated in createWindow**
- `main.js` line 181–182: `minWidth: 520, maxWidth: 520` still present.
- The `set-window-size` handler works around this by calling `setMinimumSize/setMaximumSize` before every resize. Any future resize that doesn't use `set-window-size` will silently clamp to 520px again.
- Fix: either remove minWidth/maxWidth from createWindow, or add a comment documenting the pattern.

### P3

**P3-001 — BL-024 carryover** — eslint devDep vuln, no runtime risk, no action needed before this feature ships.
**P3-002 — BL-027 carryover** — hardcoded hex in index.html (legacy file), cosmetic only.

---

## Strengths

- `history.js` is a clean, minimal utility module — no leakage, proper error boundary on JSON.parse, correct 100-entry cap. Exactly what the spec asked for.
- BUG-011 root cause diagnosis was thorough — identified three distinct failure modes (Tailwind layout, RAF race condition, minWidth/maxWidth constraint) and fixed all three.
- `set-window-size` IPC is the right abstraction — atomic width+height avoids the class of bugs that plagued the separate-call approach.
- HistoryPanel.jsx uses full inline styles — consistent with the project's pattern for panels that need dynamic layout, and immune to Tailwind purge/JIT issues.
- Right panel scroll correctly uses the `flex:1 + overflowY:auto + minHeight:0` pattern on both the container and the scrollable child.

---

## Quality score

| Deduction | Reason |
|-----------|--------|
| -0.5 | P1-001 console.log in App.jsx |
| -0.5 | P1-002 ARCHITECTURE.md IPC table stale |
| -0.2 | P2-001 closeHistory deviation undocumented |
| -0.2 | P2-002 createWindow minWidth/maxWidth not cleaned up |

**Score: 8.6 / 10 — Grade B+**

---

## Gate decision

0 P0 issues.

✅ **PASS — FEATURE-009 gated. Distribution may proceed after P1 fixes.**
