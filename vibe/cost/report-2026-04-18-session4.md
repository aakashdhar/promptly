# Cost Report — Promptly
**Mode: Estimated ±25%**
**Session #4 · 2026-04-18 · claude-sonnet-4-6**

---

## THIS SESSION

| Metric | Value |
|--------|-------|
| Input tokens | 117,000 (cache: 0) |
| Output tokens | 10,800 |
| Session cost | $0.513 estimated |
| Tasks completed | 5 |
| Cost per task | $0.103 average |

**Task breakdown:**

| Task | Description | Size | Est. cost |
|------|-------------|------|-----------|
| FST-001 | JS foundation — module vars, localStorage wrappers, setState() | M | $0.128 |
| FST-003 | CSS — all 6 states styled, design tokens, animations | M | $0.128 |
| FST-005 | Boot + IPC wire-up — shortcut listeners, DOMContentLoaded | M | $0.128 |
| FST-002 | DOM structure — 6 state panels with correct IDs (subagent) | S | $0.064 |
| FST-004 | Window resize IPC — main.js + preload.js (subagent) | S | $0.064 |
| Context overhead | CODEBASE.md 5.7KB, CLAUDE.md, ARCHITECTURE.md | — | $0.045 |

---

## PROJECT TOTALS

| Metric | Value |
|--------|-------|
| Total sessions | 4 |
| Total cost | $2.889 estimated |
| Build progress | ~35% (14/~40 tasks) |

**By phase:**
```
Phase 1 — Foundation:      $1.906  (2 sessions)  ✅ complete
Phase 2 — Core features:   $0.983  (2 sessions)  🔄 active (1/5 features done)
Phase 3 — Polish:          $0.000  (0 sessions)  ⬜ not started
```

**By feature area:**
```
Architecture & Planning:         $0.606   ← project spec + arch
Electron shell (Phase 1):        $1.300   ← most expensive area
State machine & UI skeleton:     $0.983   ← F-STATE spec + build
```

---

## TREND (all 4 sessions)

```
▂▇▂▂
Session 1 (planning):         $0.606
Session 2 (Phase 1 build):    $1.300  ← peak
Session 3 (F-STATE spec):     $0.470
Session 4 (F-STATE build):    $0.513  → +9% vs last session (stable)
```

✅ Costs are healthy — last two sessions averaging $0.49, well below the $1.30 Phase 1 peak.

---

## RECOMMENDATIONS (2 found)

**⚠️ [CP-05] CLAUDE.md active feature block breaks prompt cache**
CLAUDE.md embeds an `Active Feature:` block that is rewritten at the start of each new feature. This changes the CLAUDE.md hash, resetting the prompt cache on every feature transition. Moving the active feature context to a separate file (e.g. `vibe/.active-feature.md`) would keep CLAUDE.md stable and enable caching across a full feature build phase.
Est. saving: ~$0.10–0.20/session

**ℹ️ [CP-04] Wave 3 could have run parallel with Wave 2**
FST-003 (CSS) and FST-005 (boot wiring) have no shared file writes — they could have been in the same wave, reducing the build from 3 waves to 2. Check dependency graph before sequencing future feature waves.
Est. saving: ~$0.03–0.05/feature build session

---

## PROJECT COST FORECAST

- Completed: ~35% of planned tasks
- Spent: $2.89
- Remaining features: F-FIRST-RUN, F-SPEECH, F-CLAUDE, F-ACTIONS (~4 × $1.00 spec+build = $4.00)
- Phase 3 polish + reviews: ~$0.60
- **Est. remaining: ~$4.60**
- **Est. project total: ~$7.50** (range: $6.50–$8.50)

Fixing CLAUDE.md caching before F-SPEECH could trim $0.40–0.80 off the remaining estimate.

---

⚠️ These are estimates (±25%). For precise tracking, run `/cost` in Claude Code at session end, then paste with: `cost: [paste here]`

*Full history: vibe/cost/history.json (4 sessions)*
