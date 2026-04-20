# COST REPORT — Promptly
Mode: Estimated ±25%
Session #16 · 2026-04-20 · claude-sonnet-4-6
══════════════════════════════════════════

## THIS SESSION

  Input tokens:     237,000
  Output tokens:    30,500
  Session cost:     ~$1.17 (estimated ±25%)
  Tasks completed:  7
  Cost per task:    ~$0.17 average

  Task breakdown:
    1. FEATURE-012 Iteration Mode   L  ~$0.30
    2. FEATURE-SIGNING              M  ~$0.135
    3. BUG-015 Object destroyed     M  ~$0.128
    4. BUG-013 Mic permission       M  ~$0.12
    5. BUG-012 PATH resolution      M  ~$0.12
    6. BUG-014 Whisper ffmpeg       M  ~$0.099
    7. BUG-016 Mic dialog           S  ~$0.059
       Context overhead                ~$0.12
       vibe-cost                       ~$0.09

## PROJECT TOTALS

  Total sessions:   16
  Total cost:       ~$9.41 (all estimates)

  By phase:
    Phase 1 (Foundation):       $1.906  (2 sessions) [complete]
    Phase 2 (Core features):    $4.014  (8 sessions) [complete]
    Phase 3 (Polish):           $0.375  (1 session)  [complete]
    Phase 4 (v2 Features):      $3.119  (5 sessions) [active]

  By feature area:
    Planning & specifications:  $1.516  ← most expensive planning phase
    Phase 1 foundation build:   $1.300
    UI states & animations:     $1.450
    Speech & Claude integration:$0.884
    Reviews & bug fixing:       $1.145
    Advanced features (v2):     $1.599
    UI polish & distribution:   $1.520

## TREND (last 5 sessions)

  Session 12 (2026-04-19):  $0.760
  Session 13 (2026-04-19):  $0.165
  Session 14 (2026-04-20):  $0.674
  Session 15 (2026-04-20):  $0.350
  Session 16 (2026-04-20):  $1.170  ↑ +153% vs session 15 (large multi-task catch-up)

  ⚠️ Cost spike: session 16 is 2.5× the 5-session average ($0.46)
     Reason: 7 tasks including an L-sized feature + 5 bug fixes in one run.
     This is not a drift signal — it reflects a large batch of real work.

## RECOMMENDATIONS (2 found)

  💡 [CP-01] DECISIONS.md at 78KB — context overhead every session
     DECISIONS.md is 78KB (~19,500 tokens) and is likely read in full on session startup.
     Fix: Archive decisions from Phase 1–2 into DECISIONS_ARCHIVE.md. Only load recent entries.
     Est. saving: ~$0.05–0.08/session

  🔴 [CP-05] Prompt caching unused — 0% cache hit rate across all 16 sessions
     CLAUDE.md (21KB of stable content) is never cached. Cache reads cost 90% less.
     Fix: Ensure CLAUDE.md is passed as a stable system prompt prefix so the cache TTL is hit.
     In practice, Claude Code's prompt caching is automatic when context is stable between turns.
     Est. saving: ~$0.10–0.20/session on sessions > $0.50

## PROJECT COST FORECAST

  Completed: ~98% of planned tasks
  Spent:     ~$9.41
  Remaining: 2 tasks (smoke test + distribution)
  Est. remaining: $0.10–0.60 depending on distribution scope

⚠️ These are estimates (±25%). For precise tracking, run /cost in
   Claude Code at session end, then paste with: cost: [paste here]

History: vibe/cost/history.json (16 sessions)
