# Spec Review — FEATURE-EMAIL-MODE — 2026-04-30
> Trigger: vibe-add-feature
> Documents audited: FEATURE_SPEC.md, FEATURE_TASKS.md, vibe/SPEC.md, vibe/ARCHITECTURE.md

## Result: ⚠️ WARNINGS — 0 P0 · 6 P1 · 3 P2 — ALL FIXED

## Findings (all resolved)

### P1 (6 found, 6 fixed)
- P1-001: IdleState.jsx missing from "Files in scope" → added
- P1-002: ExpandedTransportBar.jsx, ExpandedDetailPanel.jsx, promptUtils.js missing from scope → added
- P1-003: Edit button had no defined behaviour → defined as inline contenteditable with Done/Escape
- P1-004: Save button ambiguous (history auto-saved) → defined as bookmark toggle via bookmarkHistoryItem()
- P1-005: setThinkingAccentColor call not specified → added to STEP 3 + EMAIL-004 What to do
- P1-006: Auto-expand shortcut path no owner specified → specified: check in shortcut-triggered listener before startRecordingRef.current()

### P2 (3 found, 3 fixed)
- P2-001: "EMAIL_READY: two-column layout renders correctly" untestable → reworded to "right panel shows two-column grid (1fr 1.4fr)"
- P2-002: EMAIL-007 tagged S but covers 3 visual concerns → re-tagged M
- P2-003: No getModeTagStyle('email') test specified → added to EMAIL-008 with test code example

## Cross-document consistency
- ✅ No contradictions with SPEC.md
- ✅ No contradictions with ARCHITECTURE.md
- ⚠️ Fixed: FEATURE_TASKS.md scope was broader than FEATURE_SPEC.md scope list

## Action: fully resolved — all P0+P1+P2 issues fixed before build begins
