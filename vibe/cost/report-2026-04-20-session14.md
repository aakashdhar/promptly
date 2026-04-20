# Cost Report — Promptly
**Mode: Estimated ±25% | Session #14 · 2026-04-20 · claude-sonnet-4-6**

---

## THIS SESSION

| | |
|---|---|
| Input tokens | ~147,000 |
| Output tokens | ~15,500 |
| Session cost | **$0.674** (estimated ±25%) |
| Tasks completed | 4 |
| Cost per task | ~$0.168 average |

**Task breakdown:**

| Task | Size | Est. cost |
|------|------|-----------|
| vibe-add-feature (FEATURE-011 planning) | L | $0.225 |
| PAUZ-001 — App.jsx + preload.js core logic | M | $0.120 |
| PAUZ-002 — RecordingState + PausedState + CSS | M | $0.104 |
| PAUZ-003 — wiring + CODEBASE.md | S | $0.082 |
| context-overhead (CODEBASE.md 19KB + TASKS.md 16KB) | — | $0.045 |
| vibe-cost (this report) | S | $0.098 |

---

## PROJECT TOTALS

| | |
|---|---|
| Total sessions | 14 |
| Total cost | **$7.894** (all estimated) |

**By phase:**

| Phase | Cost | Sessions | Status |
|-------|------|----------|--------|
| Planning | $0.606 | 1 | ✅ complete |
| Phase 1 — Foundation | $1.300 | 1 | ✅ complete |
| Phase 2 — Core features | $4.014 | 8 | ✅ complete |
| Phase 3 — Polish & ship | $0.375 | 1 | ✅ complete |
| Phase 4 — v2 Features | $2.273 | 4 | 🔄 active |

**By feature area:**

| Feature | Cost |
|---------|------|
| Project setup & architecture | $1.906 |
| Core recording flow (state machine, speech, Claude, actions) | $2.074 |
| Bug fixes & polish (Phase 2/3) | $1.565 |
| Phase 3 final review & ship | $0.375 |
| React migration (FEATURE-004) | $0.400 |
| v2 features (history, tray, shortcuts, export, refine) | $0.900 |
| **Pause/resume recording (FEATURE-011)** | **$0.674** ← this session |

---

## TREND (last 5 sessions)

```
Session 10 (Ph2 review + Ph3 polish):  $0.770  ████████
Session 11 (Final review + ship):       $0.375  ████
Session 12 (v2 features + cleanup):     $0.760  ████████
Session 13 (startup + vibe-cost):       $0.165  ██
Session 14 (FEATURE-011 pause/resume):  $0.674  ███████
```

5-session average: **$0.549** | This session: **$0.674** | **↑ +23%**

✅ Within normal range — spike is attributable to the L-sized vibe-add-feature planning task ($0.225). Without it, session cost would be ~$0.45 (↓ below average).

---

## RECOMMENDATIONS (2 found)

**💡 [CP-05] CLAUDE.md caching still disabled — 14 sessions, 0 cache reads**
CLAUDE.md grows with each feature's active feature section, preventing the prompt cache from activating. This has been flagged since session 3.
Fix: Split into a stable `CLAUDE.md` (architecture rules, naming, never list) and a volatile `CLAUDE_ACTIVE.md` or feature-specific section that is not included as a system prompt. Cache the stable core.
*Est. saving: ~$0.15–0.20/session*

**💡 [CP-06] vibe-add-feature consumed 33% of session cost for a 3-task feature**
PAUZ-001 through PAUZ-003 had a complete inline spec in the user's message. The skill still read all startup files, drafted FEATURE_SPEC.md, FEATURE_PLAN.md, FEATURE_TASKS.md, and ran spec-review — $0.225 for a 3-S/M-task feature.
Fix: For features already fully spec'd inline by the user (with exact JSX, exact logic, smoke checklist), skip directly to implementation and create only FEATURE_TASKS.md. Reserve the full skill for exploratory features.
*Est. saving: ~$0.10–0.15 on small features*

---

## FORECAST

Build progress: **~98%** complete
Spent: **$7.894**
Remaining: smoke tests + distribution prep (2–3 S-sized tasks)
Est. to finish: **$0.10–0.25**
**Est. total project cost: ~$8.00–8.15**

> ⚠️ These are estimates (±25%). For precise tracking, run `/cost` in Claude Code and paste with: `cost: [paste]`

---

*Full history: vibe/cost/history.json (14 sessions)*
*Ledger: vibe/cost/ledger/*
