# Cost Report — Promptly
**Session #7 · 2026-04-18 · claude-sonnet-4-6 · Estimated ±25%**

## This Session
| | |
|---|---|
| Input tokens | ~95,000 |
| Output tokens | ~15,500 |
| Session cost | **$0.52** (estimated) |
| Tasks completed | 3 (design + bugs + dropdown fix) |
| Cost per task | ~$0.17 avg |

**Task breakdown:**
1. `design-implementation` · Dark glass visual redesign · L · ~$0.27
2. `bug-fixes-6-items` · Traffic lights, resize, transcript, waveform, labels, system prompts · M · ~$0.20
3. `mode-dropdown-fix` · stopPropagation on mode pill click · S · ~$0.03
4. `vibe-cost` · This report · S · ~$0.02

## Project Totals
| | |
|---|---|
| Sessions | 7 |
| Total cost | **$4.05** (all estimated) |

**By phase:**
- Planning: $0.61 (1 session) ✅
- Phase 1 — Foundation: $1.30 (1 session) ✅
- Phase 2 — Core features: $2.14 (5 sessions) ✅
- Phase 3 — Polish: $0.00 (not started) ⬜

**By feature:**
- Electron shell (Phase 1): $1.30
- State machine & UI skeleton: $0.98
- First-run setup flow: $0.64
- Dark glass design + bug fixes: $0.52
- Planning & architecture: $0.61

## Trend (last 5 sessions)
```
Session 3:   $0.47  ████████░░░░
Session 4:   $0.51  █████████░░░
Session 5:   $0.44  ████████░░░░
Session 6:   $0.20  ████░░░░░░░░
Session 7:   $0.52  █████████░░░  ↑ +160% vs S6
```
↑ spike from S6 is misleading — S6 was an unusually short session (1 task). S7 is in line with all other build sessions ($0.44–0.52).

✅ Costs stable — S3 through S7 average $0.43, this session within 20%.

## Recommendations (1 found)

**💡 [CP-05] No prompt caching — 0 cache reads across all 7 sessions**
Every token paid at full input price ($3.00/MTok). CLAUDE.md is read
repeatedly and modified frequently, blocking cache eligibility. With
Phase 3 approaching and v2 ahead, splitting CLAUDE.md into a stable
section (rules, architecture, IPC map) and a dynamic section (active
feature pointer) would unlock caching on the stable part at 90% lower cost.
Est. saving: ~$0.08–0.12/session in v2 work.

## Project Forecast
Completed: 89% of planned Phase 1–3 tasks
Spent: $4.05
Phase 3 remaining (4 tasks): est. $0.30–0.55
**Est. total at completion: $4.35–4.60**

---
⚠️ All figures are estimates (±25%). For precise tracking, run `/cost` at session end and paste with `cost: [output]`.
