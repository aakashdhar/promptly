# Cost Report — Promptly
**Mode: Estimated ±25% | Session #6 · 2026-04-18 · claude-sonnet-4-6**

---

## THIS SESSION

```
Input tokens:     48,000
Output tokens:     4,000
Session cost:      $0.20  estimated ±25%
Tasks completed:   1  (FRN-004)
Cost per task:     $0.20  (includes vibe-cost overhead)
```

**Task breakdown:**
```
1. FRN-004  · checkFirstRunCompletion() impl      S  ~$0.11
2. vibe-cost · cost tracking overhead             S  ~$0.09
```

---

## PROJECT TOTALS

```
Total sessions:   6
Total cost:       $3.53  (all estimates)

By phase:
  Planning:            $0.61  (1 session)  [complete]
  Phase 1 Foundation:  $1.30  (1 session)  [complete]
  Phase 2 Core:        $1.63  (4 sessions) [active — 53% done]
  Phase 3 Polish:      $0.00  (0 sessions) [not started]

By feature:
  Project setup & planning:           $0.61
  Phase 1 foundation (Electron):      $1.30  ← most expensive
  F-STATE (state machine + UI):       $0.98
  F-FIRST-RUN (first-run checklist):  $0.64
```

---

## TREND (last 5 sessions)

```
▇▃▃▂▁
Session 2 (Phase 1 build):       $1.30
Session 3 (F-STATE planning):    $0.47
Session 4 (F-STATE build):       $0.51
Session 5 (F-FIRST-RUN plan):    $0.44
Session 6 (F-FIRST-RUN build):   $0.20  ↓ -55% vs prev

✅ Costs declining — lightest session yet (1 task only)
5-session average (excl. session 2 outlier): $0.41
```

---

## RECOMMENDATIONS (1 found)

```
⚠️  [CP-05] Prompt caching inactive across all 6 sessions
    CLAUDE.md, ARCHITECTURE.md, and SPEC.md are re-read fresh every turn.
    Those three files alone are ~15,000 tokens per session startup.
    Split CLAUDE.md into a stable cached header and a dynamic Active Feature
    footer — cache the stable part, swap only the footer each session.
    Est. saving: ~$0.10-0.15/session  (~25% off remaining Phase 2 work)
```

---

## PROJECT COST FORECAST

```
Completed: 53% of planned tasks (18/~34)
Spent:     $3.53

Remaining work:
  F-SPEECH planning + build:    ~$0.90
  F-CLAUDE planning + build:    ~$1.00
  F-ACTIONS planning + build:   ~$0.80
  Phase 3 polish (4 tasks):     ~$0.45

Est. remaining:    ~$3.15
Est. total:        ~$6.40-7.00

With CP-05 caching fix applied before F-SPEECH:
  Est. saving:     ~$0.30-0.50
  Revised total:   ~$6.00-6.50
```

---

⚠️ These are estimates (±25%). For precise tracking, run `/cost` in
Claude Code at session end, then paste with: `cost: [paste here]`

Full history: `vibe/cost/history.json` (6 sessions)
