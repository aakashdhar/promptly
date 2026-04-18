# Cost Report — Promptly
> Mode: Estimated ±25% | Session #11 · 2026-04-18 · claude-sonnet-4-6

---

## THIS SESSION

```
Input tokens:     90,000
Output tokens:     7,000
Session cost:      $0.38  (estimated)
Tasks completed:   3
Cost per task:     $0.13  average
```

**Task breakdown:**
```
final-review          L    $0.285   (9 files read + full report written)
RFX-001-console       S    $0.055   (6 log removals, lint pass)
vibe-cost             S    $0.035
```

---

## PROJECT TOTALS

```
Total sessions:    11
Total cost:        $6.295  (all estimated)
Build progress:    100% — SHIPPED
```

**By phase:**
```
Planning & Architecture   $0.606   (1 session)  ✅ complete
Phase 1 — Foundation      $1.300   (1 session)  ✅ complete
Phase 2 — Core Features   $3.044   (7 sessions) ✅ complete
Phase 3 — Polish & Ship   $1.145   (2 sessions) ✅ complete
```

**By feature:**
```
Planning & architecture                 $0.61
Foundation shell (Electron setup)       $1.30  ← most expensive
State machine & UI                      $0.98
First-run & splash screen               $0.64
Dark glass design & bug fixes           $0.52
Recording refactor (pill → main win)    $0.42
Vibrancy & splash (FEATURE-001)         $0.68
Quality review, polish & ship           $1.15
```

---

## TREND (all 11 sessions)

```
▂▇▄▄▄▂▄▃▅▅▂

Session  1  (planning):           $0.61
Session  2  (Phase 1 build):      $1.30  ← project peak
Session  3  (F-STATE plan):       $0.47
Session  4  (F-STATE build):      $0.51
Session  5  (F-FIRST-RUN plan):   $0.44
Session  6  (FRN cleanup):        $0.20
Session  7  (design + bugs):      $0.52
Session  8  (DECISION-004):       $0.42
Session  9  (vibrancy + splash):  $0.68
Session 10  (P2 review + polish): $0.77
Session 11  (final review/ship):  $0.38  ↓ -51% (light session)
```

5-session average (sessions 7–11): $0.55
This session: $0.38 — 31% below average. ✅ No spike.

---

## RECOMMENDATIONS (2 found)

💡 **[CP-05] Prompt caching never activated — 0% cache hit rate across all 11 sessions**
   CLAUDE.md, CODEBASE.md, and ARCHITECTURE.md were loaded from scratch every session.
   For a next project, keep the stable architecture section of CLAUDE.md separate from the
   active-feature section. Cache reads cost 90% less than fresh reads.
   Est. saving: ~$0.15–0.25/session on future projects

ℹ️  **[CP-01] Review sessions carry large context overhead — justified**
   Both review sessions read 7-10 source files plus all vibe docs. This is inherent
   to a thorough audit. Both caught real bugs before ship (BL-013 regex, BL-014 RAF leak).
   No change recommended.

---

## PROJECT COST FORECAST

```
Completed:   100% of planned tasks
Spent:       $6.30
Remaining:   $0.00 — project shipped ✅

For v2 features: expect $0.40–0.80 per medium feature
based on Phase 2 averages ($0.10–0.15/task × 4–8 tasks).
```

---

⚠️ All figures are estimates (±25%). Paste `/cost` output for precise tracking.
History: vibe/cost/history.json (11 sessions)
