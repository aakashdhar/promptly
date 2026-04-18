# Cost Report — Promptly
**Mode: Estimated ±25% | Session #8 · 2026-04-18 · claude-sonnet-4-6**

---

## THIS SESSION

| | |
|---|---|
| Input tokens | ~80,000 |
| Output tokens | ~12,000 |
| Cache reads | 0 |
| Session cost | **$0.42** *(estimated)* |
| Tasks completed | 5 |
| Cost per task | ~$0.084 avg |

**Task breakdown:**

| Task | Description | Size | Cost |
|------|-------------|------|------|
| DECISION-004 | Remove pillWin, move RECORDING to main win | M | ~$0.225 |
| BUG-004 | Vibrancy, traffic light halos, mode pill | S | ~$0.098 |
| vibe-cost | This cost report | S | ~$0.097 |

---

## PROJECT TOTALS

| | |
|---|---|
| Total sessions | 8 |
| Total cost | **$4.47** *(all estimated)* |
| Total input tokens | ~865,000 |
| Total output tokens | ~128,400 |

**By phase:**

| Phase | Cost | Sessions | Status |
|-------|------|----------|--------|
| Planning | $0.61 | 1 | ✅ complete |
| Phase 1 — Foundation | $1.30 | 1 | ✅ complete |
| Phase 2 — Core Features | $2.56 | 6 | ⚠️ gate pending |
| Phase 3 — Polish & Hardening | $0.00 | 0 | ⬜ not started |

**By feature area:**

| Feature | Cost |
|---------|------|
| Planning & architecture | $0.61 |
| Electron shell (Phase 1) | $1.30 ← most expensive |
| State machine & UI skeleton | $0.98 |
| First-run setup flow | $0.64 |
| Dark glass design + bug fixes | $0.94 |

---

## TREND (last 5 sessions)

```
Session 4 (F-STATE build):     $0.51  ▅
Session 5 (F-FIRST-RUN plan):  $0.44  ▃
Session 6 (F-FIRST-RUN build): $0.20  ▂
Session 7 (design+bug fixes):  $0.52  ▅
Session 8 (this session):      $0.42  ▃  → stable (-19% vs prev)
```

5-session average: **$0.42** — this session is exactly at average. No spike.

---

## RECOMMENDATIONS (2 found)

**💡 [CP-05] No prompt caching — every session pays full input price**
All 8 sessions show 0 cache read tokens. CLAUDE.md is read every turn and changes frequently (active feature specs appended), preventing caching. With Phase 2 complete, the F-SPEECH, F-CLAUDE, and F-ACTIONS spec blocks embedded in CLAUDE.md are stale and should be trimmed before Phase 3. This would let the stable sections cache at 90% lower cost.
→ *Est. saving: ~$0.06–0.10/session*

**💡 [CP-01] CLAUDE.md context bloat from completed feature specs**
CLAUDE.md now embeds full spec blocks for three completed features (~3,000–4,000 tokens of dead context per turn). Removing these to their respective feature folders is the single highest-leverage cleanup before Phase 3 begins.
→ *Est. saving: ~$0.05–0.08/session*

---

## PROJECT COST FORECAST

```
Completed:        91% of planned tasks (40/44)
Spent to date:    $4.47
Remaining tasks:  4 (Phase 3 polish)
Est. remaining:   $0.25–0.40
Est. total:       $4.70–4.90
```

Phase 3 tasks are review/test/build-verification — minimal file writes. Expect $0.25–$0.40 to close out. Total project will land well under $5.

---

⚠️ *All figures are estimates (±25%). For precise tracking, run `/cost` in Claude Code at session end and paste with: `cost: [paste here]`*

Full history: `vibe/cost/history.json` (8 sessions)
