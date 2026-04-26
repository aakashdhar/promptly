# COST REPORT — Promptly
Mode: Estimated ±25%
Session #21 · 2026-04-26 · claude-sonnet-4-6
══════════════════════════════════════════════

## THIS SESSION (#21)
  Input tokens:     50,000
  Output tokens:    7,000
  Session cost:     $0.26 (estimated)
  Tasks completed:  3
  Cost per task:    $0.085 average

  Tasks this session:
    1. fix-history-review  · 6 history panel fixes  · M  · $0.12
    2. fix-electron-menu   · remove default app menu  · S  · $0.08
    3. release-sh          · release script creation  · S  · $0.055

## UNTRACKED SESSIONS NOW RECORDED (Sessions 17–20)

  Session 17 · 2026-04-23 · $0.81 (est)
    BUG-017 nvm PATH resolution (L) + FEATURE-014 Text Input (5 tasks) + review
    12 tasks · $0.068/task average

  Session 18 · 2026-04-23 · $0.87 (est)
    FEATURE-015 Polish Mode (7 tasks) + review + BUG-018/019 + POLISH-011 bundle
    13 tasks · $0.067/task average

  Session 19 · 2026-04-24 · $0.87 (est)
    FEATURE-016 Uninstaller (8 tasks) + FEATURE-013 Path Config Panel (8 tasks)
    16 tasks · $0.054/task average

  Session 20 · 2026-04-24 · $1.35 (est) ← HEAVIEST SESSION
    FEATURE-017 menubar icon + FEATURE-018 quick copy + BUG-033 App.jsx SRP
    + FEATURE-020 History Panel v2 (9 tasks) + final review gate (9.8/10)
    26 tasks · $0.052/task average

## PROJECT TOTALS
  Total sessions:   21
  Total cost:       $13.57 (all estimated ±25%)

  By phase:
    Phase 1 — Foundation:           $1.91  (2 sessions)  ✅ complete
    Phase 2 — Core features:        $4.01  (8 sessions)  ✅ complete
    Phase 3 — Polish + hardening:   $0.38  (1 session)   ✅ complete
    Phase 4 — v2 Features:          $7.27  (10 sessions) ✅ complete — DEPLOYED

  By feature area:
    Distribution, menubar, path config      $3.55  ← most expensive area
    Advanced features (history, polish...)  $2.95
    Planning and specifications             $1.52
    Bug fixing and hardening                $1.92
    UI states, animations, design           $1.45
    Core app foundation                     $1.30
    Speech recording + Claude integration   $0.88

## TREND (last 6 sessions)
  Session 16 (2026-04-20): $1.17  — FEATURE-012 + 5 bug fixes
  Session 17 (2026-04-23): $0.81  ↓ -31%
  Session 18 (2026-04-23): $0.87  ↑  +7%
  Session 19 (2026-04-24): $0.87  →  stable
  Session 20 (2026-04-24): $1.35  ↑ +55%  ← final sprint (26 tasks)
  Session 21 (2026-04-26): $0.26  ↓ -81%  ← maintenance only
  5-session average: $0.83

  ✅ Costs stable — final sprint spike was expected (4 features + review gate)

## RECOMMENDATIONS (2 found)

  🔴 [CP-01] DECISIONS.md is 97KB — largest cost driver in the project
     DECISIONS.md has grown to 97KB (~24,000 tokens) across 9 days.
     It is loaded at every session startup and referenced repeatedly.
     Entries from Phase 1 and Phase 2 are historical artefacts —
     moving D-001 through D-BUG-008 to DECISIONS_ARCHIVE.md would
     reduce per-session input overhead by ~15,000 tokens.
     Est. saving: ~$0.07–0.10/session

  🟡 [CP-05] Prompt caching unused — 0% cache hit rate across all 21 sessions
     CLAUDE.md (21KB) + ARCHITECTURE.md (24KB) + CODEBASE.md (28KB)
     = ~18,000 tokens read cold every session. These files are stable
     and ideal for prompt caching at 10% of base input cost.
     Est. saving: ~$0.05–0.15/session on large sessions

## PROJECT COST FORECAST
  Completed: 100% (153/153 tasks, DEPLOY UNLOCKED)
  Spent:     $13.57
  Est. remaining at current rate: $0.00 (project complete)
  Est. Phase 5 cost (if new features added): $0.80–1.20/feature session

⚠️ These are estimates (±25%). For precise tracking, run /cost in
   Claude Code at session end, then paste with: cost: [paste here]

Full history: vibe/cost/history.json (21 sessions)
