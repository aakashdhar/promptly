# Cost Report — Promptly
Session #12 · 2026-04-19 · claude-sonnet-4-6
Mode: Estimated ±25%
══════════════════════════════════════════

## THIS SESSION

  Input tokens:     ~185,000 (est.)
  Output tokens:    ~14,000 (est.)
  Session cost:     ~$0.76 estimated
  Tasks completed:  5 major work units
  Cost per task:    ~$0.15 average

  Task breakdown:
    1. F-HISTORY removal       M   ~$0.19   (index.html full read + 8 edits + DECISIONS + commits)
    2. F-LANGUAGE removal      M   ~$0.17   (index.html + main.js + preload.js + DECISIONS + commits)
    3. Wave 8 FLG-003 subagent S   ~$0.12   (subagent overhead + CODEBASE.md + ARCHITECTURE.md writes)
    4. Wave 7 nativeTheme fix  S   ~$0.10   (main.js read + 3 edits + lint + commits)
    5. TASKS.md Phase 4 update S   ~$0.07   (TASKS.md edit + commit)
    6. vibe-cost               S   ~$0.11   (history reads + report generation)

  Biggest cost driver: session continuation overhead (~40K tokens)
  The session loaded a compacted summary of the previous session —
  adding ~$0.12 of pure context cost before any work began.

## PROJECT TOTALS

  Total sessions:   12
  Total cost:       ~$7.06 (all estimated)

  By phase:
    Planning & Architecture:  $0.61  (1 session)  [complete]
    Phase 1 — Foundation:     $1.30  (1 session)  [complete]
    Phase 2 — Core Features:  $3.04  (7 sessions) [complete]
    Phase 3 — Polish & Ship:  $1.15  (2 sessions) [complete]
    Phase 4 — v2 Features:    $0.96  (1 session)  [complete — then 2 features removed]

  By feature area:
    Planning & architecture:            $0.61
    Foundation shell (Electron):        $1.30
    State machine & UI:                 $0.98
    First-run & splash screen:          $0.64
    Dark glass design & bug fixes:      $0.52
    Recording refactor (pill → win):    $0.42
    Vibrancy & splash (FEATURE-001):    $0.68
    Quality review, polish & ship:      $1.15
    Phase 4 features + cleanup:         $0.96

## TREND (last 5 sessions)

  Sparkline: ▃▅█▂█
  Session  8 (DECISION-004):   $0.42
  Session  9 (vibrancy+splash): $0.68
  Session 10 (P2 review+fixes): $0.77
  Session 11 (final review):    $0.38  ← lightest: review only
  Session 12 (this):            $0.76  ↑ +35% vs recent average

  ⚠ Slight spike vs average ($0.57). Driven by:
    - Session continuation overhead from compacted prior session
    - index.html read in full twice (two separate feature removals)

## RECOMMENDATIONS (2 found)

  💡 [CP-01] Session continuation loaded ~40K overhead tokens
     This session started from a compacted summary of the previous session.
     That summary injected ~40,000 tokens before any work started, costing ~$0.12.
     Fix: keep sessions shorter so the context doesn't hit compaction limits.
     A session under ~80K tokens won't compact and avoids this overhead entirely.
     Est. saving: ~$0.10–0.15 per session that starts from compaction

  💡 [CP-02] index.html read twice in one session
     F-HISTORY removal and F-LANGUAGE removal each started with a full read of
     index.html (~1,000 lines). Batching both removals into a single read+edit
     pass would have saved one full file load (~8,000 tokens, ~$0.024).
     Fix: when removing multiple features from the same file, plan all edits
     upfront and apply in a single pass.
     Est. saving: ~$0.02–0.05 per multi-feature removal session

## PROJECT COST FORECAST

  Completed: 100% of planned v1 tasks
  Spent:     ~$7.06
  App is shipped. React migration is the likely next major spend.

  For a React rewrite: expect $8–14 total based on this project's rate of
  ~$0.12/task for S, ~$0.18/task for M, ~$0.35/task for L.
  A typical React migration of this scope (10–20 components) would be
  15–25 M-sized tasks = $2.70–$4.50.

─────────────────────────────────────────
⚠ Estimates only (±25%). For precise data, run /cost in Claude Code
  then paste output: cost: [paste here]

Full history: vibe/cost/history.json (12 sessions)
