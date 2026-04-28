# Spec Review — FEATURE-VIDEO-BUILDER — 2026-04-28

Trigger: vibe-add-feature
Documents audited: FEATURE_SPEC.md, FEATURE_PLAN.md, FEATURE_TASKS.md,
  ARCHITECTURE.md (contradiction check), CODEBASE.md (contradiction check)

## Summary
P0: 4 found → 4 fixed
P1: 8 found → 8 fixed
P2: 3 found → 3 fixed
Action: all issues fixed

## P0 Findings (all fixed)

P0-001 · Dialogue duplication — Row 4 (Audio) and Row 11 (Dialogue) both had
  dialogue text inputs with no specified relationship.
  Fix: Removed "Dialogue — specify below" from Audio row options entirely.
  Audio row = audio texture only (Ambient, Music, SFX, No audio).
  Row 11 is the sole dialogue entry. videoDialogueText is the single state var.

P0-002 · Error states missing for both THINKING phases.
  Fix: Added error transitions to both STEP 3 and STEP 5 with specific
  ERROR messages and state resets.

P0-003 · "Copy now" content undefined (untestable AC item).
  Fix: Defined — Copy now in VIDEO_BUILDER copies raw transcript;
  in VIDEO_BUILDER_DONE copies assembled prompt.

P0-004 · THINKING label differentiation mechanism undefined — two video phases
  + reiterate needed different labels but ThinkingState had no override mechanism.
  Fix: Added thinkingLabel + thinkingAccentColor to App.jsx state.
  transition(THINKING, { label, accentColor }) payload pattern documented.
  ThinkingState.jsx added to files in scope with prop additions specified.

## P1 Findings (all fixed)

P1-001 · FEATURE_TASKS.md missing Touches + Dependencies.
  Fix: All 12 tasks expanded with Touches and Dependencies fields.

P1-002 · videoBuilderProps bundle not defined.
  Fix: Added full bundle shape section (mirrors imageBuilderProps pattern).

P1-003 · No useVideoBuilder.js hook — inconsistency with image builder pattern.
  Fix: Added VID-000 as first task; FEATURE_PLAN.md updated.

P1-004 · Save button behaviour undefined.
  Fix: Defined as history save + 'Saved ✓' 1.5s flash.

P1-005 · Video history entry structure undefined.
  Fix: Defined structure extending base entry with videoAnswers field.

P1-006 · Auto-expand timing undefined.
  Fix: Specified setWindowSize then immediate RECORDING transition (no wait).

P1-007 · Assembly payload merge shape undefined.
  Fix: Defined mergedAnswers = { ...videoAnswers, dialogueText, settingDetail }.

P1-008 · "Start over" target state undefined.
  Fix: Defined as full reset → IDLE.

## P2 Findings (all fixed)

P2-001 · "hidden/disabled" inconsistency for collapse button.
  Fix: Standardised to "disabled, opacity 0.4, tooltip visible" throughout.

P2-002 · No smoke test checklist.
  Fix: Full smoke test checklist added to FEATURE_TASKS.md.

P2-003 · ExpandedView.jsx, ExpandedDetailPanel.jsx, ExpandedTransportBar.jsx
  missing from Files in scope despite being required.
  Fix: All three added to Files in scope; VID-010 task covers wiring.
  ThinkingState.jsx also added to scope for prop additions.
