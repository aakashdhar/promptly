# SPEC REVIEW — Promptly — FEATURE-020 History Panel v2
> Trigger: add-feature | Date: 2026-04-24

## Documents audited
- vibe/features/2026-04-24-history-v2/FEATURE_SPEC.md
- vibe/features/2026-04-24-history-v2/FEATURE_TASKS.md
- vibe/SPEC.md (contradiction check)
- src/renderer/components/HistoryPanel.jsx (integration check)
- src/renderer/utils/history.js (integration check)

## Findings

### P0 — Critical (0 found)
None ✅

### P1 — Warnings (2 found — both fixed)

**P1-001 · FEATURE_SPEC.md + HSTV2-005 · Delete button collision**
Issue: Existing delete ✕ at `position:absolute, top:12px, right:12px` collides with
bookmark/emoji indicator added at same position. On any bookmarked or rated entry
the elements overlap, breaking layout and potentially misfiring delete on bookmark click.
Fix applied: HSTV2-005 updated — delete button becomes hover-only (opacity:0 → opacity:1).
Indicator hides during hover. hoveredEntry state added to HistoryPanel.
Status: ✅ FIXED in FEATURE_TASKS.md

**P1-002 · FEATURE_SPEC.md + HSTV2-004 · Stats computed from search-filtered entries**
Issue: Stats used `entries` state which resets to searchHistory() results when search is active.
Stats would fluctuate with search query — misleading rating summary.
Fix applied: HSTV2-004 updated — stats computed from `getHistory()` directly (full history).
allHistory.length used for prompt count too.
Status: ✅ FIXED in FEATURE_TASKS.md

### P2 — Notes (2 found — both addressed)
- activeFilter not reset on tab switch: fixed in HSTV2-002 tab onClick handler.
- Bookmark button missing hover state: noted in HSTV2-005 boundaries; low priority.

## Cross-document consistency
- FEATURE_SPEC.md ↔ SPEC.md: ✅ No contradictions — purely additive
- FEATURE_SPEC.md ↔ ARCHITECTURE.md: ✅ Inline styles, no Tailwind for dynamic, no new IPC
- FEATURE_SPEC.md ↔ HistoryPanel.jsx: ✅ After P1-001 fix
- FEATURE_SPEC.md ↔ history.js: ✅ Additive fields, HISTORY_KEY used, no breaking changes

## Verdict
✅ SPEC READY — 0 P0 findings. 2 P1 findings fixed. Proceed to build.
