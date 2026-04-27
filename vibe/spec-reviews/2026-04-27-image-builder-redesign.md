# Spec Review — FEATURE-IMAGE-BUILDER (major redesign)
> Date: 2026-04-27 | Trigger: vibe-spec-review (on-demand after spec rewrite)
> Status: All findings fixed ✅

---

## Documents audited
- vibe/features/2026-04-27-image-builder/FEATURE_SPEC.md
- vibe/features/2026-04-27-image-builder/FEATURE_TASKS.md
- vibe/SPEC.md (contradiction check)
- vibe/ARCHITECTURE.md (contradiction check)

---

## P0 — Critical (2 found → 2 fixed)

### P0-001 · FEATURE_SPEC.md · subjectDetail missing from param rows
Issue: `subjectDetail` appeared in the Claude pre-selection JSON schema
  but had no corresponding row in the UI (18 rows specified but only 17
  accounted for by other params).
Fix applied: Added Row 3 "Subject detail — multi-select chips + add" to
  default rows. Renumbered all rows: default now rows 1–11, advanced
  rows 12–18. Also corrected the pre-selection JSON to use `"subjectDetail": []`
  (array, consistent with other multi-select params).

### P0-002 · FEATURE_SPEC.md · single-select picker behavior undefined
Issue: Rows labelled "single select chip" still showed a "+ add" chip
  with no spec for what happens when user taps it on an already-filled row.
Fix applied: Added "Single-select vs multi-select picker behavior" section
  immediately after the option picker definition. Single-select: selecting
  an option replaces the existing chip; picker hides the current value.
  Multi-select: selecting adds alongside existing chips.

---

## P1 — Warnings (4 found → 4 fixed)

### P1-001 · FEATURE_SPEC.md · "Claude API call" contradicts IPC-only architecture
Fix applied: Replaced "make a Claude API call" with the exact IPC call:
  `window.electronAPI.generateRaw(systemPrompt, transcript)`. Also updated
  the assembly call in "Confirm & generate flow" to use the same pattern.

### P1-002 · FEATURE_SPEC.md · thinkingLabel mechanism unspecified
Fix applied: "ThinkingState labels" section now specifies: add `thinkingLabel`
  useState to App.jsx; set before calling transition('THINKING'); pass as
  `<ThinkingState label={thinkingLabel} />`. Empty label = existing default.

### P1-003 · FEATURE_SPEC.md · removedByUser state missing from merge logic
Fix applied: Added `removedByUser` to App.jsx state additions (maps param →
  Set<string> of explicitly removed values). Updated merge logic to filter
  new AI chips through removedByUser before writing to imageAnswers. Updated
  IMG-012 task to reference this state.

### P1-004 · FEATURE_TASKS.md · IMG-009 marked done but scope absorbed into IMG-003
Fix applied: IMG-009 unchecked. Updated to "verify isExpanded prop renders
  review screen in ExpandedView.jsx right panel — regression test after
  IMG-003 lands." Dependency set to IMG-003, IMG-005.

---

## P2 — Notes (3 found → 3 fixed)

- Pre-selection JSON used invalid single-quoted keys → fixed to double-quoted valid JSON.
- "Edit answers" absent from expanded done screen without explanation → added
  intentional omission note (compact keeps it; expanded users use Start over).
- IMG-010 marked done prematurely → unchecked; updated to depend on all redesign tasks.
