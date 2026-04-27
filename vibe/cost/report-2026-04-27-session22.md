# COST REPORT — Promptly
**Mode: Estimated ±25%**
**Session #22 · 2026-04-27 · claude-sonnet-4-6**

---

## THIS SESSION

| Metric | Value |
|--------|-------|
| Input tokens | ~230,000 |
| Output tokens | ~35,000 |
| Cache reads | 0 |
| Session cost | **$1.22** *(estimated)* |
| Tasks completed | 12 |
| Cost per task | $0.10 average |

**Most expensive tasks this session:**
1. `review-expandedview` · vibe-review subagent · L · $0.24
2. `history-parity` · ExpandedHistoryList full parity (search, tabs, filters, stats, badges) · L · $0.22
3. `RFX-EXP-003` · ExpandedDetailPanel.jsx extraction (496 lines) · L · $0.13
4. `context-overhead` · CLAUDE.md + CODEBASE.md load · – · $0.09

---

## PROJECT TOTALS

| Metric | Value |
|--------|-------|
| Total sessions | 22 |
| Total cost | **$14.79** *(all estimated)* |
| Build progress | 100% — all formal tasks complete |
| Tasks remaining | 0 (smoke test pending) |

**By phase:**

| Phase | Sessions | Cost | Status |
|-------|----------|------|--------|
| Planning | 1 | $0.61 | complete |
| Phase 1 — Foundation | 1 | $1.30 | complete |
| Phase 2 — Core features | 8 | $4.01 | complete |
| Phase 3 — Polish | 1 | $0.38 | complete |
| Phase 4 — v2 Features | 11 | $8.49 | complete |

**By feature area:**

| Feature | Cost |
|---------|------|
| App foundation + core states | $3.61 |
| Infrastructure (paths, uninstaller, menu bar) | $2.22 |
| Expanded view (layout, polish, refactor) | $1.48 |
| Recording features (pause, iteration, text input) | $1.87 |
| Polish mode + additional modes | $0.93 |
| History panel + search (v1 + v2) | $1.00 |
| React migration + keyboard shortcuts | $0.93 |
| Design system + bug fixes | $1.77 |
| Planning + architecture | $0.61 |

---

## TREND (last 5 sessions)

```
▂▆▅██▇
```

| Session | Cost | |
|---------|------|-|
| #018 (2026-04-23) | $0.87 | |
| #019 (2026-04-24) | $0.87 | |
| #020 (2026-04-24) | $1.35 | ← peak: 26 tasks, most sessions ever |
| #021 (2026-04-26) | $0.26 | ← light maintenance day |
| **#022 (today)** | **$1.22** | ↑ +47% vs 5-session avg ($0.83) |

**Note:** Cost above average is expected — today included a vibe-review subagent pass (CP-04) and a heavy refactor of 1131-line ExpandedView.jsx into four files. Per-task efficiency ($0.10/task) is within normal range.

---

## RECOMMENDATIONS (3 found)

### 💡 [CP-05] Zero cache hits across all 22 sessions — highest-impact fix available
CLAUDE.md is modified every session (new Active Feature blocks added), which resets the cache TTL and prevents Anthropic's prompt caching from activating. Split CLAUDE.md into a stable portion (architecture rules, code style, tech stack — changes once a month) and a dynamic portion (active features, current tasks). Cache the stable part. At 30KB CODEBASE.md + large CLAUDE.md loading every turn, caching the stable half could save 20–30% on input costs per session.
**Est. saving: ~$0.25/session** | Severity: **warn**

### 💡 [CP-01] CLAUDE.md has 18+ Active Feature blocks — many for completed features
CODEBASE.md is 30,584 bytes. CLAUDE.md adds another large chunk of context with Active Feature sections for features that shipped 2–10 sessions ago (F-SPEECH, F-CLAUDE, F-ACTIONS, etc.). These blocks add tokens every session without value — the decisions are already in DECISIONS.md. Trim completed Active Feature sections from CLAUDE.md; leave only features active within the last 2 sessions.
**Est. saving: ~$0.10/session** | Severity: **ok**

### 💡 [CP-04] Each vibe-review subagent = a full fresh context window
This session's review-expandedview task cost $0.24 — the most expensive single task — because the subagent got its own full context. This is expected and the review value justifies it. Just note: using vibe-review on a session with many recent large files will always spike cost. No change recommended; worth knowing.
**Est. saving: n/a — reviews are worth it** | Severity: **ok**

---

## PROJECT COST FORECAST

- Build: **100% complete** — no planned tasks remaining
- Spent to date: **$14.79**
- Maintenance/future features: $0.25–$0.80 per bug-fix session; $0.80–$1.35 per feature session (based on Phase 4 average)
- Fixing CP-05 (prompt caching) before any new work begins: est. saves $0.20–0.30/session

⚠️ These are estimates (±25%). For precise tracking, run `/cost` in Claude Code at session end, then paste with: `cost: [paste here]`

---

*Full history: vibe/cost/history.json (22 sessions)*
*Ledger data: vibe/cost/summary.json*
