# Cost Report — Promptly
Mode: Estimated ±25% | Session #2 · 2026-04-18 · claude-sonnet-4-6
══════════════════════════════════════════

## This session

```
Input tokens:     ~225,000
Output tokens:    ~41,600
Session cost:     ~$1.30 (estimated ±25%)
Tasks completed:  11 (P1-001 → P1-009 + phase-1-review + parallel orchestration)
Cost per task:    ~$0.118 average

Most expensive tasks this session:
  1. phase-1-review          (M)  ~$0.25  — reads 8 docs + all source files + writes report
  2. P1-009 smoke test       (M)  ~$0.12  — CODEBASE.md update + verification runs
  3. P1-003 main.js skeleton (M)  ~$0.10  — subagent with full architecture context
```

## Subagent breakdown (7 agents via vibe-parallel)

| Agent | Total tokens | Est. cost |
|-------|-------------|-----------|
| P1-002 entitlements.plist | 16,730 | ~$0.10 |
| P1-003 main.js skeleton   | 16,304 | ~$0.10 |
| P1-004 preload.js         | 15,615 | ~$0.09 |
| P1-005 index.html         | 15,163 | ~$0.09 |
| P1-006 PATH resolution    | 15,952 | ~$0.10 |
| P1-007 global shortcut    | 16,670 | ~$0.10 |
| P1-008 IPC stubs          | 16,351 | ~$0.10 |
| **Total subagents**       | **112,785** | **~$0.64** |

Subagents = 49% of session cost. Wave 1 (4 agents) was well-parallelised.
Waves 2–4 (3 agents, 1 task each) had no parallelism benefit — overhead only.

## Project totals

```
Total sessions:   2
Total cost:       $1.91 (estimated)

By phase:
  Planning:               $0.61  (1 session) [complete]
  Phase 1 — Foundation:   $1.30  (1 session) [complete]
  Phase 2 — Core:         $0.00  (not started)
  Phase 3 — Polish:       $0.00  (not started)

By feature area:
  Planning and architecture:           $0.61
  Electron shell and IPC (Phase 1):    $0.79
  Code review and quality gate:        $0.25
  Dev tooling (parallel, lint):        $0.25
```

## Trend (2 sessions)

```
Session 1 (planning):    $0.61
Session 2 (Phase 1):     $1.30  ↑ +113%

Not enough data for trend analysis (need 3+ sessions).
Phase 1 was heavier than planning due to 7 subagents — expected.
```

## Recommendations (2 found)

💡 [CP-04] Single-task waves don't need subagents — save ~$0.09/session
   Waves 2–4 each had 1 task (no parallelism benefit). Each agent adds ~12,000
   overhead tokens just for context setup. Run single-task waves directly in the
   main session. Only use subagents when 2+ tasks can truly run simultaneously.

💡 [CP-05] Monitor prompt caching in Phase 2 — save ~$0.05–0.15/session
   CLAUDE.md + ARCHITECTURE.md will be loaded every session. Once these files
   stabilise after F-STATE, caching kicks in automatically. Avoid editing
   CLAUDE.md between tasks (resets 5-min TTL). Status: ok for now, watch in P2.

## Project cost forecast

```
Completed: ~50% of tracked task groups
Spent:     $1.91

Phase 2 estimate (5 features, ~25–35 sub-tasks):  $1.50–2.50
Phase 3 estimate (4 polish tasks):                 $0.40–0.80
Est. remaining:                                    $1.90–3.30
Est. total project:                                $3.80–5.20

F-CLAUDE (Claude CLI integration) will be the most expensive feature —
it touches main.js, index.html, and requires the most complex logic.
```

⚠️ These are estimates (±25%). For precise tracking, run `/cost` in Claude Code
at session end, then paste with: `cost: [paste here]`

History: vibe/cost/history.json (2 sessions)
