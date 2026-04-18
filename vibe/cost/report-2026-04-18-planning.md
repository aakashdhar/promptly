# Cost Report — Promptly
> Session #1 · 2026-04-18 · claude-sonnet-4-6 · Mode: Estimated ±25%

## This session

| | |
|--|--|
| Input tokens | ~102,000 |
| Output tokens | ~20,000 |
| Cache reads | 0 (first session — no cache warm yet) |
| **Session cost** | **~$0.61 (estimated)** |
| Tasks completed | 3 (architect:, new-app:, spec-review:) |
| Cost per task | ~$0.20 average |

**Task breakdown:**

| Task | Size | Cost est. |
|------|------|----------|
| new-app: (8 docs generated) | L | ~$0.30 |
| spec-review: (full read + 4 fixes) | M | ~$0.195 |
| architect: (ARCHITECTURE.md) | M | ~$0.096 |

## Project totals

| | |
|--|--|
| Total sessions | 1 |
| Total cost | ~$0.61 (estimated) |
| Progress | 0% (planning complete, build not started) |
| Tasks remaining | 18 (v1) |

## By phase

| Phase | Cost | Status |
|-------|------|--------|
| Planning | $0.61 | ✅ complete |
| Phase 1 — Foundation | $0.00 | not started |
| Phase 2 — Core features | $0.00 | not started |
| Phase 3 — Polish | $0.00 | not started |

## Trend

Not enough sessions for trend analysis yet. (Need 3+ sessions.)

## Recommendations (1 found)

**CP-05 — Prompt caching not yet active**
CLAUDE.md and vibe/ARCHITECTURE.md are read at the start of every build session. Once these files stabilise after Phase 1 is complete, Anthropic prompt caching activates automatically — re-reads cost 90% less. Avoid editing CLAUDE.md between tasks; every change resets the 5-minute cache TTL.
Est. saving: ~$0.05–0.15/session once Phase 1 stabilises.

## Project cost forecast

- Phase 1 (9 foundation tasks, 1–2 sessions): est. **$0.20–0.40**
- Phase 2 (5 features, varied sizes, 3–5 sessions): est. **$0.60–1.20**
- Phase 3 (4 polish tasks, 1–2 sessions): est. **$0.20–0.40**
- **Total project estimate: $1.60–2.60** (planning already spent $0.61)

> ⚠️ These are estimates (±25%). For precise tracking: run `/cost` in Claude Code at session end, then paste with `cost: [paste here]`.
