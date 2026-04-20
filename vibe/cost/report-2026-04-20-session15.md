# COST REPORT — Promptly
Mode: Estimated ±25%
Session #15 · 2026-04-20 · claude-sonnet-4-6
══════════════════════════════════════════════

## THIS SESSION

  Input tokens:     75,000 (cache reads: 0 — cache still inactive)
  Output tokens:    7,500
  Session cost:     $0.35 estimated
  Tasks completed:  1 (DESIGN-001)
  Cost per task:    $0.35

  Task breakdown:
    1. DESIGN-001 · vibrancy removed + ambient glow · S · $0.194
    2. vibe-cost   · cost tracking                  · S · $0.156

## PROJECT TOTALS

  Total sessions:   15
  Total cost:       $8.244 estimated

  By phase:
    Planning:             $0.606  (1 session)   [complete]
    Phase 1 — Foundation: $1.300  (1 session)   [complete]
    Phase 2 — Core:       $4.014  (8 sessions)  [complete]
    Phase 3 — Polish:     $0.375  (1 session)   [complete]
    Phase 4 — v2:         $1.949  (5 sessions)  [active]

  By feature:
    Core recording flow (state machine, speech, Claude, actions):  $2.074
    Bug fixes & design polish (Phase 2/3):                         $1.565
    Project setup & architecture:                                  $1.906
    Pause/resume recording (FEATURE-011):                          $0.674
    v2 features (history, tray, shortcuts, export, refine):        $0.900
    React migration (FEATURE-004):                                 $0.400
    Visual design — dark glass + ambient glow (DESIGN-001):        $0.350
    Phase 3 final review & ship:                                   $0.375

## TREND (last 5 sessions)

  ▅▇▂▇▃
  Session 11:   $0.375
  Session 12:   $0.760
  Session 13:   $0.165
  Session 14:   $0.674
  Session 15:   $0.350  ↓ -29% vs 4-session avg ($0.494)

  ✅ Lightest session since #13. Small targeted change — cost appropriate.

## RECOMMENDATIONS (1 found)

  💡 [CP-05] CLAUDE.md caching still disabled — 15 sessions, zero cache reads
     CLAUDE.md has grown to ~5,000 tokens with active feature sections for
     7 completed features (F-SPEECH, F-CLAUDE, F-ACTIONS, FEATURE-004, FEATURE-007,
     FEATURE-009, FEATURE-011). All are done — their rules are now in the codebase.
     Each session modifies CLAUDE.md (new features added), resetting the cache.
     Archiving completed feature blocks would make CLAUDE.md stable and cacheable.
     Est. saving: ~$0.10–0.15/session

## PROJECT COST FORECAST

  Completed: 97% of planned tasks (93 done, 3 remaining)
  Spent:     $8.244
  Est. remaining at current rate: $0.10–0.25
  Est. total project cost:        ~$8.35–8.50

  Remaining tasks: manual smoke test, notarisation, Sparkle auto-update, landing page

---
⚠️ These are estimates (±25%). For precise tracking, run /cost in Claude Code
   at session end, then paste with: cost: [paste here]

Full history: vibe/cost/history.json (15 sessions)
