# Cost Report — Promptly
> Session #10 · 2026-04-18 · claude-sonnet-4-6
> Mode: Estimated ±25%

## This session

| Metric | Value |
|--------|-------|
| Input tokens | ~180,000 |
| Output tokens | ~15,500 |
| Session cost | **$0.77 est** |
| Tasks completed | 4 |
| Cost per task | ~$0.19 avg |

**Task breakdown:**
1. phase-2-review · L · $0.31 — read 8+ source files, backlog, all prior reviews; wrote phase-2-review.md + updated backlog
2. fix-all-BL013-023 · M · $0.25 — 6 code fixes + 4 doc rewrites (CODEBASE.md, ARCHITECTURE.md, SPEC.md, DECISIONS.md)
3. BUG-008 · M · $0.14 — PROMPT_TEMPLATE rewrite, session startup reads
4. vibe-cost · S · $0.07 — this report

## Project totals

| | |
|-|-|
| Total sessions | 10 |
| Total cost | **$5.92 est** |

**By phase:**
| Phase | Cost | Sessions | Status |
|-------|------|----------|--------|
| Planning | $0.61 | 1 | complete |
| Phase 1 — Foundation | $1.30 | 1 | complete |
| Phase 2 — Core features | $3.24 | 7 | complete |
| Phase 3 — Polish | $0.77 | 1 | active |

**By feature area:**
| Feature | Cost |
|---------|------|
| Planning & architecture | $0.61 |
| Phase 1 foundation | $1.30 |
| State machine + UI skeleton | $0.98 |
| First-run setup | $0.64 |
| Design system + bug fixes | $0.94 |
| Splash + vibrancy + BUG-007 | $0.68 |
| Phase 2 review + Phase 3 polish | $0.77 |

## Trend (last 5 sessions)

```
S6  $0.20 ▂
S7  $0.52 ▅
S8  $0.42 ▄
S9  $0.68 ▇
S10 $0.77 █  ↑ +13%
```

S10 spike is expected — large review task drove most of the cost ($0.31 alone).

## Patterns detected

**CP-05 (every session) — Zero prompt cache utilisation**
All 10 sessions show 0 cache_read_tokens. Every turn reloads the full context cold.
CLAUDE.md is 8KB+ and changes frequently — ineligible for caching as-is.
Estimated overhead: ~$0.15–0.25/session.

## Recommendations

**[CP-05] Split CLAUDE.md into stable + dynamic sections**
The stable sections (tech stack, code style, architecture rules, never list) don't change.
The dynamic sections (Active Feature, What's next) change every task.
Splitting allows the stable 6KB to be prompt-cached, saving ~$0.15/session.
Est. saving: ~$0.60 over remaining Phase 3 sessions.
Priority: low — project is near completion, saving is small relative to total.

## Forecast

**Remaining Phase 3 work (TASKS.md):**
- Error state audit
- Manual smoke test
- Build verification (npm run dist)
- Distribution prep

~4 tasks, all S–M sized. Estimated $0.30–0.45 to complete Phase 3.

**Projected project total: $6.20–6.40**
