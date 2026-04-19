# COST REPORT — Promptly
Mode: Estimated ±25%
Session #13 · 2026-04-19 · claude-sonnet-4-6
══════════════════════════════════════════════

## THIS SESSION

  Input tokens:     ~40,000
  Output tokens:    ~3,000
  Session cost:     ~$0.17 (estimated)
  Tasks completed:  0 (session startup + vibe-cost only)
  Cost per task:    N/A

  ⚠️  Note: 7 sessions of Phase 4 work (sessions est. 013–019) were never
      recorded in history.json. The gap covers FEATURE-004 React migration
      (14 tasks), FEATURE-006 Shortcuts (5), FEATURE-007/008 Export (6),
      FEATURE-009 History panel (5), BUG-011, review, and RFX fixes.
      These are estimated below as ~$4.65 of untracked spend.

---

## PROJECT TOTALS

  Tracked sessions:    13
  Tracked total:       $7.22 (estimated)

  Untracked sessions:  ~7 (Phase 4 — React migration through History panel)
  Untracked est.:      ~$4.65

  ⚠️  PROJECT TOTAL (all-in estimate): ~$11.87

  By phase:
    Planning & Architecture:   $0.61  (1 session)   complete
    Phase 1 — Foundation:      $1.30  (1 session)   complete
    Phase 2 — Core Features:   $3.24  (7 sessions)  complete
    Phase 3 — Polish & Ship:   $1.15  (2 sessions)  complete
    Phase 4 — v2 Features:     $5.58  (~10 sessions, 7 untracked)  complete ⚠️ gap

  By feature area (estimated):
    Planning & architecture:         $0.61
    Electron shell + Phase 1:        $1.30
    State machine + UI:              $0.98
    First-run & splash screen:       $0.64
    Design system & bug fixes:       $0.94  (sessions 007–008)
    Vibrancy + morph + FEATURE-001:  $0.68
    Reviews + polish + ship:         $1.15
    React migration (FEATURE-004):   ~$2.20  ← most expensive feature
    Shortcuts panel (FEATURE-006):   ~$0.45
    Export formats (FEATURE-007/008):~$0.55
    History panel (FEATURE-009):     ~$0.65
    BUG-011 + review + RFX fixes:    ~$0.80
    Session overhead (this session): $0.17

---

## TREND (last 5 tracked sessions)

  Session 009  $0.68
  Session 010  $0.77
  Session 011  $0.38  ↓ -51%
  Session 012  $0.76  ↑ +100%
  Session 013  $0.17  ↓ -78%  (startup + vibe-cost only)

  ✅ Costs stable within expected range for task types.
  No session exceeded $1.30 across the entire project.

---

## RECOMMENDATIONS (2 found)

  💡 [CP-05] Prompt caching never activated — 0% cache hit rate project-wide
     CLAUDE.md and CODEBASE.md load fresh every session. With 18KB of CODEBASE.md
     and a 15KB CLAUDE.md, these two files alone drive ~8,000 tokens of overhead
     per session. Keeping CLAUDE.md stable (stop appending Active Feature sections
     inline) would enable prompt caching. Cache reads cost 90% less.
     Est. saving: ~$0.12–0.20/session

  💡 [CP-01] DECISIONS.md is now 54KB — context pressure warning
     DECISIONS.md has grown to 54KB (~13,500 tokens). If any session reads it in
     full (vibe-review, vibe-graph, vibe-changelog), that single file adds ~$0.04
     to that session's input cost. Consider archiving decisions older than Phase 2
     to a DECISIONS_ARCHIVE.md.
     Est. saving: ~$0.04–0.08 per review/graph session

---

## PROJECT COST FORECAST

  Completed:          ~98% of planned tasks
  Spent (tracked):    $7.22
  Spent (estimated):  ~$11.87 (includes untracked gap)
  Remaining tasks:    ~2 (broader distribution)
  Est. remaining:     $0.30–0.60 (notarisation, landing page research)
  Est. project total: ~$12.20–12.50

---

⚠️  All figures are estimates (±25%).
    For precise tracking: run /cost in Claude Code, then paste with: cost: [data]

Full report: vibe/cost/report-2026-04-19-session13.md
History:     vibe/cost/history.json (13 tracked sessions + 7 untracked)
