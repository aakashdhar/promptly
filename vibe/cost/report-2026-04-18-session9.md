# Cost Report — Promptly
**Session #9 · 2026-04-18 · claude-sonnet-4-6**
Mode: Estimated ±25%

---

## THIS SESSION

| | |
|---|---|
| Input tokens | ~145,000 |
| Output tokens | ~22,200 |
| Session cost | **$0.68** (estimated) |
| Work items | 6 |
| Cost per item | ~$0.11 avg |

**Task breakdown:**

| Task | Size | Est. cost |
|------|------|-----------|
| FEATURE-001 · Splash screen (main.js rewrite + splash.html) | L | $0.25 |
| BUG-007-A · YOU SAID scrollable + dynamic window resize | M | $0.12 |
| BUG-006 follow-up · Vibrancy transparent .bar + fullscreen-ui | M | $0.10 |
| Diagnostic · Morph canvas investigation (5 questions) | S | $0.09 |
| BUG-007-B · Morph time multipliers + zigzag removal | S | $0.08 |
| YOU SAID opacity · 0.26→0.55 CSS fix | S | $0.02 |
| vibe-cost | S | $0.12 |

---

## PROJECT TOTALS

| | |
|---|---|
| Total sessions | 9 |
| **Total cost** | **$5.15** (all estimated) |
| Build progress | 87% (41/47 tasks complete) |
| Tasks remaining | 6 (Phase 3 + 2 gates) |

**By phase:**

| Phase | Cost | Sessions | Status |
|-------|------|----------|--------|
| Phase 1 — Foundation | $1.91 | 2 | ✅ complete |
| Phase 2 — Core features | $3.24 | 7 | 🔄 active |
| Phase 3 — Polish | $0.00 | 0 | ⬜ not started |

**By area:**

| Area | Cost |
|------|------|
| Bug fixes and visual polish | $1.23 ← most expensive area |
| Planning and architecture | $1.08 |
| Core UI and state machine | $0.98 |
| Dev tooling (cost tracking) | $0.45 |
| Speech recording + Claude integration | $0.71 |
| Splash screen and launch flow | $0.25 |

---

## TREND (last 5 sessions)

```
Session 5:  $0.44  ▄
Session 6:  $0.20  ▂
Session 7:  $0.52  ▅
Session 8:  $0.42  ▄
Session 9:  $0.68  █  ↑ +62% vs previous
```

↑ Session 9 is above recent average ($0.43 over sessions 5–8). Splash screen FEATURE-001 is the cause — an L task requiring a full main.js rewrite and a new file. Expected one-off spike.

---

## RECOMMENDATIONS (2 found)

**💡 CP-05 · Zero cache hits across all 9 sessions**
Every session shows cache_read_tokens: 0. CLAUDE.md now contains 3 active feature sections plus bug context and is likely changing too frequently for caching to activate. Splitting into a stable core and a dynamic active-work section would enable 10× cheaper cache reads on the stable portion.
_Est. saving: ~$0.15–0.25/session_

**💡 CP-02 · index.html read 5+ times this session**
index.html was read for BUG-006, BUG-007-A, BUG-007-B, the diagnostic session, and the opacity fix — ~5,000 tokens per read × 5 reads = 25,000 tokens of repeated context. Batching related fixes into the same turn reduces this.
_Est. saving: ~$0.05–0.10/session on bug-heavy sessions_

---

## FORECAST

Phase 3 has 4 tasks remaining (error audit, smoke test, build verification, distribution prep) plus the two gate reviews. At ~$0.11/task average, expect **$0.50–0.70** to finish. Total project forecast: **$5.65–5.85**.

---

_⚠️ All figures estimated ±25%. Run `/cost` in Claude Code and paste output for precise tracking._
